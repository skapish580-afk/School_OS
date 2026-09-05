from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.http import HttpResponse
from django.db.models import Q
import csv
import random
import string


def generate_student_password():
    """
    Generate 10-char password: at least 3 alphabets (both upper & lower), 4 digits, 3 special chars.
    """
    lower_count = random.choice([1, 2])
    upper_count = 3 - lower_count

    lowers = [random.choice(string.ascii_lowercase) for _ in range(lower_count)]
    uppers = [random.choice(string.ascii_uppercase) for _ in range(upper_count)]
    digits = [random.choice(string.digits) for _ in range(4)]
    specials = [random.choice('@#$%&*!?') for _ in range(3)]

    pwd_chars = lowers + uppers + digits + specials
    random.shuffle(pwd_chars)
    return ''.join(pwd_chars)


from .models import Student, Guardian, StudentDocument, StudentHistory
from .serializers import StudentSerializer, StudentDetailSerializer, GuardianSerializer, StudentHistorySerializer, StudentDocumentSerializer
from apps.features.permissions import can
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin
from apps.accounts.permission_utils import RBACPermission


from rest_framework import permissions

class StudentActionPermission(permissions.BasePermission):
    """
    Custom permission for StudentViewSet.
    - create: students.add_student
    - update, partial_update: students.edit_profile
    - destroy: students.hide_student
    - list, retrieve: any of view_student_only, view_profile, view_journey, view_health
    - profile: students.view_profile
    - history, cross_school_history: students.view_journey
    - guardians: students.view_profile or students.view_student_only
    - confirm_admission: students.edit_profile
    - others: requires admin
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True

        if user.user_type == 'STUDENT':
            if request.method in permissions.SAFE_METHODS or view.action in ['list', 'retrieve', 'profile', 'history', 'cross_school_history', 'guardians']:
                return True
            
        from apps.accounts.permission_utils import has_permission

        
        action = view.action
        
        if action == 'create':
            return has_permission(user, 'students.add_student')
        elif action in ['update', 'partial_update', 'confirm_admission']:
            if action == 'partial_update' and set(request.data.keys()) == {'status'} and has_permission(user, 'enrollments.change_enrollment_status'):
                return True
            return user.user_type == 'TEACHER' or hasattr(user, 'teacher_profile') or has_permission(user, 'students.edit_profile')
        elif action == 'destroy':
            return has_permission(user, 'students.hide_student')
        elif action in ['list', 'retrieve']:
            return (
                has_permission(user, 'students.view_student_only') or
                has_permission(user, 'students.view_profile') or
                has_permission(user, 'students.view_journey') or
                has_permission(user, 'students.view_health')
            )
        elif action == 'profile':
            return has_permission(user, 'students.view_profile')
        elif action in ['history', 'cross_school_history']:
            return has_permission(user, 'students.view_journey')
        elif action == 'guardians':
            return (
                has_permission(user, 'students.view_profile') or
                has_permission(user, 'students.view_student_only')
            )
        
        return False

    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False
        return True



class StudentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, StudentActionPermission]
    filterset_fields = []
    def get_object(self):
        pk = self.kwargs.get('pk')
        if pk and not str(pk).isdigit():
            queryset = self.filter_queryset(self.get_queryset())
            obj = queryset.filter(suid=pk).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        return super().get_object()

    def get_queryset(self):
        """Filter students by user's school and query params."""
        queryset = Student.objects.select_related('user', 'grade_config', 'current_section')
        
        # Only Platform Admin sees everything
        if not is_platform_admin(self.request.user):
            school_filter = self.get_school_filter()
            queryset = queryset.filter(**school_filter)
            
        # Manual filtering to support ACTIVE + TEMPORARY (defaults to ACTIVE)
        status = self.request.query_params.get('status', 'ACTIVE')
        if status != 'ALL':
            if status == 'ACTIVE':
                queryset = queryset.filter(status__in=['ACTIVE', 'TEMPORARY'])
            else:
                queryset = queryset.filter(status=status)
                
        suid = self.request.query_params.get('suid')
        if suid:
            queryset = queryset.filter(suid=suid)
                
        grade_config = self.request.query_params.get('grade_config')
        if grade_config:
            queryset = queryset.filter(grade_config_id=grade_config)
            
        current_section = self.request.query_params.get('current_section')
        if current_section:
            queryset = queryset.filter(current_section_id=current_section)
            
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(enrollments__academic_year=academic_year).distinct()

        return queryset

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
    def cross_school_history(self, request, pk=None):
        """Get student's cross-school history (tenures)"""
        student = self.get_object()
        from apps.students.models_tenure import SchoolTenure
        from apps.students.serializers import SchoolTenureSerializer
        tenures = SchoolTenure.objects.filter(student_global_id=student.suid).order_by('admitted_date')
        serializer = SchoolTenureSerializer(tenures, many=True)
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
        if current_year:
            current_year_code = current_year.year_code
        else:
            try:
                from apps.schools.models_settings import SchoolSettings
                settings_obj = SchoolSettings.objects.filter(school=school).first()
                current_year_code = settings_obj.get_academic_year_code_for_date() if settings_obj else ''
            except Exception:
                current_year_code = ''

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
                                academic_year=current_year_code,
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

    @action(detail=True, methods=['post'])
    def delete_document(self, request, pk=None):
        """Delete a student document by document ID"""
        student = self.get_object()
        doc_id = request.data.get('document_id')
        if not doc_id:
            return Response({'error': 'document_id is required.'}, status=400)
        try:
            document = StudentDocument.objects.get(id=doc_id, student=student)
            document.delete()
            return Response({'status': 'Document deleted successfully'}, status=200)
        except StudentDocument.DoesNotExist:
            return Response({'error': 'Document not found or does not belong to this student.'}, status=404)

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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def confirm_admission(self, request, pk=None):
        student = self.get_object()
        if student.status != 'TEMPORARY':
            return Response({'error': 'Student admission is already confirmed or student is not temporary.'}, status=400)
            
        # Check required details/fields
        missing_details = []
        if not student.user.first_name:
            missing_details.append("First Name")
        if not student.user.email:
            missing_details.append("Email")
        if not student.date_of_birth:
            missing_details.append("Date of Birth")
        if not student.address and not student.address_line1:
            missing_details.append("Address")
        if student.latitude is None:
            missing_details.append("Latitude")
        if student.longitude is None:
            missing_details.append("Longitude")
            
        if missing_details:
            return Response({
                'error': f"Cannot confirm admission. Required details are missing: {', '.join(missing_details)}"
            }, status=400)
            
        # Check required documents
        required_types = ['BIRTH_CERTIFICATE']
        existing_types = student.documents.values_list('document_type', flat=True)
        missing_docs = [t for t in required_types if t not in existing_types]
        
        if missing_docs:
            missing_names = [dict(StudentDocument.DOCUMENT_TYPES).get(t, t) for t in missing_docs]
            return Response({
                'error': f"Cannot confirm admission. All required documents must be uploaded. Missing: {', '.join(missing_names)}"
            }, status=400)
            
        # Set status to ACTIVE
        student.status = 'ACTIVE'
        student.save()
        
        # Update enrollment status to ACTIVE
        from apps.enrollments.models import StudentEnrollment
        StudentEnrollment.objects.filter(student=student, status='TEMPORARY').update(status='ACTIVE')
        
        return Response({'success': True, 'status': 'ACTIVE'})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def register_batch(self, request):
        """
        Batch register credentials (username & password) for active students.
        Username = SUID. Password = randomly generated 10-char password (3 alphabets upper/lower, 4 numbers, 3 special chars).
        Returns list of student credential records for CSV export.
        """
        user_school = get_user_school(request.user)
        if is_platform_admin(request.user):
            students = Student.objects.filter(status='ACTIVE')
        elif user_school:
            students = Student.objects.filter(
                Q(school_id=user_school.id) | Q(user__school_id=user_school.id),
                status='ACTIVE'
            ).distinct()
        else:
            students = Student.objects.none()


        records = []
        for s in students:
            user = s.user
            suid = s.suid or (getattr(user, 'email', '') if user else f"STUDENT-{s.id}")
            pwd = generate_student_password()
            if user:
                user.set_password(pwd)
                user.user_type = 'STUDENT'
                user.is_active = True
                user.save()



            # Determine grade & section safely across models and enrollments
            grade_val = None
            section_val = None

            enrollment = s.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY']).first()
            if enrollment:
                grade_val = enrollment.grade
                section_val = enrollment.section

            if not grade_val and getattr(s, 'current_section', None):
                if s.current_section.grade_config:
                    grade_val = s.current_section.grade_config.grade_name
                section_val = s.current_section.section_letter

            if not grade_val and getattr(s, 'grade_config', None):
                grade_val = s.grade_config.grade_name

            grade = str(grade_val).strip() if grade_val else 'N/A'
            section = str(section_val).strip() if section_val else 'A'

            if grade == 'N/A' or not grade:
                grade_section = "N-A"
            else:
                grade_section = f"{grade}-{section}"


            student_name = ""
            if user:
                student_name = user.get_full_name().strip()
            if not student_name:
                student_name = getattr(s, 'full_name_display', '') or getattr(s, 'full_name', '') or suid

            records.append({
                'id': s.id,
                'suid': suid,
                'full_name': student_name,
                'grade': str(grade),
                'section': str(section),
                'grade_section': grade_section,
                'username': suid,
                'password': pwd
            })


        return Response({
            'success': True,
            'count': len(records),
            'students': records
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request, pk=None):
        """
        Change/reset password for an individual student.
        """
        student = self.get_object()
        new_password = request.data.get('password', '').strip()

        if not new_password:
            new_password = generate_student_password()

        user = student.user
        if not user:
            return Response({'error': 'Student has no associated user account.'}, status=400)

        user.set_password(new_password)
        user.user_type = 'STUDENT'
        user.is_active = True
        user.save()


        return Response({
            'success': True,
            'message': f'Password updated successfully for {student.suid}',
            'username': student.suid,
            'password': new_password
        })





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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_profile(request):
    """
    Get current logged in student profile details.
    """
    user = request.user
    student = Student.objects.filter(user=user).first()
    if not student:
        student = Student.objects.filter(suid__iexact=user.username).first()
    
    if student:
        serializer = StudentSerializer(student)
        data = serializer.data
        data['suid'] = student.suid
        data['full_name'] = student.user.get_full_name() or student.user.username
        data['first_name'] = student.user.first_name
        data['last_name'] = student.user.last_name
        data['email'] = student.user.email
        return Response(data)
    
    return Response({
        'id': user.id,
        'full_name': user.get_full_name() or user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'suid': user.username,
        'role': 'STUDENT',
        'status': 'ACTIVE'
    })