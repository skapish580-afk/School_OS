from rest_framework import viewsets, permissions
from .models import TimelineMark, TimelineRemark, TimelineHealth, StudentEnrollmentArchive
from .serializers import (
    TimelineMarkSerializer, TimelineRemarkSerializer, 
    TimelineHealthSerializer, StudentEnrollmentArchiveSerializer
)

class TimelineMarkViewSet(viewsets.ModelViewSet):
    queryset = TimelineMark.objects.all()
    serializer_class = TimelineMarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        student_suid = self.request.query_params.get('student_suid')
        if student_suid:
            queryset = queryset.filter(student_global_id=student_suid)
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade=grade)
        return queryset

class TimelineRemarkViewSet(viewsets.ModelViewSet):
    queryset = TimelineRemark.objects.all()
    serializer_class = TimelineRemarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        student_suid = self.request.query_params.get('student_suid')
        if student_suid:
            queryset = queryset.filter(student_global_id=student_suid)
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade=grade)
        return queryset

class TimelineHealthViewSet(viewsets.ModelViewSet):
    queryset = TimelineHealth.objects.all()
    serializer_class = TimelineHealthSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        student_suid = self.request.query_params.get('student_suid')
        if student_suid:
            queryset = queryset.filter(student_global_id=student_suid)
        return queryset

from rest_framework.decorators import action
from rest_framework.response import Response
from apps.accounts.permission_utils import RBACPermission

class StudentEnrollmentArchiveViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StudentEnrollmentArchive.objects.all()
    serializer_class = StudentEnrollmentArchiveSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    rbac_module = 'student_archive'
    rbac_resource = 'general'
    rbac_action_permissions = {
        'list': ['student_archive.view_student_archive', 'students.view_student_archive'],
        'retrieve': ['student_archive.view_student_archive', 'students.view_student_archive'],
        'admit': ['students.edit_students', 'students.manage_students', 'enrollments.add_enrollment'],
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_suid = self.request.query_params.get('student_suid')
        if student_suid:
            return queryset.filter(student_global_id=student_suid)
            
        # Bypass school-level isolation on detail requests to allow cross-school admissions
        if getattr(self, 'detail', False) or (self.kwargs and 'pk' in self.kwargs):
            return queryset
            
        # Student Archive rule: Only students who were transferred/withdrawn and NOT re-admitted elsewhere appear in the archive.
        # 1. Exclude records marked as re_admitted=True
        queryset = queryset.filter(re_admitted=False)
        
        # 2. Exclude students who are currently ACTIVE or TEMPORARY in any school
        from apps.students.models import Student
        active_student_suids = Student.objects.filter(
            status__in=['ACTIVE', 'TEMPORARY']
        ).values_list('suid', flat=True)
        
        queryset = queryset.exclude(student_global_id__in=active_student_suids)
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def admit(self, request, pk=None):
        archive = self.get_object()
        grade_name = request.data.get('grade')
        section_letter = request.data.get('section')
        
        if not grade_name or not section_letter:
            return Response({'error': 'Grade and section are required.'}, status=400)
            
        from apps.core.school_isolation import get_user_school
        school = get_user_school(request.user)
        
        from apps.schools.models_programs import GradeConfiguration
        from apps.academics.models import Section
        
        grade_obj = GradeConfiguration.objects.filter(
            program__school=school,
            grade_name=grade_name
        ).first()
        
        section_obj = Section.objects.filter(
            school=school,
            grade_config=grade_obj,
            section_letter=section_letter
        ).first()
        
        if not grade_obj or not section_obj:
            return Response({'error': 'Selected Grade or Section does not exist in your school.'}, status=400)
            
        # Recreate User and Student
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        details = archive.admission_details
        username = details.get('username') or f"std_{archive.student_global_id.lower().replace('-', '_')}"
        email = details.get('email') or f"{username}@school-os.edu"
        
        # Get or create user
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': details.get('first_name', ''),
                'last_name': details.get('last_name', ''),
                'user_type': 'STUDENT'
            }
        )
        
        # Create Student profile
        from apps.students.models import Student, Guardian, StudentDocument
        
        student_defaults = {
            'user': user,
            'school': school,
            'admission_number': details.get('admission_number'),
            'date_of_birth': details.get('date_of_birth'),
            'gender': details.get('gender', 'M'),
            'blood_group': details.get('blood_group'),
            'medical_conditions': details.get('medical_conditions'),
            'emergency_contact_name': details.get('emergency_contact_name'),
            'emergency_contact_phone': details.get('emergency_contact_phone'),
            'address_line1': details.get('address_line1'),
            'address_line2': details.get('address_line2'),
            'city': details.get('city'),
            'state': details.get('state'),
            'pincode': details.get('pincode'),
            'status': 'TEMPORARY',
            'grade_config': grade_obj,
            'current_section': section_obj,
            'latitude': float(details.get('latitude')) if details.get('latitude') else None,
            'longitude': float(details.get('longitude')) if details.get('longitude') else None,
            'address': details.get('address'),
            'category': details.get('category'),
            'religion': details.get('religion'),
            'mother_tongue': details.get('mother_tongue'),
            'languages_known': details.get('languages_known'),
            'nationality': details.get('nationality', 'Indian'),
            'birth_place': details.get('birth_place'),
            'is_rte_student': details.get('is_rte_student', False),
            'fee_concession_applicable': details.get('fee_concession_applicable', False),
            'fee_concession_amount': float(details.get('fee_concession_amount')) if details.get('fee_concession_amount') else 0.0,
            'house_color': details.get('house_color'),
            'alumni_directory_consent': details.get('alumni_directory_consent', False),
            'aadhaar_number': details.get('aadhaar_number'),
            'aadhaar_last_4_digits': details.get('aadhaar_last_4_digits'),
            'apaar_id': details.get('apaar_id'),
            'pen_id': details.get('pen_id'),
            'dietary_preference': details.get('dietary_preference'),
            'phone': details.get('phone'),
        }
        
        student, created = Student.objects.get_or_create(
            suid=archive.student_global_id,
            defaults=student_defaults
        )
        
        if not created:
            for key, val in student_defaults.items():
                setattr(student, key, val)
            student.save()
            
        # Create/restore guardians
        for g_data in details.get('guardians', []):
            Guardian.objects.get_or_create(
                student=student,
                name=g_data.get('name'),
                relationship=g_data.get('relationship'),
                defaults={
                    'phone': g_data.get('phone', ''),
                    'email': g_data.get('email'),
                    'occupation': g_data.get('occupation'),
                    'workplace': g_data.get('workplace'),
                    'is_primary': g_data.get('is_primary', False),
                    'can_pickup': g_data.get('can_pickup', True)
                }
            )
            
        # Create/restore documents
        for doc_data in archive.documents:
            # Point to existing archived file paths in media storage
            file_path = doc_data.get('file_url', '').replace('/media/', '')
            StudentDocument.objects.get_or_create(
                student=student,
                document_type=doc_data.get('document_type'),
                title=doc_data.get('title'),
                defaults={
                    'file': file_path,
                    'academic_year': doc_data.get('academic_year')
                }
            )
            
        # Create StudentEnrollment
        from apps.enrollments.models import StudentEnrollment
        enrollment, _ = StudentEnrollment.objects.get_or_create(
            student=student,
            school=school,
            grade=grade_name,
            section=section_letter,
            defaults={
                'status': 'TEMPORARY',
                'academic_year': '2025-2026'
            }
        )
        if not _:
            enrollment.status = 'TEMPORARY'
            enrollment.save()

        # Restore timeline history to active timeline tables
        timeline_json = archive.timeline_data or {}
        
        # Restore TimelineMark records
        for mark_data in timeline_json.get('marks', []):
            m_obj, m_created = TimelineMark.objects.get_or_create(
                student_global_id=archive.student_global_id,
                grade=mark_data.get('grade'),
                subject=mark_data.get('subject'),
                exam_name=mark_data.get('exam_name'),
                defaults={
                    'marks_obtained': mark_data.get('marks_obtained'),
                    'total_marks': mark_data.get('total_marks'),
                    'passing_marks': mark_data.get('passing_marks'),
                    'is_pass': mark_data.get('is_pass', False),
                    'is_absent': mark_data.get('is_absent', False),
                    'attendance_percentage': mark_data.get('attendance_percentage'),
                    'days_present': mark_data.get('days_present'),
                    'total_days': mark_data.get('total_days'),
                }
            )
            if m_created and mark_data.get('recorded_at'):
                TimelineMark.objects.filter(id=m_obj.id).update(recorded_at=mark_data.get('recorded_at'))

        # Restore TimelineRemark records
        for rem_data in timeline_json.get('remarks', []):
            r_obj, r_created = TimelineRemark.objects.get_or_create(
                student_global_id=archive.student_global_id,
                grade=rem_data.get('grade'),
                record_type=rem_data.get('record_type'),
                title=rem_data.get('title'),
                defaults={
                    'description': rem_data.get('description', ''),
                    'points': rem_data.get('points'),
                    'teacher_name': rem_data.get('teacher_name', ''),
                }
            )
            if r_created and rem_data.get('recorded_at'):
                TimelineRemark.objects.filter(id=r_obj.id).update(recorded_at=rem_data.get('recorded_at'))

        # Restore TimelineHealth records
        for h_data in timeline_json.get('health', []):
            h_obj, h_created = TimelineHealth.objects.get_or_create(
                student_global_id=archive.student_global_id,
                visit_date=h_data.get('visit_date'),
                symptom=h_data.get('symptom'),
                defaults={
                    'treatment_given': h_data.get('treatment_given'),
                    'sent_home': h_data.get('sent_home', False),
                    'recorded_by': h_data.get('recorded_by'),
                }
            )
            if h_created and h_data.get('recorded_at'):
                TimelineHealth.objects.filter(id=h_obj.id).update(recorded_at=h_data.get('recorded_at'))
            
        # Update SchoolTenure records
        from django.utils import timezone
        from apps.students.models_tenure import SchoolTenure
        
        # Link previous active/completed tenures to the new school
        previous_tenures = SchoolTenure.objects.filter(
            student_global_id=archive.student_global_id,
            admitted_to_school_name=''
        ).exclude(status='ACTIVE')
        for pt in previous_tenures:
            pt.admitted_to_school_name = school.name
            pt.admitted_to_date = timezone.now().date()
            pt.save()
            
        # Create a new active tenure for the admitting school
        SchoolTenure.objects.create(
            student_global_id=archive.student_global_id,
            school=school,
            school_name=school.name,
            admitted_date=timezone.now().date(),
            grade_from=grade_name,
            grade_to=grade_name,
            status='ACTIVE'
        )

        # Retain the archive record, marking it as re-admitted
        archive.re_admitted = True
        archive.re_admitted_at = timezone.now().date()
        archive.re_admitted_to_school_name = school.name
        archive.save()
            
        return Response({'success': True, 'student_id': student.id})

