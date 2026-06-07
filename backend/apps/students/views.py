from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.http import HttpResponse
import csv

from .models import Student, Guardian, StudentDocument, StudentHistory
from .serializers import StudentSerializer, StudentDetailSerializer, GuardianSerializer, StudentHistorySerializer, StudentDocumentSerializer
from apps.features.permissions import can
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin
from apps.accounts.permission_utils import RBACPermission


class StudentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['current_section', 'grade_config', 'status']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'students'
    rbac_resource = 'student'
    rbac_action_permissions = {
        'profile': 'students.view_student',
        'history': 'students.view_student',
        'guardians': 'students.view_student',
        'export': 'students.export_student',
        'import_students': 'students.import_student',
    }
    
    def get_queryset(self):
        """Filter students by user's school."""
        queryset = Student.objects.select_related('user', 'grade_config', 'current_section')
        
        # Only Platform Admin sees everything
        if is_platform_admin(self.request.user):
            return queryset
            
        # Use SchoolIsolationMixin's helper
        school_filter = self.get_school_filter()
        return queryset.filter(**school_filter)

    # --- SECURITY: VIEWING SINGLE PROFILE ---
    def retrieve(self, request, *args, **kwargs):
        # Permission: School isolation mixin handles access control
        # School admins can view any student in their school
        # Platform admins can view any student
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    # --- SECURITY: VIEWING DIRECTORY ---
    def list(self, request, *args, **kwargs):
        # Permission: School isolation mixin filters by school
        # School admins see their school's students
        # Platform admins see all students
        return super().list(request, *args, **kwargs)

    # --- LOGIC: UPDATING PROFILE ---
    def update(self, request, *args, **kwargs):
        # The StudentSerializer.update() handles user identity fields (first_name,
        # last_name, phone_number) AND student profile fields (photo, address, etc.)
        # in a single atomic transaction. We just delegate to it directly.
        # 
        # partial=True is set automatically by DRF when the HTTP method is PATCH,
        # which allows sending only the fields being changed.
        return super().update(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def profile(self, request, pk=None):
        """Get complete student profile with all details"""
        student = self.get_object()
        serializer = StudentDetailSerializer(student, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get student's academic history across years"""
        student = self.get_object()
        history = StudentHistory.objects.filter(student=student).order_by('-academic_year_name')
        serializer = StudentHistorySerializer(history, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def guardians(self, request, pk=None):
        """Get student's guardians/parents"""
        student = self.get_object()
        guardians = Guardian.objects.filter(student=student)
        serializer = GuardianSerializer(guardians, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        """Bulk import students from JSON (parsed Excel data)"""
        students_data = request.data.get('students', [])
        if not students_data:
            return Response({'error': 'No student data provided.'}, status=400)
        
        school = get_user_school(request.user)
        if not school:
            return Response({'error': 'User not associated with a school.'}, status=403)

        success_count = 0
        errors = []

        from django.db import transaction
        from apps.accounts.models import User
        from apps.enrollments.models import StudentEnrollment, AcademicYear
        from apps.academics.models import Section
        from apps.schools.models_programs import GradeConfiguration

        # Get current academic year
        current_year = AcademicYear.objects.filter(school=school, status='ACTIVE').first()

        for idx, row in enumerate(students_data):
            try:
                # Clean keys (trim spaces)
                row = {str(k).strip(): v for k, v in row.items()}
                
                with transaction.atomic():
                    # Required fields
                    first_name = row.get('first_name')
                    email = row.get('email')
                    
                    if not first_name or not email:
                        errors.append({'row': idx + 1, 'error': 'First Name and Email are mandatory.'})
                        continue
                    
                    # Check if user already exists
                    if User.objects.filter(email=email).exists():
                        errors.append({'row': idx + 1, 'error': f'Email {email} already registered.'})
                        continue

                    # Create User
                    user = User.objects.create(
                        email=email,
                        user_type='STUDENT',
                        first_name=first_name,
                        last_name=row.get('last_name', ''),
                        phone_number=str(row.get('phone_number', row.get('phone', ''))).strip() or None,
                        school=school
                    )
                    user.set_password('Student@123')
                    user.save()
                    
                    # Create Student
                    student = Student.objects.create(
                        user=user,
                        school=school,
                        middle_name=row.get('middle_name', ''),
                        gender=row.get('gender', 'M'),
                        date_of_birth=row.get('date_of_birth') or None,
                        blood_group=row.get('blood_group', ''),
                        address_line1=row.get('address_line1', row.get('address', '')),
                        phone=str(row.get('phone', '')).strip(),
                        admission_number=row.get('admission_number', ''),
                        aadhaar_last_4_digits=str(row.get('aadhaar', ''))[-4:] if row.get('aadhaar') else None
                    )
                    
                    # Assign Grade/Section
                    grade_name = str(row.get('grade', '')).strip()
                    section_name = str(row.get('section', '')).strip()
                    
                    if grade_name:
                        grade_obj = GradeConfiguration.objects.filter(school=school, grade_name__iexact=grade_name).first()
                        if grade_obj:
                            student.grade_config = grade_obj
                            if section_name:
                                section_obj = Section.objects.filter(school=school, grade_config=grade_obj, section_letter__iexact=section_name).first()
                                if section_obj:
                                    student.current_section = section_obj
                            student.save()
                            
                            # Create Enrollment record
                            StudentEnrollment.objects.create(
                                student=student,
                                school=school,
                                academic_year=current_year.year_code if current_year else "2025-2026",
                                grade=grade_name,
                                section=section_name or 'A',
                                status='ACTIVE'
                            )
                        else:
                            errors.append({'row': idx + 1, 'error': f'Grade "{grade_name}" not found in school configuration. Student created but not enrolled.'})
                    
                    success_count += 1
            except Exception as e:
                errors.append({'row': idx + 1, 'error': str(e)})

        return Response({
            'success_count': success_count,
            'errors': errors
        })

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        """Upload a certificate or document for a student"""
        student = self.get_object()
        
        document_type = request.data.get('document_type', 'OTHER')
        title = request.data.get('title')
        file = request.FILES.get('file')
        
        if not title or not file:
            return Response({'error': 'Title and file are required.'}, status=400)
            
        document = StudentDocument.objects.create(
            student=student,
            document_type=document_type,
            title=title,
            file=file,
            notes=request.data.get('notes', '')
        )

        # Update student profile photo if the document is a photograph
        if document_type == 'PHOTO':
            student.profile_photo = file
            student.save()
        
        return Response({
            'id': document.id,
            'title': document.title,
            'document_type': document.document_type,
            'url': document.file.url
        }, status=201)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export students list as CSV/JSON"""
        print(f"DEBUG: Export action reached for user {request.user}")
        queryset = self.filter_queryset(self.get_queryset())
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        format_type = request.query_params.get('format', 'csv').lower()
        
        if start_date and end_date:
            queryset = queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        
        if format_type == 'json':
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        
        # Default to CSV
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="students_list.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Admission No', 'SUID', 'First Name', 'Last Name', 'Email', 'Grade', 'Section', 'Gender', 'Phone', 'Status'])
        
        for student in queryset:
            writer.writerow([
                student.admission_number,
                student.suid,
                student.user.first_name,
                student.user.last_name,
                student.user.email,
                student.grade_config.grade_name if student.grade_config else '',
                student.current_section.section_letter if student.current_section else '',
                student.gender,
                student.phone,
                student.status
            ])
        
        return response



# View for teachers to see their remarks
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.teachers.models import Teacher

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_remarks(request):
    """
    Get all remarks made by the logged-in teacher across years.
    This allows teachers to see their feedback history.
    """
    try:
        teacher = Teacher.objects.get(user=request.user)
    except Teacher.DoesNotExist:
        return Response({'error': 'Not a teacher'}, status=403)
    
    # Get all history records where this teacher gave remarks
    remarks = StudentHistory.objects.filter(
        class_teacher=teacher,
        teacher_remarks__isnull=False
    ).exclude(teacher_remarks='').select_related('student', 'student__user').order_by('-academic_year_name')
    
    data = [{
        'id': str(r.id),
        'student_id': r.student.id,
        'student_name': r.student.full_name_display,
        'student_photo': r.student.profile_photo.url if r.student.profile_photo else None,
        'grade_name': r.grade_name,
        'section_name': r.section_name,
        'academic_year': r.academic_year_name,
        'remarks': r.teacher_remarks,
        'remarks_date': r.remarks_date.isoformat() if r.remarks_date else None,
        'overall_grade': r.overall_grade,
        'class_rank': r.class_rank,
        'percentage': str(r.percentage) if r.percentage else None,
    } for r in remarks]
    
    return Response({
        'count': len(data),
        'remarks': data
    })