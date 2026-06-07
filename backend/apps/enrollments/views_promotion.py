from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from datetime import datetime, date

from .models_promotion import (
    AcademicYear, PromotionRule, PromotionBatch, 
    PromotionRecord, DataCarryForward
)
from .models import StudentEnrollment
from apps.students.models import StudentHistory
from .serializers_promotion import (
    AcademicYearSerializer, PromotionRuleSerializer,
    PromotionBatchSerializer, PromotionRecordSerializer,
    DataCarryForwardSerializer, PromotionPreviewSerializer,
    MergedHistorySerializer, StudentHistorySnapshotSerializer
)
from apps.core.school_isolation import SchoolIsolationMixin


class AcademicYearViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        return super().get_queryset()
    
    @action(detail=False, methods=['post'])
    def seed_default_years(self, request):
        """Quickly create 2025-2026 and 2026-2027 academic years"""
        school_id = request.data.get('school_id')
        
        from apps.schools.models import School
        from apps.core.school_isolation import get_user_school
        
        school = None
        if school_id:
            try:
                school = School.objects.get(id=school_id)
            except School.DoesNotExist:
                return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            school = get_user_school(request.user)
            
        if not school:
            return Response(
                {'error': 'school_id required or user not linked to a school'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create 2025-2026 (Current - Active)
        year_2025, created1 = AcademicYear.objects.get_or_create(
            school=school,
            year_code='2025-2026',
            defaults={
                'start_date': date(2025, 4, 1),
                'end_date': date(2026, 3, 31),
                'status': 'ACTIVE'
            }
        )
        
        # Create 2026-2027 (Next - Upcoming)
        year_2026, created2 = AcademicYear.objects.get_or_create(
            school=school,
            year_code='2026-2027',
            defaults={
                'start_date': date(2026, 4, 1),
                'end_date': date(2027, 3, 31),
                'status': 'UPCOMING'
            }
        )
        
        return Response({
            'message': 'Academic years created',
            'created': {
                '2025-2026': created1,
                '2026-2027': created2
            },
            'years': [
                AcademicYearSerializer(year_2025).data,
                AcademicYearSerializer(year_2026).data
            ]
        })
    
    @action(detail=True, methods=['post'])
    def start_closure(self, request, pk=None):
        """Start year-end closure process"""
        academic_year = self.get_object()
        
        if academic_year.status != 'ACTIVE':
            return Response(
                {'error': 'Only ACTIVE years can be closed'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        academic_year.status = 'CLOSING'
        academic_year.save()
        
        return Response({
            'message': 'Year closure initiated',
            'status': 'CLOSING'
        })


class PromotionRuleViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = PromotionRule.objects.all()
    serializer_class = PromotionRuleSerializer
    permission_classes = [IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        return super().get_queryset()


class PromotionBatchViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = PromotionBatch.objects.all()
    serializer_class = PromotionBatchSerializer
    permission_classes = [IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        return super().get_queryset()
    
    @action(detail=False, methods=['post'])
    def create_preview(self, request):
        """Generate promotion preview without executing"""
        school_id = request.data.get('school_id')
        academic_year_id = request.data.get('academic_year_id')
        
        if not school_id or not academic_year_id:
            return Response(
                {'error': 'school_id and academic_year_id required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            academic_year = AcademicYear.objects.get(id=academic_year_id)
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Academic year not found'}, status=status.HTTP_404_NOT_FOUND)
        
        print(f"=== DEBUG PROMOTION PREVIEW ===")
        print(f"Received school_id: {school_id} (type: {type(school_id)})")
        print(f"Received academic_year_id: {academic_year_id}")
        print(f"Academic year code: {academic_year.year_code}")
        
        # Check what school_ids exist in database
        all_enrollment_schools = StudentEnrollment.objects.values_list('school_id', flat=True).distinct()
        print(f"School IDs in enrollments DB: {list(all_enrollment_schools)[:3]}")
        
        all_rule_schools = PromotionRule.objects.values_list('school_id', flat=True).distinct()
        print(f"School IDs in promotion rules DB: {list(all_rule_schools)[:3]}")
        
        # Get all active enrollments
        enrollments = StudentEnrollment.objects.filter(
            school_id=school_id,
            academic_year=academic_year.year_code,
            status='ACTIVE'
        ).select_related('student', 'student__user')
        
        print(f"Found {enrollments.count()} enrollments")
        
        # Get promotion rules
        rules = {rule.from_grade: rule for rule in PromotionRule.objects.filter(school_id=school_id, is_active=True)}
        
        print(f"Found {len(rules)} promotion rules")
        print(f"Rule keys: {list(rules.keys())}")
        
        # Sample first 5 student grades
        if enrollments.exists():
            sample_grades = [e.grade for e in enrollments[:5]]
            print(f"Sample student grades: {sample_grades}")
        
        preview_data = []
        
        for enrollment in enrollments:
            rule = rules.get(enrollment.grade)
            
            if not rule:
                # No rule = retain
                preview_data.append({
                    'enrollment_id': str(enrollment.id),
                    'student_name': f"{enrollment.student.user.first_name} {enrollment.student.user.last_name}",
                    'student_suid': enrollment.student.suid,
                    'current_grade': enrollment.grade,
                    'current_section': enrollment.section,
                    'target_grade': enrollment.grade,
                    'target_section': enrollment.section,
                    'action': 'RETAINED',
                    'reason': 'No promotion rule defined'
                })
                continue
            
            # Apply rule
            if rule.action == 'GRADUATE':
                preview_data.append({
                    'enrollment_id': str(enrollment.id),
                    'student_name': f"{enrollment.student.user.first_name} {enrollment.student.user.last_name}",
                    'student_suid': enrollment.student.suid,
                    'current_grade': enrollment.grade,
                    'current_section': enrollment.section,
                    'target_grade': 'ALUMNI',
                    'target_section': '',
                    'action': 'GRADUATED',
                    'reason': 'Completed highest grade'
                })
            else:
                preview_data.append({
                    'enrollment_id': str(enrollment.id),
                    'student_name': f"{enrollment.student.user.first_name} {enrollment.student.user.last_name}",
                    'student_suid': enrollment.student.suid,
                    'current_grade': enrollment.grade,
                    'current_section': enrollment.section,
                    'target_grade': rule.to_grade,
                    'target_section': enrollment.section if rule.auto_assign_section else '',
                    'action': 'PROMOTED',
                    'reason': f'Auto-promotion: {rule.promotion_type}'
                })
        
        serializer = PromotionPreviewSerializer(preview_data, many=True)
        
        return Response({
            'total': len(preview_data),
            'promoted': len([p for p in preview_data if p['action'] == 'PROMOTED']),
            'retained': len([p for p in preview_data if p['action'] == 'RETAINED']),
            'graduated': len([p for p in preview_data if p['action'] == 'GRADUATED']),
            'preview': serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def execute_promotion(self, request):
        """Execute bulk promotion"""
        school_id = request.data.get('school_id')
        academic_year_id = request.data.get('academic_year_id')
        preview_data = request.data.get('preview_data', [])
        
        if not school_id or not academic_year_id or not preview_data:
            return Response(
                {'error': 'school_id, academic_year_id, and preview_data required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            academic_year = AcademicYear.objects.get(id=academic_year_id)
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Academic year not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create batch
        with transaction.atomic():
            batch = PromotionBatch.objects.create(
                school_id=school_id,
                academic_year=academic_year,
                initiated_by=request.user,
                status='PROCESSING',
                total_students=len(preview_data)
            )
            
            promoted = 0
            retained = 0
            graduated = 0
            failed = 0
            
            # Get next academic year
            next_year_code = f"{int(academic_year.year_code.split('-')[0]) + 1}-{int(academic_year.year_code.split('-')[1]) + 1}"
            
            for item in preview_data:
                try:
                    enrollment = StudentEnrollment.objects.get(id=item['enrollment_id'])
                    
                    # --- CRITICAL: Create Student History Snapshot ---
                    # Defines the state of the student *before* this promotion happens
                    StudentHistory.objects.create(
                        student=enrollment.student,
                        school=enrollment.school,
                        academic_year=academic_year,  # Use the instance from the batch context
                        academic_year_name=enrollment.academic_year, # CharField
                        grade=enrollment.student.current_grade,
                        grade_name=item['current_grade'],
                        section=enrollment.student.current_section,
                        section_name=item['current_section'],
                        roll_number=enrollment.roll_number,
                        promoted=(item['action'] == 'PROMOTED'),
                        promotion_remarks=item.get('reason', ''),
                        # We snapshot the photo at this moment
                        profile_photo_at_time=enrollment.student.profile_photo
                    )
                    # -----------------------------------------------

                    # Create promotion record
                    record = PromotionRecord.objects.create(
                        batch=batch,
                        enrollment_id=enrollment.id,
                        student_name=item['student_name'],
                        student_suid=item['student_suid'],
                        from_grade=item['current_grade'],
                        from_section=item['current_section'],
                        to_grade=item['target_grade'],
                        to_section=item.get('target_section', ''),
                        action=item['action'],
                        reason=item.get('reason', ''),
                        is_locked=True
                    )
                    
                    # Execute action
                    if item['action'] == 'PROMOTED' and item['current_grade'] != '10':
                        # Mark old enrollment as INACTIVE
                        enrollment.status = 'INACTIVE'
                        enrollment.save()
                        
                        # Create new enrollment
                        StudentEnrollment.objects.create(
                            student=enrollment.student,
                            school=enrollment.school,
                            grade=item['target_grade'],
                            section=item.get('target_section', 'A'),
                            academic_year=next_year_code,
                            status='ACTIVE'
                        )
                        promoted += 1
                        
                    elif item['action'] == 'GRADUATED' or item['current_grade'] == '10':
                        enrollment.status = 'GRADUATED'
                        enrollment.save()
                        
                        student = enrollment.student
                        if item['current_grade'] == '10':
                            student.status = 'PENDING_ALUMNI'
                        else:
                            student.status = 'ALUMNI'
                            
                        student.grade_config = None
                        student.current_section = None
                        student.save()
                        
                        graduated += 1
                        
                    elif item['action'] == 'RETAINED':
                        # Keep enrollment, just update year
                        enrollment.academic_year = next_year_code
                        enrollment.save()
                        retained += 1
                        
                except Exception as e:
                    failed += 1
                    batch.error_log += f"Failed {item['student_suid']}: {str(e)}\n"
            
            # Update batch
            batch.promoted_count = promoted
            batch.retained_count = retained
            batch.graduated_count = graduated
            batch.failed_count = failed
            batch.status = 'COMPLETED'
            batch.completed_at = timezone.now()
            batch.save()
            
            # Close academic year
            academic_year.status = 'CLOSED'
            academic_year.closed_by = request.user
            academic_year.closed_at = timezone.now()
            academic_year.save()
        
        return Response({
            'batch_id': str(batch.id),
            'status': 'COMPLETED',
            'promoted': promoted,
            'retained': retained,
            'graduated': graduated,
            'failed': failed
        })


class MergedHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for Year-End History Tab
    Returns simple student snapshots for a given academic year
    """
    queryset = StudentHistory.objects.all()
    serializer_class = StudentHistorySnapshotSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter by academic year and school"""
        queryset = super().get_queryset()
        academic_year_code = self.request.query_params.get('academic_year')
        school_id = self.request.query_params.get('school')
        
        if academic_year_code:
            queryset = queryset.filter(academic_year_name=academic_year_code)
        
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        # Order by student name for consistent display
        queryset = queryset.select_related('student', 'student__user', 'grade_config', 'section')
        queryset = queryset.order_by('student__user__first_name', 'student__user__last_name')
        
        return queryset


class DataCarryForwardViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = DataCarryForward.objects.all()
    serializer_class = DataCarryForwardSerializer
    permission_classes = [IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        return super().get_queryset()
