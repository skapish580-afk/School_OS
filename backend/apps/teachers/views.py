from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Teacher, TeacherSchoolAssociation, TeacherAssignment, Remark, TeacherDocument
from .serializers import TeacherSerializer, TeacherSchoolAssociationSerializer, TeacherAssignmentSerializer, RemarkSerializer
from apps.students.models import Student
from apps.students.serializers import StudentSerializer
from apps.accounts.permission_utils import RBACPermission


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def teacher_profile(request):
    """Get current teacher's profile (view-only for teachers)"""
    try:
        from apps.accounts.permission_utils import get_teacher_for_user
        teacher = get_teacher_for_user(request.user)
        if not teacher:
            teacher = Teacher.objects.filter(user=request.user).first()
        if not teacher:
            teacher = Teacher.objects.filter(user__email__iexact=request.user.email).first()

        if not teacher:
            return Response(
                {'error': 'Teacher profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if request.method == 'GET':
            serializer = TeacherSerializer(teacher, context={'request': request})
            return Response(serializer.data)
        
        elif request.method in ['PUT', 'PATCH']:
            if request.user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
                return Response(
                    {'detail': 'Profile details are view-only and can only be updated by the School Admin in the Teachers module.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            partial = request.method == 'PATCH'
            serializer = TeacherSerializer(teacher, data=request.data, partial=partial, context={'request': request})
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_detail(request, student_id):
    """Get student details - for teachers to view their students"""
    try:
        from apps.attendance.models import StudentAttendance
        from apps.discipline.models import StudentKarma
        from django.db.models import Count, Q
        from datetime import datetime, timedelta
        
        teacher = Teacher.objects.get(user=request.user)
        student = Student.objects.get(id=student_id)
        
        # Verify teacher has access to this student
        # (student is in one of teacher's classes)
        teacher_assignments = TeacherAssignment.objects.filter(
            teacher=teacher,
            is_active=True
        )
        
        has_access = False
        student_enrollment = None
        for assignment in teacher_assignments:
            enrollment = student.enrollments.filter(
                grade=assignment.grade,
                section=assignment.section,
                status='ACTIVE'
            ).first()
            if enrollment:
                has_access = True
                student_enrollment = enrollment
                break
        
        if not has_access:
            return Response(
                {'error': 'You do not have access to this student'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get student data
        student_data = {
            'id': str(student.id),
            'full_name': student.user.full_name,
            'suid': student.suid,
            'email': student.user.email,
            'grade': student_enrollment.grade if student_enrollment else '',
            'section': student_enrollment.section if student_enrollment else '',
            'roll_number': student_enrollment.roll_number if student_enrollment else '',
            'photo': student.profile_photo.url if student.profile_photo else None,
        }
        
        # Get attendance stats (last 30 days)
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        from apps.schools.models_calendar import Holiday
        holiday_dates = Holiday.objects.filter(school=student.school).values_list('date', flat=True)
        attendance_records = StudentAttendance.objects.filter(
            student=student,
            session__date__gte=thirty_days_ago  # Access date through session relationship
        ).exclude(
            session__date__week_day=1
        ).exclude(
            session__date__in=holiday_dates
        )
        
        total_days = attendance_records.count()
        present_count = attendance_records.filter(status='PRESENT').count()
        late_count = attendance_records.filter(status='LATE').count()
        absent_count = attendance_records.filter(status='ABSENT').count()
        
        attendance_data = {
            'total_days': total_days,
            'present': present_count,
            'late': late_count,
            'absent': absent_count,
            'percentage': round((present_count + late_count) / total_days * 100, 1) if total_days > 0 else 0
        }
        
        # Get karma/discipline data
        try:
            karma_records = StudentKarma.objects.filter(student=student)
            positive_total = sum(k.points for k in karma_records if k.type == 'POSITIVE')
            negative_total = sum(abs(k.points) for k in karma_records if k.type == 'NEGATIVE')
            
            karma_data = {
                'positive_total': positive_total,
                'negative_total': negative_total,
                'net_score': positive_total - negative_total,
                'recent_records': []
            }
        except Exception:
            # Karma system might not be set up yet
            karma_data = {
                'positive_total': 0,
                'negative_total': 0,
                'net_score': 0,
                'recent_records': []
            }
        
        # Get academic performance from ReportCard
        from apps.academics.models import ReportCard
        
        academic_data = {
            'rank': None,
            'percentage': 0.0,
            'total_marks': None,
        }
        
        try:
            # Get the latest report card for this student
            report_card = ReportCard.objects.filter(
                student=student,
                academic_year='2026-2027'
            ).order_by('-generated_date').first()
            
            if report_card:
                academic_data['rank'] = report_card.rank
                academic_data['percentage'] = float(report_card.percentage)
                academic_data['total_marks'] = float(report_card.total_marks_obtained)
        except Exception as e:
            print(f"Error fetching report card: {e}")
            pass  # Use defaults if error occurs
        
        # Response
        return Response({
            'student': student_data,
            'attendance': attendance_data,
            'karma': karma_data,
            'academic': academic_data
        })
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Student.DoesNotExist:
        return Response(
            {'error': 'Student not found'},
            status=status.HTTP_404_NOT_FOUND
        )

from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin

class TeacherActionPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        from apps.accounts.permission_utils import has_permission
        
        action = view.action
        
        # 1. Create actions (Add Staff)
        if action in ['create', 'onboard', 'bulk_import']:
            teacher_type = request.data.get('teacher_type', 'TEACHING')
            if teacher_type == 'TEACHING':
                return has_permission(user, 'teachers.manage_teaching')
            else:
                return has_permission(user, 'teachers.manage_non_teaching')
                
        # 2. Update actions
        elif action in ['update', 'partial_update', 'register_credentials']:
            return True
            
        # 3. Destroy actions
        elif action == 'destroy':
            return True
            
        # 4. List / View actions
        elif action in ['list', 'retrieve', 'history']:
            return (
                has_permission(user, 'teachers.view_teaching') or
                has_permission(user, 'teachers.view_non_teaching')
            )
            
        return False
        
    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False

        user = request.user
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True

            
        from apps.accounts.permission_utils import has_permission
        
        action = view.action
        teacher_type = obj.teacher_type
        
        # View check
        if action in ['retrieve', 'history']:
            if teacher_type == 'TEACHING':
                return has_permission(user, 'teachers.view_teaching')
            else:
                return has_permission(user, 'teachers.view_non_teaching')
                
        # Update check
        elif action in ['update', 'partial_update', 'register_credentials']:
            if teacher_type == 'TEACHING':
                return has_permission(user, 'teachers.manage_teaching') or has_permission(user, 'teachers.assign_role_teaching')
            else:
                return has_permission(user, 'teachers.manage_non_teaching')
                
        # Delete check
        elif action == 'destroy':
            if teacher_type == 'TEACHING':
                return has_permission(user, 'teachers.manage_teaching')
            else:
                return has_permission(user, 'teachers.manage_non_teaching')
                
        return False


class TeacherAssociationPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        from apps.accounts.permission_utils import has_permission
        
        action = view.action
        if action in ['list', 'retrieve']:
            return (
                has_permission(user, 'teachers.view_teaching') or
                has_permission(user, 'teachers.view_non_teaching')
            )
            
        # Write actions on associations (manage)
        return (
            has_permission(user, 'teachers.manage_teaching') or
            has_permission(user, 'teachers.manage_non_teaching')
        )


class TeacherAssignmentPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        from apps.accounts.permission_utils import has_permission
        
        action = view.action
        if action in ['list', 'retrieve']:
            return (
                has_permission(user, 'teachers.view_teaching') or
                has_permission(user, 'teachers.view_non_teaching') or
                has_permission(user, 'academics.view_exam') or
                has_permission(user, 'academics.add_exam')
            )
            
        # Write actions on assignments
        if action == 'destroy':
            return has_permission(user, 'teachers.delete_assigned_role')
            
        return (
            has_permission(user, 'teachers.assign_role_teaching') or
            has_permission(user, 'teachers.assign_role_non_teaching')
        )


class TeacherViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [permissions.IsAuthenticated, TeacherActionPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    school_field = 'school_associations__school'
    
    # RBAC Configuration
    rbac_module = 'teachers'
    rbac_resource = 'teacher'
    rbac_action_permissions = {
        'history': 'teachers.view_teaching',  # Overridden by has_permission/has_object_permission
        'bulk_import': 'teachers.manage_teaching',
        'onboard': 'teachers.manage_teaching',
        'upload_photo': 'teachers.manage_teaching',
    }

    @action(detail=True, methods=['post', 'patch'], parser_classes=[MultiPartParser, FormParser])
    def upload_photo(self, request, pk=None):
        """Upload / update teacher profile photo."""
        teacher = self.get_object()
        photo_file = request.FILES.get('photo') or request.FILES.get('file') or request.FILES.get('profile_photo')
        if not photo_file:
            return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        teacher.photo = photo_file
        teacher.save()
        serializer = self.get_serializer(teacher)
        return Response(serializer.data)

    def get_queryset(self):
        """Filter teachers by user's school."""
        queryset = Teacher.objects.select_related('user').prefetch_related('school_associations')
        
        teacher_type = self.request.query_params.get('teacher_type')
        if teacher_type:
            queryset = queryset.filter(teacher_type=teacher_type)
            
        # Filter available class teachers
        available_class_teacher = self.request.query_params.get('available_as_class_teacher')
        if available_class_teacher and available_class_teacher.lower() == 'true':
            from apps.teachers.models import TeacherAssignment
            from apps.teachers.signals import get_active_academic_year_code
            from apps.core.school_isolation import get_user_school
            
            school = get_user_school(self.request.user)
            active_year = get_active_academic_year_code(school)
            
            # Find all teachers assigned as active class teachers for the active year
            assigned_teachers = TeacherAssignment.objects.filter(
                school=school,
                role='CLASS_TEACHER',
                academic_year=active_year,
                is_active=True
            )
            
            exclude_section_id = self.request.query_params.get('exclude_section')
            if exclude_section_id:
                from apps.academics.models import Section
                try:
                    section = Section.objects.get(id=exclude_section_id)
                    if section.class_teacher:
                        assigned_teachers = assigned_teachers.exclude(teacher=section.class_teacher)
                except Section.DoesNotExist:
                    pass
            
            assigned_teacher_ids = assigned_teachers.values_list('teacher_id', flat=True)
            queryset = queryset.exclude(id__in=assigned_teacher_ids)

        # Apply school isolation filtering
        if is_platform_admin(self.request.user):
            pass
        else:
            school_filter = self.get_school_filter()
            queryset = queryset.filter(**school_filter).distinct()
            
        # Check permissions for teaching / non-teaching staff
        user = self.request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import has_permission
            can_view_teaching = has_permission(user, 'teachers.view_teaching')
            can_view_non_teaching = has_permission(user, 'teachers.view_non_teaching')
            
            if can_view_teaching and can_view_non_teaching:
                pass
            elif can_view_teaching:
                queryset = queryset.filter(teacher_type='TEACHING')
            elif can_view_non_teaching:
                queryset = queryset.filter(teacher_type='NON_TEACHING')
            else:
                queryset = queryset.none()
                
        return queryset
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get complete employment history for a teacher"""
        teacher = self.get_object()
        associations = TeacherSchoolAssociation.objects.filter(teacher=teacher)
        serializer = TeacherSchoolAssociationSerializer(associations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        """Bulk import teachers from JSON (parsed Excel data)"""
        teachers_data = request.data.get('teachers', [])
        if not teachers_data:
            return Response({'error': 'No teacher data provided.'}, status=400)
        
        from apps.core.school_isolation import get_user_school
        school = get_user_school(request.user)
        if not school:
            return Response({'error': 'User not associated with a school.'}, status=403)

        success_count = 0
        errors = []

        from django.db import transaction
        from apps.accounts.models import User
        from .models import Teacher, TeacherSchoolAssociation
        from django.utils import timezone

        for idx, row in enumerate(teachers_data):
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
                        # If user exists, check if they are already a teacher
                        user = User.objects.get(email=email)
                        if Teacher.objects.filter(user=user).exists():
                            teacher = Teacher.objects.get(user=user)
                            # Check if already associated with this school
                            if TeacherSchoolAssociation.objects.filter(teacher=teacher, school=school, status='ACTIVE').exists():
                                errors.append({'row': idx + 1, 'error': f'Teacher with email {email} is already active in this school.'})
                                continue
                            else:
                                # Associate existing teacher with this school
                                TeacherSchoolAssociation.objects.create(
                                    teacher=teacher,
                                    school=school,
                                    joining_date=row.get('joining_date') or timezone.now().date(),
                                    employment_type=row.get('employment_type', 'FULL_TIME'),
                                    status='ACTIVE'
                                )
                                success_count += 1
                                continue
                        else:
                            errors.append({'row': idx + 1, 'error': f'Email {email} is already used by another user type.'})
                            continue

                    # Create User
                    user = User.objects.create(
                        email=email,
                        user_type='TEACHER',
                        first_name=first_name,
                        last_name=row.get('last_name', ''),
                        phone_number=str(row.get('phone_number', row.get('phone', ''))).strip() or None,
                        school=school
                    )
                    user.set_password('Teacher@123')
                    user.save()
                    
                    # Create Teacher
                    teacher = Teacher.objects.create(
                        user=user,
                        gender=row.get('gender', 'O'),
                        date_of_birth=row.get('date_of_birth') or None,
                        blood_group=row.get('blood_group', ''),
                        qualifications=row.get('qualifications', ''),
                        certified_subjects=row.get('certified_subjects', ''),
                        experience_years=int(row.get('experience_years', 0)) if row.get('experience_years') else 0,
                    )
                    
                    # Create School Association
                    TeacherSchoolAssociation.objects.create(
                        teacher=teacher,
                        school=school,
                        joining_date=row.get('joining_date') or timezone.now().date(),
                        employment_type=row.get('employment_type', 'FULL_TIME'),
                        status='ACTIVE'
                    )
                    
                    success_count += 1
            except Exception as e:
                errors.append({'row': idx + 1, 'error': str(e)})

        return Response({
            'success_count': success_count,
            'errors': errors
        })

    @action(detail=False, methods=['post'])
    def onboard(self, request):
        """Directly onboard a single teacher"""
        data = request.data
        email = data.get('email')
        full_name = data.get('full_name', '')
        phone = data.get('phone', '')
        
        if not email or not full_name:
            return Response({'error': 'Email and Full Name are mandatory.'}, status=400)
            
        from apps.core.school_isolation import get_user_school
        school = get_user_school(request.user)
        if not school:
            return Response({'error': 'User not associated with a school.'}, status=403)

        from apps.accounts.models import User
        from .models import Teacher, TeacherSchoolAssociation
        from django.db import transaction
        from django.utils import timezone

        # Split full name
        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        try:
            with transaction.atomic():
                # 1. Create or Get User
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'user_type': 'TEACHER',
                        'first_name': first_name,
                        'last_name': last_name,
                        'phone_number': phone,
                        'school': school
                    }
                )
                
                if created:
                    user.set_password('Teacher@123')
                    user.save()
                elif user.user_type != 'TEACHER':
                    return Response({'error': 'Email already used by another user type.'}, status=400)

                salary_val = data.get('salary')
                if salary_val == '' or salary_val is None:
                    salary_val = None
                else:
                    try:
                        salary_val = float(salary_val)
                    except ValueError:
                        salary_val = None

                # 2. Create or Get Teacher Profile
                teacher, t_created = Teacher.objects.get_or_create(
                    user=user,
                    defaults={
                        'title': data.get('title', 'Mr.'),
                        'date_of_birth': data.get('date_of_birth') or None,
                        'gender': data.get('gender', 'O'),
                        'marital_status': data.get('marital_status', ''),
                        'place_of_birth': data.get('place_of_birth', ''),
                        'blood_group': data.get('blood_group', ''),
                        'emergency_contact_phone': data.get('emergency_contact_phone', ''),
                        'address': data.get('address', ''),
                        'aadhaar_last_4_digits': data.get('aadhaar_last_4_digits', ''),
                        'pan_number': data.get('pan_number', ''),
                        'dietary_preference': data.get('dietary_preference', ''),
                        'qualifications': data.get('qualifications', ''),
                        'certified_subjects': data.get('certified_subjects', ''),
                        'experience_years': int(data.get('experience_years')) if (data.get('experience_years') is not None and str(data.get('experience_years')).strip() != '') else 0,
                        'salary': salary_val,
                        'date_of_joining': data.get('date_of_joining') or None,
                        'teacher_type': data.get('teacher_type', 'TEACHING'),
                    }
                )
                
                if not t_created:
                    # Update existing profile
                    teacher.title = data.get('title', teacher.title)
                    teacher.date_of_birth = data.get('date_of_birth') or teacher.date_of_birth
                    teacher.gender = data.get('gender', teacher.gender)
                    teacher.marital_status = data.get('marital_status', teacher.marital_status)
                    teacher.place_of_birth = data.get('place_of_birth', teacher.place_of_birth)
                    teacher.blood_group = data.get('blood_group', teacher.blood_group)
                    teacher.emergency_contact_phone = data.get('emergency_contact_phone', teacher.emergency_contact_phone)
                    teacher.address = data.get('address', teacher.address)
                    teacher.aadhaar_last_4_digits = data.get('aadhaar_last_4_digits', teacher.aadhaar_last_4_digits)
                    teacher.pan_number = data.get('pan_number', teacher.pan_number)
                    teacher.dietary_preference = data.get('dietary_preference', teacher.dietary_preference)
                    teacher.qualifications = data.get('qualifications', teacher.qualifications)
                    teacher.certified_subjects = data.get('certified_subjects', teacher.certified_subjects)
                    if data.get('experience_years') is not None and str(data.get('experience_years')).strip() != '':
                        try:
                            teacher.experience_years = int(data.get('experience_years'))
                        except (ValueError, TypeError):
                            pass
                    if salary_val is not None:
                        teacher.salary = salary_val
                    teacher.date_of_joining = data.get('date_of_joining') or teacher.date_of_joining
                    if 'teacher_type' in data:
                        teacher.teacher_type = data.get('teacher_type')
                    teacher.save()

                # 3. Create School Association if not exists
                joining_date_val = data.get('date_of_joining') or data.get('joining_date') or timezone.now().date()
                association, a_created = TeacherSchoolAssociation.objects.get_or_create(
                    teacher=teacher,
                    school=school,
                    defaults={
                        'joining_date': joining_date_val,
                        'employment_type': 'FULL_TIME',
                        'status': 'ACTIVE'
                    }
                )
                
                if not a_created:
                    if association.status != 'ACTIVE':
                        association.status = 'ACTIVE'
                    if data.get('date_of_joining') or data.get('joining_date'):
                        association.joining_date = joining_date_val
                    association.save()
                
                # 4. Save documents if present
                doc_resume = request.FILES.get('doc_resume')
                doc_id_proof = request.FILES.get('doc_id_proof')
                doc_qualification = request.FILES.get('doc_qualification')
                
                if doc_resume:
                    TeacherDocument.objects.create(
                        teacher=teacher,
                        document_type='RESUME',
                        title='Resume/CV',
                        file=doc_resume
                    )
                if doc_id_proof:
                    TeacherDocument.objects.create(
                        teacher=teacher,
                        document_type='ID_PROOF',
                        title='ID Proof',
                        file=doc_id_proof
                    )
                    # Auto-verify the teacher if ID proof is submitted
                    teacher.verification_status = 'VERIFIED'
                    teacher.save()
                    
                if doc_qualification:
                    TeacherDocument.objects.create(
                        teacher=teacher,
                        document_type='QUALIFICATION_CERTIFICATE',
                        title='Qualification Certificate',
                        file=doc_qualification
                    )
                
                # Custom documents
                custom_files = request.FILES.getlist('custom_doc_files')
                custom_titles = request.data.getlist('custom_doc_titles')
                has_custom_id_proof = False
                for title, file in zip(custom_titles, custom_files):
                    if title and file:
                        TeacherDocument.objects.create(
                            teacher=teacher,
                            document_type='OTHER',
                            title=title,
                            file=file
                        )
                        title_lower = title.lower()
                        if 'id' in title_lower or 'aadhaar' in title_lower or 'pan' in title_lower or 'passport' in title_lower:
                            has_custom_id_proof = True
                
                if has_custom_id_proof:
                    teacher.verification_status = 'VERIFIED'
                    teacher.save()

                serializer = TeacherSerializer(teacher)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post', 'patch'])
    def register_credentials(self, request, pk=None):
        """
        Register credentials (Username, Password, Hierarchy Level) for a teaching staff member.
        Only when all three fields are provided, he/she's account is registered.
        """
        teacher = self.get_object()
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        hierarchy_level = request.data.get('hierarchy_level')

        if not username or not password or hierarchy_level is None or str(hierarchy_level).strip() == '':
            return Response(
                {'error': 'All three fields (Username, Password, and Hierarchy Level) must be provided to register the teaching staff account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            hierarchy_level = int(hierarchy_level)
            if not (1 <= hierarchy_level <= 100):
                return Response(
                    {'error': 'Hierarchy Level must be an integer between 1 and 100.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Hierarchy Level must be a valid integer between 1 and 100.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.accounts.rbac_models import Role, UserRole
        from apps.core.school_isolation import get_user_school
        
        school = None
        assoc = teacher.school_associations.filter(status='ACTIVE').first()
        if assoc:
            school = assoc.school
        if not school:
            school = getattr(teacher.user, 'school', None)
        if not school:
            school = get_user_school(request.user)

        user = teacher.user
        if school and user.school != school:
            user.school = school
            user.save(update_fields=['school'])

        # Get existing role for user in this specific school if any
        current_role = Role.objects.filter(school=school, associated_user=user).first()
        if not current_role:
            user_role_assignment = UserRole.objects.filter(user=user, school=school, is_active=True).first()
            current_role = user_role_assignment.role if user_role_assignment else None

        # Check if username is taken by another Role in this school
        existing_role = Role.objects.filter(school=school, username__iexact=username).first()
        if existing_role and (not current_role or existing_role.id != current_role.id):
            return Response(
                {'error': f"Username '{username}' is already in use by another role in this school."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update teacher user password, active status, and school
        user.set_password(password)
        user.is_active = True
        if school:
            user.school = school
        user.save()

        # Update or create the Role instance for this school
        role_name = f"Teacher: {user.first_name} {user.last_name}".strip() or f"Teacher {teacher.tuid}"
        if not current_role or current_role.school != school:
            role = Role.objects.create(
                school=school,
                name=role_name,
                hierarchy_level=hierarchy_level,
                username=username,
                plain_password=password,
                created_by=request.user,
                associated_user=user
            )
            UserRole.objects.filter(user=user, school=school).delete()
            UserRole.objects.create(
                user=user,
                role=role,
                school=school,
                is_active=True,
                is_primary=True
            )
        else:
            role = current_role
            role.school = school
            role.hierarchy_level = hierarchy_level
            role.username = username
            role.plain_password = password
            role.associated_user = user
            role.save()

            ur = UserRole.objects.filter(user=user, school=school, is_active=True).first()
            if not ur:
                UserRole.objects.create(
                    user=user,
                    role=role,
                    school=school,
                    is_active=True,
                    is_primary=True
                )

        teacher.verification_status = 'VERIFIED'
        teacher.save(update_fields=['verification_status'])

        return Response({
            'status': 'Teaching staff account credentials registered successfully',
            'username': role.username,
            'hierarchy_level': role.hierarchy_level,
            'is_registered': True
        })

    @action(detail=True, methods=['post'])
    def delete_document(self, request, pk=None):
        """Delete a teacher document by document ID"""
        teacher = self.get_object()
        doc_id = request.data.get('document_id')
        if not doc_id:
            return Response({'error': 'document_id is required.'}, status=400)
        try:
            document = TeacherDocument.objects.get(id=doc_id, teacher=teacher)
            document.delete()
            return Response({'status': 'Document deleted successfully'}, status=200)
        except TeacherDocument.DoesNotExist:
            return Response({'error': 'Document not found or does not belong to this teacher.'}, status=404)


class TeacherSchoolAssociationViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = TeacherSchoolAssociation.objects.all()
    serializer_class = TeacherSchoolAssociationSerializer
    permission_classes = [permissions.IsAuthenticated, TeacherAssociationPermission]
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'teachers'
    rbac_resource = 'teacher'
    
    def get_queryset(self):
        """Filter associations by user's school."""
        queryset = TeacherSchoolAssociation.objects.select_related('teacher', 'teacher__user', 'school')
        
        # Only Platform Admin sees everything
        if is_platform_admin(self.request.user):
            # Still allow explicit school filtering for platform admins
            school_id = self.request.query_params.get('school')
            if school_id:
                queryset = queryset.filter(school_id=school_id)
        else:
            # Use SchoolIsolationMixin's helper
            school_filter = self.get_school_filter()
            queryset = queryset.filter(**school_filter)
        
        user = self.request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import has_permission
            can_view_teaching = has_permission(user, 'teachers.view_teaching')
            can_view_non_teaching = has_permission(user, 'teachers.view_non_teaching')
            
            if can_view_teaching and can_view_non_teaching:
                pass
            elif can_view_teaching:
                queryset = queryset.filter(teacher__teacher_type='TEACHING')
            elif can_view_non_teaching:
                queryset = queryset.filter(teacher__teacher_type='NON_TEACHING')
            else:
                queryset = queryset.none()

        teacher_id = self.request.query_params.get('teacher')
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset


class TeacherAssignmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.all()
    serializer_class = TeacherAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, TeacherAssignmentPermission]
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'teachers'
    rbac_resource = 'assignment'
    rbac_action_permissions = {
        'list': ['teachers.view_assignments', 'academics.view_exam', 'academics.add_exam'],
        'retrieve': ['teachers.view_assignments', 'academics.view_exam', 'academics.add_exam'],
        'create': 'teachers.assign_classes',
        'update': 'teachers.assign_classes',
        'partial_update': 'teachers.assign_classes',
        'destroy': 'teachers.assign_classes',
    }

    def perform_create(self, serializer):
        from apps.core.school_isolation import get_user_school, is_platform_admin
        from apps.accounts.permission_utils import clear_permission_cache
        school = get_user_school(self.request.user)
        
        if not is_platform_admin(self.request.user) or 'school' not in self.request.data:
            instance = serializer.save(school=school) if school else serializer.save()
        else:
            instance = serializer.save()

        if instance.teacher and getattr(instance.teacher, 'user', None):
            clear_permission_cache(instance.teacher.user, instance.school)

    def perform_update(self, serializer):
        from apps.accounts.permission_utils import clear_permission_cache
        instance = serializer.save()
        if instance.teacher and getattr(instance.teacher, 'user', None):
            clear_permission_cache(instance.teacher.user, instance.school)

    def perform_destroy(self, instance):
        from apps.accounts.permission_utils import clear_permission_cache
        teacher = instance.teacher
        school = instance.school
        instance.delete()
        if teacher and getattr(teacher, 'user', None):
            clear_permission_cache(teacher.user, school)
    
    def get_queryset(self):
        """Filter assignments by user's school."""
        queryset = TeacherAssignment.objects.select_related('teacher', 'teacher__user', 'school')
        
        # Only Platform Admin sees everything
        if is_platform_admin(self.request.user):
            # Still allow explicit school filtering for platform admins
            school_id = self.request.query_params.get('school')
            if school_id:
                queryset = queryset.filter(school_id=school_id)
        else:
            # Use SchoolIsolationMixin's helper
            school_filter = self.get_school_filter()
            queryset = queryset.filter(**school_filter)

        user = self.request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.teachers.models import Teacher
            teacher_obj = Teacher.objects.filter(user=user).first()
            if not teacher_obj and user.user_type == 'ROLE':
                from apps.accounts.rbac_models import UserRole
                ur = UserRole.objects.filter(user=user, is_active=True).first()
                if ur and ur.role and ur.role.associated_user:
                    teacher_obj = Teacher.objects.filter(user=ur.role.associated_user).first()

            if teacher_obj:
                # Ensure all Sections where this teacher is assigned as class_teacher have an active TeacherAssignment
                from apps.academics.models import Section
                for sec in Section.objects.filter(class_teacher=teacher_obj, is_active=True):
                    g_name = sec.grade_config.grade_name if sec.grade_config else ''
                    s_let = sec.section_letter
                    if g_name and s_let:
                        ta, _ = TeacherAssignment.objects.get_or_create(
                            school=sec.school,
                            teacher=teacher_obj,
                            role='CLASS_TEACHER',
                            grade=g_name,
                            section=s_let,
                            defaults={'is_active': True}
                        )
                        if not ta.is_active:
                            ta.is_active = True
                            ta.save(update_fields=['is_active'])

                queryset = queryset.filter(teacher=teacher_obj)
            else:
                from apps.accounts.permission_utils import has_permission
                can_view_teaching = has_permission(user, 'teachers.view_teaching')
                can_view_non_teaching = has_permission(user, 'teachers.view_non_teaching')
                if can_view_teaching and can_view_non_teaching:
                    pass
                elif can_view_teaching:
                    queryset = queryset.filter(teacher__teacher_type='TEACHING')
                elif can_view_non_teaching:
                    queryset = queryset.filter(teacher__teacher_type='NON_TEACHING')
                else:
                    queryset = queryset.none()
        elif hasattr(user, 'teacher_profile'):
            pass
        
        teacher_id = self.request.query_params.get('teacher')
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)
        
        grade = self.request.query_params.get('grade')
        if grade:
            grade_clean = grade.strip()
            from django.db.models import Q
            queryset = queryset.filter(
                Q(grade__iexact=grade_clean) |
                Q(grade__iexact=f"Grade {grade_clean}") |
                Q(grade__iexact=grade_clean.replace('Grade ', ''))
            )
        
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section__iexact=section.strip())
        
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        
        subject = self.request.query_params.get('subject')
        if subject:
            queryset = queryset.filter(subject__iexact=subject)
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset


class RemarkViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Remark.objects.all()
    serializer_class = RemarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'teacher__user__school'
    
    def get_queryset(self):
        from apps.core.school_isolation import get_user_school
        school = get_user_school(self.request.user)
        queryset = Remark.objects.all()
        if school:
            queryset = queryset.filter(
                Q(teacher__user__school=school) |
                Q(teacher__school_associations__school=school) |
                Q(student__school=school)
            )

        user = self.request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            teacher = Teacher.objects.filter(user=user).first()
            if not teacher and hasattr(user, 'teacher_profile'):
                teacher = user.teacher_profile

            if teacher:
                active_assignments = TeacherAssignment.objects.filter(teacher=teacher, is_active=True)
                if school:
                    active_assignments = active_assignments.filter(school=school)
                
                grade_section_q = Q(teacher=teacher)
                for ta in active_assignments:
                    clean_g = str(ta.grade).lower().replace('grade', '').replace('class', '').strip()
                    grade_section_q |= Q(
                        student__enrollments__grade__icontains=clean_g,
                        student__enrollments__section__iexact=ta.section,
                        student__enrollments__status='ACTIVE'
                    )
                queryset = queryset.filter(grade_section_q)
            else:
                queryset = queryset.none()
        
        # Filter by class if provided (e.g. "9-B" or section ID)
        class_param = self.request.query_params.get('class')
        if class_param:
            try:
                if '-' in class_param:
                    grade_name, section_name = class_param.split('-')
                    queryset = queryset.filter(
                        student__current_section__grade_config__grade_name=grade_name,
                        student__current_section__section_letter=section_name,
                        student__status='ACTIVE'
                    )
                else:
                    queryset = queryset.filter(student__current_section_id=class_param)
            except ValueError:
                pass

        section_id = self.request.query_params.get('section')
        if section_id:
            queryset = queryset.filter(student__current_section_id=section_id)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        student_suid = self.request.query_params.get('student_suid')
        if student_suid:
            queryset = queryset.filter(student__suid=student_suid)

        category = self.request.query_params.get('category')
        if category and category != 'ALL':
            queryset = queryset.filter(category=category)
        
        return queryset.distinct().order_by('-created_at')
    
    def perform_create(self, serializer):
        teacher = Teacher.objects.filter(user=self.request.user).first()
        if not teacher:
            from apps.teachers.models import Teacher
            teacher = Teacher.objects.first()
            
        instance = serializer.save(teacher=teacher)

        # Sync remark to student history so it appears in School Admin's Students module
        try:
            from apps.students.models import StudentHistory
            latest_history = StudentHistory.objects.filter(
                student=instance.student
            ).order_by('-id').first()
            
            if latest_history:
                latest_history.teacher_remarks = instance.context + (f": {instance.details}" if instance.details else "")
                latest_history.remarks_date = instance.created_at.date()
                if teacher:
                    latest_history.class_teacher = teacher
                latest_history.save(update_fields=['teacher_remarks', 'remarks_date', 'class_teacher'])
        except Exception as e:
            print(f"Syncing remark to student history warning: {e}")
