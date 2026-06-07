from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from .models import StudentEnrollment
from .serializers import StudentEnrollmentSerializer
from apps.accounts.permission_utils import RBACPermission

from apps.core.school_isolation import SchoolIsolationMixin

class EnrollmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = StudentEnrollment.objects.all()
    serializer_class = StudentEnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'enrollments'
    rbac_resource = 'enrollment'
    rbac_action_permissions = {
        'class_strength': 'enrollments.view_enrollment',
        'assign_roll_numbers': 'enrollments.edit_enrollment',
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade=grade)
        
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section=section)
        
        enrollment_status = self.request.query_params.get('status')
        if enrollment_status:
            queryset = queryset.filter(status=enrollment_status)
            if enrollment_status in ['GRADUATED', 'ALUMNI']:
                queryset = queryset.filter(student__status__in=['ALUMNI', 'GRADUATED', 'PENDING_ALUMNI'])
        
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
            
        return queryset.order_by('grade', 'section', 'roll_number')
    
    @action(detail=False, methods=['get'])
    def class_strength(self, request):
        """Get student count by grade and section"""
        school_id = request.query_params.get('school')
        queryset = self.get_queryset().filter(status='ACTIVE')
        
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        strength = queryset.values('grade', 'section').annotate(
            student_count=Count('id')
        ).order_by('grade', 'section')
        
        return Response(list(strength))
    
    def perform_create(self, serializer):
        """Update student's current grade and section upon enrollment"""
        # Automatically set school from the student if not provided
        student_id = self.request.data.get('student')
        from apps.students.models import Student
        
        try:
            student_obj = Student.objects.get(id=student_id)
            print(f"DEBUG: Enrolling student {student_obj} (ID: {student_id})")
            print(f"DEBUG: Student school: {student_obj.school}")
            
            if not student_obj.school:
                # Fallback to user's school if student has none
                from apps.core.school_isolation import get_user_school
                school = get_user_school(self.request.user)
                print(f"DEBUG: Student had no school, using user school: {school}")
            else:
                school = student_obj.school
                
            enrollment = serializer.save(school=school)
            student = enrollment.student
        except Exception as e:
            print(f"CRITICAL ERROR in perform_create: {e}")
            raise e
        
        # We need to find the GradeConfiguration and Section objects 
        # since enrollment stores them as strings
        from apps.schools.models_programs import GradeConfiguration
        from apps.academics.models import Section
        
        try:
            # Update student profile
            grade_obj = GradeConfiguration.objects.filter(
                program__school=enrollment.school,
                grade_name=enrollment.grade
            ).first()
            
            section_obj = Section.objects.filter(
                school=enrollment.school,
                grade_config=grade_obj,
                section_letter=enrollment.section
            ).first()
            
            if grade_obj:
                student.grade_config = grade_obj
            if section_obj:
                student.current_section = section_obj
            
            student.save()
        except Exception as e:
            print(f"Error updating student profile during enrollment: {e}")

    @action(detail=True, methods=['post'])
    def promote(self, request, pk=None):
        """
        Promote student to next grade individually.
        """
        enrollment = self.get_object()
        new_section_letter = request.data.get('new_section')
        percentage = request.data.get('percentage')
        
        if not new_section_letter:
            return Response({'error': 'Target section is required'}, status=http_status.HTTP_400_BAD_REQUEST)

        from apps.schools.models_programs import GradeConfiguration
        from apps.academics.models import Section
        from apps.students.models import StudentHistory
        from .models_promotion import AcademicYear
        from django.utils import timezone
        import datetime

        # 1. Determine successor grade
        student = enrollment.student
        current_grade_config = student.grade_config
        
        if not current_grade_config:
            current_grade_config = GradeConfiguration.objects.filter(
                program__school=enrollment.school,
                grade_name=enrollment.grade
            ).first()

        if not current_grade_config:
            return Response({'error': 'Current grade configuration not found'}, status=http_status.HTTP_404_NOT_FOUND)

        is_graduating = current_grade_config.grade_name in ['10', '12']
        next_grade_config = None
        
        if not is_graduating:
            next_grade_config = GradeConfiguration.objects.filter(
                program=current_grade_config.program,
                grade_order=current_grade_config.grade_order + 1
            ).first()
            
            if not next_grade_config:
                is_graduating = True

        # 2. Get/Create next academic year
        current_year_code = enrollment.academic_year
        try:
            start_year, end_year = map(int, current_year_code.split('-'))
            next_year_code = f"{start_year + 1}-{end_year + 1}"
        except Exception:
            next_year_code = "2026-2027"
            start_year = 2025
            end_year = 2026

        next_academic_year, created = AcademicYear.objects.get_or_create(
            school=enrollment.school,
            year_code=next_year_code,
            defaults={
                'start_date': datetime.date(start_year + 1, 4, 1),
                'end_date': datetime.date(end_year + 1, 3, 31),
                'status': 'UPCOMING'
            }
        )

        # 3. Handle Promotion/Graduation
        if is_graduating:
            target_status = 'PENDING_ALUMNI' if current_grade_config.grade_name == '10' else 'ALUMNI'
            remarks = "Promoted from Grade 10" if current_grade_config.grade_name == '10' else "Graduated from Grade 12"
            
            # 4. Record History first (prior to state modification)
            StudentHistory.objects.create(
                student=student,
                school=enrollment.school,
                academic_year_name=current_year_code,
                grade_name=current_grade_config.grade_name,
                section_name=enrollment.section,
                percentage=percentage,
                promoted=(current_grade_config.grade_name == '10'),
                promotion_remarks=remarks,
                created_at=timezone.now()
            )

            # Graduation Logic
            enrollment.status = 'GRADUATED'
            enrollment.save()
            
            student.status = target_status
            student.grade_config = None
            student.current_section = None
            student.save()
            
            action_taken = 'GRADUATED'
        else:
            target_section, created = Section.objects.get_or_create(
                school=enrollment.school,
                grade_config=next_grade_config,
                section_letter=new_section_letter,
                defaults={'capacity': 50}
            )

            # 4. Record History first (prior to state modification)
            StudentHistory.objects.create(
                student=student,
                school=enrollment.school,
                academic_year_name=current_year_code,
                grade_name=current_grade_config.grade_name,
                section_name=enrollment.section,
                percentage=percentage,
                promoted=True,
                promotion_remarks=f"Promoted to Grade {next_grade_config.grade_name} Section {new_section_letter}",
                created_at=timezone.now()
            )

            # Update existing enrollment in-place
            enrollment.grade = next_grade_config.grade_name
            enrollment.section = new_section_letter
            enrollment.save()
            
            # Update student core profile
            student.grade_config = next_grade_config
            student.current_section = target_section
            student.save()
            
            action_taken = 'PROMOTED'

        return Response({
            'message': f'Student successfully {action_taken.lower()}',
            'action': action_taken,
            'next_year': next_year_code
        })

    @action(detail=True, methods=['post'])
    def re_enroll(self, request, pk=None):
        """
        Re-enroll an alumni student to Grade 11.
        Expects:
        - new_section: letter of the section (e.g. 'A')
        """
        enrollment = self.get_object()
        new_section_letter = request.data.get('new_section')
        
        if not new_section_letter:
            return Response({'error': 'Section selection is required'}, status=http_status.HTTP_400_BAD_REQUEST)
            
        student = enrollment.student
        
        # Verify student is in alumni status
        if student.status not in ['ALUMNI', 'GRADUATED', 'PENDING_ALUMNI']:
            return Response({'error': 'Student is not in alumni status'}, status=http_status.HTTP_400_BAD_REQUEST)
            
        from apps.schools.models_programs import GradeConfiguration
        from apps.academics.models import Section
        from .models_promotion import AcademicYear
        import datetime
        from django.db import transaction
        from apps.audit.models import AuditLog
        
        # Find Grade 11 configuration
        grade_11_config = GradeConfiguration.objects.filter(
            program__school=enrollment.school,
            grade_name='11'
        ).first()
        
        if not grade_11_config:
            return Response({'error': 'Grade 11 configuration not found in this school'}, status=http_status.HTTP_404_NOT_FOUND)
            
        # Find or create target Section
        target_section = Section.objects.filter(
            school=enrollment.school,
            grade_config=grade_11_config,
            section_letter=new_section_letter
        ).first()
        
        if not target_section:
            target_section = Section.objects.create(
                school=enrollment.school,
                grade_config=grade_11_config,
                section_letter=new_section_letter,
                capacity=50
            )
            
        # Determine current active academic year
        current_year = AcademicYear.objects.filter(
            school=enrollment.school,
            status='ACTIVE'
        ).first()
        
        current_year_code = current_year.year_code if current_year else "2025-2026"
            
        # Perform re-enrollment
        with transaction.atomic():
            # Close previous enrollment
            enrollment.close_enrollment(user=request.user, reason="Student re-enrolled to Grade 11")
            
            # Create NEW active enrollment in Grade 11
            from .models import StudentEnrollment
            StudentEnrollment.objects.create(
                student=student,
                school=enrollment.school,
                grade='11',
                section=new_section_letter,
                academic_year=current_year_code,
                status='ACTIVE',
                is_reenrollment=True,
                previous_enrollment=enrollment,
                reenrollment_reason="Readmitted from Alumni to Grade 11"
            )
            
            # Update student profile
            student.status = 'ACTIVE'
            student.grade_config = grade_11_config
            student.current_section = target_section
            student.save()
            
            # Log audit
            from django.contrib.contenttypes.models import ContentType
            AuditLog.objects.create(
                actor=request.user if request.user and request.user.is_authenticated else None,
                action='UPDATE',
                content_type=ContentType.objects.get_for_model(student),
                object_id=str(student.id),
                details=f"Student {student.user.full_name} readmitted to Grade 11 Section {new_section_letter}"
            )
            
        return Response({'message': 'Student readmitted to Grade 11 successfully'})

    @action(detail=True, methods=['post'])
    def confirm_alumni(self, request, pk=None):
        """
        Confirm a pending alumni student as a confirmed alumni.
        """
        import inspect
        print(f"DEBUG confirm_alumni: executing from file {inspect.getfile(type(self))}, source line check OK")

        enrollment = self.get_object()
        student = enrollment.student

        if student.status != 'PENDING_ALUMNI':
            return Response({'error': 'Student is not in pending alumni status'}, status=http_status.HTTP_400_BAD_REQUEST)

        student.status = 'ALUMNI'
        student.save()

        # Log audit — wrapped in try/except so the main action never fails
        try:
            from django.contrib.contenttypes.models import ContentType
            from apps.audit.models import AuditLog
            AuditLog.objects.create(
                actor=request.user if request.user and request.user.is_authenticated else None,
                action='UPDATE',
                content_type=ContentType.objects.get_for_model(student),
                object_id=str(student.id),
                details=f"Student {student.user.full_name} confirmed as alumni"
            )
            print("DEBUG confirm_alumni: AuditLog created successfully")
        except Exception as audit_err:
            print(f"WARNING confirm_alumni: AuditLog failed (non-fatal): {audit_err}")

        return Response({'message': 'Student confirmed as alumni successfully'})