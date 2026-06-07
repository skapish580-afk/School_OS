from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from apps.attendance.models import StudentAttendance, AttendanceSession
from apps.discipline.models import AttendanceEditLog
from apps.discipline.serializers import AttendanceEditLogSerializer
from apps.teachers.models import Teacher, TeacherAssignment
from apps.students.models import Student


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_full_day_attendance(request, grade, section):
    """
    Get full-day attendance for a class (all periods)
    Only accessible by class teacher or admin
    """
    try:
        user = request.user
        
        # Check permission
        if not user.is_staff:
            teacher = Teacher.objects.get(user=user)
            is_class_teacher = TeacherAssignment.objects.filter(
                teacher=teacher,
                role='CLASS_TEACHER',
                grade=str(grade),
                section=str(section),
                is_active=True
            ).exists()
            
            if not is_class_teacher:
                return Response(
                    {'error': 'Only class teachers can view full-day attendance'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check feature toggle
        from apps.schools.models import School
        school = School.objects.first()  # TODO: Get from teacher's assignment
        if school and hasattr(school, 'settings'):
            if not school.settings.enable_class_teacher_attendance_edit:
                return Response(
                    {'error': 'Attendance editing is disabled by school admin'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Get today's sessions
        today = timezone.now().date()
        date_param = request.query_params.get('date', today)
        
        sessions = AttendanceSession.objects.filter(
            grade=str(grade),
            section=str(section),
            date=date_param
        ).order_by('created_at')
        
        # Get all attendance records
        session_data = []
        for session in sessions:
            attendance_records = StudentAttendance.objects.filter(session=session).select_related('student', 'student__user')
            
            records = []
            for record in attendance_records:
                records.append({
                    'id': record.id,
                    'student_id': record.student.id,
                    'student_name': record.student.user.full_name if hasattr(record.student.user, 'full_name') else f"{record.student.user.first_name} {record.student.user.last_name}",
                    'student_suid': record.student.suid,
                    'status': record.status,
                    'time_in': record.time_in,
                    'marked_by': record.marked_by.full_name if record.marked_by and hasattr(record.marked_by, 'full_name') else None,
                    'can_edit': True  # Class teacher can edit all
                })
            
            session_data.append({
                'session_id': session.id,
                'session_type': session.session_type,
                'date': session.date,
                'attendance': records
            })
        
        return Response({
            'grade': grade,
            'section': section,
            'date': date_param,
            'sessions': session_data
        })
    
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def edit_attendance_record(request, attendance_id):
    """
    Edit attendance record with audit log
    Only class teachers and admins can edit
    """
    try:
        user = request.user
        attendance = StudentAttendance.objects.get(id=attendance_id)
        
        # Get new status and reason
        new_status = request.data.get('status')
        reason = request.data.get('reason')
        
        if not new_status or not reason:
            return Response(
                {'error': 'Status and reason are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permission
        editor_role = None
        if user.is_staff:
            editor_role = 'ADMIN'
        else:
            teacher = Teacher.objects.get(user=user)
            
            # Get student's enrollment
            student = attendance.student
            enrollment = student.enrollments.filter(status='ACTIVE').first()
            if not enrollment:
                return Response({'error': 'Student has no active enrollment'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if class teacher
            is_class_teacher = TeacherAssignment.objects.filter(
                teacher=teacher,
                role='CLASS_TEACHER',
                grade=enrollment.grade,
                section=enrollment.section,
                is_active=True
            ).exists()
            
            if not is_class_teacher:
                return Response(
                    {'error': 'Only class teachers can edit attendance'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            editor_role = 'CLASS_TEACHER'
        
        # Check feature toggle
        from apps.schools.models import School
        school = School.objects.first()
        if school and hasattr(school, 'settings'):
            if not school.settings.enable_class_teacher_attendance_edit and not user.is_staff:
                return Response(
                    {'error': 'Attendance editing is disabled'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Create audit log
        old_status = attendance.status
        
        AttendanceEditLog.objects.create(
            attendance=attendance,
            edited_by=user,
            editor_role=editor_role,
            old_status=old_status,
            new_status=new_status,
            reason=reason
        )
        
        # Update attendance
        attendance.status = new_status
        attendance.save()
        
        return Response({
            'message': 'Attendance updated successfully',
            'old_status': old_status,
            'new_status': new_status
        })
    
    except StudentAttendance.DoesNotExist:
        return Response({'error': 'Attendance record not found'}, status=status.HTTP_404_NOT_FOUND)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_attendance_edit_history(request, attendance_id):
    """Get edit history for an attendance record"""
    try:
        attendance = StudentAttendance.objects.get(id=attendance_id)
        
        # Check permission
        user = request.user
        if not user.is_staff:
            teacher = Teacher.objects.get(user=user)
            student = attendance.student
            enrollment = student.enrollments.filter(status='ACTIVE').first()
            
            has_permission = TeacherAssignment.objects.filter(
                teacher=teacher,
                grade=enrollment.grade,
                section=enrollment.section,
                is_active=True
            ).exists()
            
            if not has_permission:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get edit logs
        logs = AttendanceEditLog.objects.filter(attendance=attendance).order_by('-edited_at')
        serializer = AttendanceEditLogSerializer(logs, many=True)
        
        return Response({
            'attendance_id': attendance_id,
            'student_name': attendance.student.user.full_name if hasattr(attendance.student.user, 'full_name') else f"{attendance.student.user.first_name} {attendance.student.user.last_name}",
            'current_status': attendance.status,
            'edit_history': serializer.data
        })
    
    except StudentAttendance.DoesNotExist:
        return Response({'error': 'Attendance record not found'}, status=status.HTTP_404_NOT_FOUND)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_edit_attendance(request):
    """
    Bulk edit attendance for multiple students
    Only class teachers can use this
    """
    try:
        user = request.user
        attendance_edits = request.data.get('edits', [])
        reason = request.data.get('reason')
        
        if not attendance_edits or not reason:
            return Response(
                {'error': 'Edits and reason are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Determine editor role
        if user.is_staff:
            editor_role = 'ADMIN'
        else:
            teacher = Teacher.objects.get(user=user)
            editor_role = 'CLASS_TEACHER'
        
        # Process edits
        updated_count = 0
        for edit in attendance_edits:
            attendance_id = edit.get('attendance_id')
            new_status = edit.get('status')
            
            try:
                attendance = StudentAttendance.objects.get(id=attendance_id)
                
                # Verify permission (class teacher check)
                if not user.is_staff:
                    enrollment = attendance.student.enrollments.filter(status='ACTIVE').first()
                    is_class_teacher = TeacherAssignment.objects.filter(
                        teacher=teacher,
                        role='CLASS_TEACHER',
                        grade=enrollment.grade,
                        section=enrollment.section,
                        is_active=True
                    ).exists()
                    
                    if not is_class_teacher:
                        continue
                
                # Create audit log
                old_status = attendance.status
                AttendanceEditLog.objects.create(
                    attendance=attendance,
                    edited_by=user,
                    editor_role=editor_role,
                    old_status=old_status,
                    new_status=new_status,
                    reason=reason
                )
                
                # Update
                attendance.status = new_status
                attendance.save()
                updated_count += 1
            
            except StudentAttendance.DoesNotExist:
                continue
        
        return Response({
            'message': f'{updated_count} attendance records updated',
            'count': updated_count
        })
    
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
