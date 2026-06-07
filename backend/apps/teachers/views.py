from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Teacher, TeacherSchoolAssociation, TeacherAssignment, Remark
from .serializers import TeacherSerializer, TeacherSchoolAssociationSerializer, TeacherAssignmentSerializer, RemarkSerializer
from apps.students.models import Student
from apps.students.serializers import StudentSerializer
from apps.accounts.permission_utils import RBACPermission


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def teacher_profile(request):
    """Get or update current teacher's profile"""
    try:
        teacher = Teacher.objects.get(user=request.user)
        
        if request.method == 'GET':
            serializer = TeacherSerializer(teacher)
            return Response(serializer.data)
        
        elif request.method in ['PUT', 'PATCH']:
            partial = request.method == 'PATCH'
            serializer = TeacherSerializer(teacher, data=request.data, partial=partial)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
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
        attendance_records = StudentAttendance.objects.filter(
            student=student,
            session__date__gte=thirty_days_ago  # Access date through session relationship
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

class TeacherViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    school_field = 'user__school'
    
    # RBAC Configuration
    rbac_module = 'teachers'
    rbac_resource = 'teacher'
    rbac_action_permissions = {
        'history': 'teachers.view_teacher',
        'bulk_import': 'teachers.import_teacher',
        'onboard': 'teachers.create_teacher',
    }

    def get_queryset(self):
        """Filter teachers by user's school."""
        queryset = Teacher.objects.select_related('user').prefetch_related('school_associations')
        
        # Only Platform Admin sees everything
        if is_platform_admin(self.request.user):
            return queryset
            
        # Use SchoolIsolationMixin's helper
        school_filter = self.get_school_filter()
        return queryset.filter(**school_filter).distinct()
    
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
                        'aadhaar_last_4_digits': data.get('aadhaar_last_4_digits', ''),
                        'pan_number': data.get('pan_number', ''),
                        'dietary_preference': data.get('dietary_preference', ''),
                        'qualifications': data.get('qualifications', ''),
                        'certified_subjects': data.get('certified_subjects', ''),
                        'experience_years': int(data.get('experience_years', 0)) if data.get('experience_years') else 0,
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
                    teacher.aadhaar_last_4_digits = data.get('aadhaar_last_4_digits', teacher.aadhaar_last_4_digits)
                    teacher.pan_number = data.get('pan_number', teacher.pan_number)
                    teacher.dietary_preference = data.get('dietary_preference', teacher.dietary_preference)
                    teacher.qualifications = data.get('qualifications', teacher.qualifications)
                    teacher.certified_subjects = data.get('certified_subjects', teacher.certified_subjects)
                    teacher.experience_years = int(data.get('experience_years', teacher.experience_years)) if data.get('experience_years') else teacher.experience_years
                    teacher.save()

                # 3. Create School Association if not exists
                association, a_created = TeacherSchoolAssociation.objects.get_or_create(
                    teacher=teacher,
                    school=school,
                    defaults={
                        'joining_date': data.get('joining_date') or timezone.now().date(),
                        'employment_type': 'FULL_TIME',
                        'status': 'ACTIVE'
                    }
                )
                
                if not a_created:
                    if association.status != 'ACTIVE':
                        association.status = 'ACTIVE'
                        association.save()
                    else:
                        return Response({'error': 'Teacher is already active in this school.'}, status=400)

                serializer = TeacherSerializer(teacher)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class TeacherSchoolAssociationViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = TeacherSchoolAssociation.objects.all()
    serializer_class = TeacherSchoolAssociationSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
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
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'teachers'
    rbac_resource = 'assignment'

    def perform_create(self, serializer):
        from apps.core.school_isolation import get_user_school, is_platform_admin
        school = get_user_school(self.request.user)
        
        # Ensure school is set
        if not is_platform_admin(self.request.user) or 'school' not in self.request.data:
            if school:
                serializer.save(school=school)
            else:
                # If no school found, try to save normally (may error if required)
                serializer.save()
        else:
            serializer.save()
    
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

        # Filter by logged-in teacher if they are a teacher
        # This ensures teachers only see their own assignments
        if hasattr(self.request.user, 'teacher_profile'):
            queryset = queryset.filter(teacher=self.request.user.teacher_profile)
        
        teacher_id = self.request.query_params.get('teacher')
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)
        
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade=grade)
        
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section=section)
        
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset


class RemarkViewSet(viewsets.ModelViewSet):
    queryset = Remark.objects.all()
    serializer_class = RemarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Remark.objects.all()
        
        # Filter by class if provided
        class_param = self.request.query_params.get('class')
        if class_param:
            # Parse class (e.g., "9-B" -> grade=9, section=B)
            try:
                grade_name, section_name = class_param.split('-')
                queryset = queryset.filter(
                    student__enrollments__grade=grade_name,
                    student__enrollments__section=section_name,
                    student__enrollments__status='ACTIVE'
                )
            except ValueError:
                pass
        
        # Filter by category if provided
        category = self.request.query_params.get('category')
        if category and category != 'ALL':
            queryset = queryset.filter(category=category)
        
        return queryset.distinct()
    
    def perform_create(self, serializer):
        # Get teacher from the current user
        try:
            teacher = Teacher.objects.get(user=self.request.user)
            serializer.save(teacher=teacher)
        except Teacher.DoesNotExist:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError('Teacher profile not found')
