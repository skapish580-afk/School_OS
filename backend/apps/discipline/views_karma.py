from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.utils import timezone

from .models import StudentKarma, AttendanceEditLog
from .serializers import StudentKarmaSerializer, AttendanceEditLogSerializer
from apps.teachers.models import Teacher, TeacherAssignment
from apps.students.models import Student
from apps.schools.models import School
from apps.accounts.permission_utils import RBACPermission


class StudentKarmaViewSet(viewsets.ModelViewSet):
    """
    Karma management for class teachers
    - Class teachers can manage karma for their class only
    - Subject teachers can add karma during their period
    - Admins have full access
    """
    serializer_class = StudentKarmaSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'discipline'
    rbac_resource = 'karma'
    rbac_action_permissions = {
        'bulk_add': 'discipline.create_karma',
    }
    
    def get_queryset(self):
        user = self.request.user
        
        # Admin sees all
        if user.is_staff:
            return StudentKarma.objects.all()
        
        # Teachers see karma they gave or for their classes
        try:
            teacher = Teacher.objects.get(user=user)
            
            # Get class teacher assignments
            class_teacher_assignments = TeacherAssignment.objects.filter(
                teacher=teacher,
                role='CLASS_TEACHER',
                is_active=True
            )
            
            # Build query for their students
            student_filters = Q()
            for assignment in class_teacher_assignments:
                student_filters |= Q(grade=assignment.grade, section=assignment.section)
            
            # Return karma for their students or karma they gave
            return StudentKarma.objects.filter(
                Q(given_by_teacher=teacher) | student_filters
            ).distinct()
        except Teacher.DoesNotExist:
            return StudentKarma.objects.none()
    
    def perform_create(self, serializer):
        """Auto-set teacher and school when creating karma"""
        teacher = Teacher.objects.get(user=self.request.user)
        student = serializer.validated_data['student']
        
        # Verify permission: class teacher of this student OR subject teacher
        can_add_karma = self._can_manage_student_karma(teacher, student)
        
        if not can_add_karma:
            raise PermissionError("You don't have permission to add karma for this student")
        
        # Get current academic year from school settings
        school = teacher.assignments.first().school if teacher.assignments.exists() else None
        if not school:
            raise ValueError("Teacher has no school assignment")
        
        # Get student's current enrollment for grade/section
        current_enrollment = student.enrollments.filter(status='ACTIVE').first()
        if not current_enrollment:
            raise ValueError("Student has no active enrollment")
        
        serializer.save(
            given_by_teacher=teacher,
            school=school,
            grade=current_enrollment.grade,
            section=current_enrollment.section,
            academic_year='2025-2026'  # TODO: Get from school settings
        )
    
    def perform_update(self, serializer):
        """Only allow editing own karma records"""
        karma = self.get_object()
        teacher = Teacher.objects.get(user=self.request.user)
        
        # Only creator or admin can edit
        if karma.given_by_teacher != teacher and not self.request.user.is_staff:
            raise PermissionError("You can only edit karma you created")
        
        serializer.save()
    
    def perform_destroy(self, instance):
        """Only allow deleting own karma records"""
        teacher = Teacher.objects.get(user=self.request.user)
        
        if instance.given_by_teacher != teacher and not self.request.user.is_staff:
            raise PermissionError("You can only delete karma you created")
        
        instance.delete()
    
    def _can_manage_student_karma(self, teacher, student):
        """Check if teacher can manage karma for this student"""
        # Get student's current enrollment
        enrollment = student.enrollments.filter(status='ACTIVE').first()
        if not enrollment:
            return False
        
        # Check if teacher is class teacher of this student
        is_class_teacher = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            grade=enrollment.grade,
            section=enrollment.section,
            is_active=True
        ).exists()
        
        # Check if teacher has any assignment for this grade/section
        has_assignment = TeacherAssignment.objects.filter(
            teacher=teacher,
            grade=enrollment.grade,
            section=enrollment.section,
            is_active=True
        ).exists()
        
        return is_class_teacher or has_assignment
    
    @action(detail=False, methods=['get'])
    def my_class_karma(self, request):
        """Get karma summary for class teacher's students"""
        teacher = Teacher.objects.get(user=request.user)
        
        # Get class teacher assignment
        class_assignment = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            is_active=True
        ).first()
        
        if not class_assignment:
            return Response(
                {'error': 'You are not a class teacher'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get karma for this class
        karma_records = StudentKarma.objects.filter(
            grade=class_assignment.grade,
            section=class_assignment.section,
            academic_year='2025-2026'
        )
        
        # Calculate summary
        students = Student.objects.filter(
            enrollments__grade=class_assignment.grade,
            enrollments__section=class_assignment.section,
            enrollments__status='ACTIVE'
        ).distinct()
        
        summaries = []
        for student in students:
            student_karma = karma_records.filter(student=student)
            positive = student_karma.filter(type='POSITIVE').aggregate(Sum('points'))['points__sum'] or 0
            negative = student_karma.filter(type='NEGATIVE').aggregate(Sum('points'))['points__sum'] or 0
            
            summaries.append({
                'student_id': student.id,
                'student_name': student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}",
                'student_suid': student.suid,
                'total_positive': positive,
                'total_negative': negative,
                'net_karma': positive - negative,
                'recent_count': student_karma.count()
            })
        
        return Response(summaries)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_karma_summary(request, student_id):
    """Get karma summary for a specific student"""
    try:
        student = Student.objects.get(id=student_id)
        teacher = Teacher.objects.get(user=request.user)
        
        # Verify permission
        enrollment = student.enrollments.filter(status='ACTIVE').first()
        if not enrollment:
            return Response({'error': 'Student has no active enrollment'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if teacher can view this student
        has_permission = TeacherAssignment.objects.filter(
            teacher=teacher,
            grade=enrollment.grade,
            section=enrollment.section,
            is_active=True
        ).exists() or request.user.is_staff
        
        if not has_permission:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get karma records
        karma_records = StudentKarma.objects.filter(student=student, academic_year='2025-2026')
        
        positive_sum = karma_records.filter(type='POSITIVE').aggregate(Sum('points'))['points__sum'] or 0
        negative_sum = karma_records.filter(type='NEGATIVE').aggregate(Sum('points'))['points__sum'] or 0
        
        recent_records = karma_records.order_by('-created_at')[:10]
        
        return Response({
            'student_id': student.id,
            'student_name': student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}",
            'student_suid': student.suid,
            'total_positive': positive_sum,
            'total_negative': negative_sum,
            'net_karma': positive_sum - negative_sum,
            'total_records': karma_records.count(),
            'recent_records': StudentKarmaSerializer(recent_records, many=True).data
        })
    
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_add_karma(request):
    """Add karma to multiple students at once (e.g., whole class for cleanliness)"""
    try:
        teacher = Teacher.objects.get(user=request.user)
        student_ids = request.data.get('student_ids', [])
        karma_type = request.data.get('type')
        category = request.data.get('category')
        points = request.data.get('points', 1)
        remark = request.data.get('remark')
        
        if not student_ids or not karma_type or not category or not remark:
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get class teacher assignment
        class_assignment = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            is_active=True
        ).first()
        
        if not class_assignment:
            return Response({'error': 'Only class teachers can bulk add karma'}, status=status.HTTP_403_FORBIDDEN)
        
        # Create karma records
        karma_objects = []
        for student_id in student_ids:
            student = Student.objects.get(id=student_id)
            enrollment = student.enrollments.filter(status='ACTIVE').first()
            
            # Verify student is in teacher's class
            if enrollment.grade != class_assignment.grade or enrollment.section != class_assignment.section:
                continue
            
            karma_objects.append(StudentKarma(
                student=student,
                given_by_teacher=teacher,
                school=class_assignment.school,
                type=karma_type,
                category=category,
                points=points,
                remark=remark,
                academic_year='2025-2026',
                grade=enrollment.grade,
                section=enrollment.section
            ))
        
        StudentKarma.objects.bulk_create(karma_objects)
        
        return Response({
            'message': f'Karma added to {len(karma_objects)} students',
            'count': len(karma_objects)
        })
    
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
