from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import StudentAttendance, AttendanceSession
from apps.teachers.models import Teacher, TeacherAssignment
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_students(request, assignment_id, period):
    """Get students for a specific class assignment"""
    try:
        teacher = Teacher.objects.get(user=request.user)
        assignment = TeacherAssignment.objects.get(id=assignment_id, teacher=teacher)
        
        # Get students in this class based on grade and section
        enrollments = StudentEnrollment.objects.filter(
            grade=str(assignment.grade),
            section=str(assignment.section),
            status='ACTIVE'
        ).select_related('student', 'student__user')
        
        # Check if class has students
        if not enrollments.exists():
            return Response(
                {
                    'error': 'No students enrolled in this class',
                    'class_info': {
                        'grade': str(assignment.grade),
                        'section': str(assignment.section)
                    }
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get or create attendance session for today
        today = timezone.now().date()
        session, created = AttendanceSession.objects.get_or_create(
            grade=str(assignment.grade),
            section=str(assignment.section),
            date=today,
            session_type='PERIOD',
            defaults={'created_by': request.user}
        )
        
        # Get existing attendance records
        existing_attendance = StudentAttendance.objects.filter(
            session=session
        ).values_list('student_id', 'status')
        
        attendance_dict = dict(existing_attendance)
        
        student_data = []
        for enrollment in enrollments:
            student = enrollment.student
            student_data.append({
                'id': str(student.id),
                'suid': student.suid,
                'name': student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}",
                'roll_number': str(enrollment.roll_number) if hasattr(enrollment, 'roll_number') else '',
                'photo': student.photo.url if hasattr(student, 'photo') and student.photo else None,
                'status': attendance_dict.get(student.id, 'PRESENT')
            })
        
        return Response({
            'class_info': {
                'id': str(assignment.id),
                'subject': str(assignment.subject) if assignment.subject else assignment.role,
                'grade': str(assignment.grade),
                'section': str(assignment.section),
                'period': int(period),
                'date': today.isoformat(),
                'session_id': session.id
            },
            'students': student_data
        })
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except TeacherAssignment.DoesNotExist:
        return Response(
            {'error': 'Class assignment not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_attendance_bulk(request):
    """Mark attendance for multiple students"""
    try:
        teacher = Teacher.objects.get(user=request.user)
        assignment_id = request.data.get('assignment_id')
        attendance_data = request.data.get('attendance', [])
        
        assignment = TeacherAssignment.objects.get(id=assignment_id, teacher=teacher)
        today = timezone.now().date()
        
        # Get or create attendance session
        session, created = AttendanceSession.objects.get_or_create(
            grade=str(assignment.grade),
            section=str(assignment.section),
            date=today,
            session_type='PERIOD',
            defaults={'created_by': request.user}
        )
        
        # Delete existing attendance for this session
        StudentAttendance.objects.filter(session=session).delete()
        
        # Create new attendance records
        attendance_objects = []
        for record in attendance_data:
            attendance_objects.append(StudentAttendance(
                session=session,
                student_id=record['student_id'],
                status=record['status'],
                marked_by=request.user,
                time_in=record.get('late_time')
            ))
        
        StudentAttendance.objects.bulk_create(attendance_objects)
        
        return Response({
            'message': 'Attendance marked successfully',
            'count': len(attendance_objects)
        })
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except TeacherAssignment.DoesNotExist:
        return Response(
            {'error': 'Class assignment not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
