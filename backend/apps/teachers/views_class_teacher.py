from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Count, Q, Sum
from django.utils import timezone
from datetime import timedelta

from apps.teachers.models import Teacher, TeacherAssignment
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from apps.attendance.models import StudentAttendance, AttendanceSession
from apps.discipline.models import StudentKarma
from apps.gatepass.models import GatePass


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def class_teacher_dashboard(request):
    """
    Dashboard for class teachers showing:
    - Class overview
    - Today's attendance summary
    - Pending gate passes
    - Recent karma activity
    - Student alerts
    """
    try:
        teacher = Teacher.objects.get(user=request.user)
        
        # Get class teacher assignment
        class_assignment = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            is_active=True
        ).first()
        
        if not class_assignment:
            return Response(
                {'error': 'You are not assigned as a class teacher'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        grade = class_assignment.grade
        section = class_assignment.section
        
        # Get students in this class
        students = Student.objects.filter(
            enrollments__grade=grade,
            enrollments__section=section,
            enrollments__status='ACTIVE'
        ).distinct()
        
        total_students = students.count()
        
        # Today's attendance summary
        today = timezone.now().date()
        today_sessions = AttendanceSession.objects.filter(
            grade=grade,
            section=section,
            date=today
        )
        
        attendance_summary = {
            'total_students': total_students,
            'present': 0,
            'absent': 0,
            'late': 0,
            'not_marked': total_students
        }
        
        if today_sessions.exists():
            # Get latest session's attendance
            latest_session = today_sessions.latest('created_at')
            attendance_records = StudentAttendance.objects.filter(session=latest_session)
            
            attendance_summary.update({
                'present': attendance_records.filter(status='PRESENT').count(),
                'absent': attendance_records.filter(status='ABSENT').count(),
                'late': attendance_records.filter(status='LATE').count(),
                'not_marked': total_students - attendance_records.count()
            })
            
            # Get absent students
            absent_students = []
            for record in attendance_records.filter(status='ABSENT'):
                absent_students.append({
                    'id': record.student.id,
                    'name': record.student.user.full_name if hasattr(record.student.user, 'full_name') else f"{record.student.user.first_name} {record.student.user.last_name}",
                    'suid': record.student.suid,
                    'roll_number': record.student.enrollments.filter(status='ACTIVE').first().roll_number if record.student.enrollments.filter(status='ACTIVE').exists() else None
                })
        else:
            absent_students = []
        
        # Pending gate passes (if enabled)
        pending_gatepasses = []
        try:
            from apps.schools.models import School
            school = class_assignment.school
            if school and hasattr(school, 'settings') and school.settings.enable_class_teacher_gatepass_approval:
                pending_passes = GatePass.objects.filter(
                    student__enrollments__grade=grade,
                    student__enrollments__section=section,
                    student__enrollments__status='ACTIVE',
                    status='PENDING'
                ).select_related('student', 'student__user')
                
                for gp in pending_passes[:5]:  # Latest 5
                    pending_gatepasses.append({
                        'id': gp.id,
                        'student_name': gp.student.user.full_name if hasattr(gp.student.user, 'full_name') else f"{gp.student.user.first_name} {gp.student.user.last_name}",
                        'student_suid': gp.student.suid,
                        'reason': gp.reason,
                        'requested_at': gp.requested_at,
                        'out_time': gp.out_time
                    })
        except:
            pass
        
        # Recent karma activity (last 7 days)
        week_ago = today - timedelta(days=7)
        karma_records = StudentKarma.objects.filter(
            grade=grade,
            section=section,
            created_at__gte=week_ago
        )
        
        karma_summary = {
            'total_positive': karma_records.filter(type='POSITIVE').count(),
            'total_negative': karma_records.filter(type='NEGATIVE').count(),
            'recent_activity': []
        }
        
        recent_karma = karma_records.order_by('-created_at')[:10]
        for karma in recent_karma:
            karma_summary['recent_activity'].append({
                'id': karma.id,
                'student_name': karma.student.user.full_name if hasattr(karma.student.user, 'full_name') else f"{karma.student.user.first_name} {karma.student.user.last_name}",
                'type': karma.type,
                'category': karma.category,
                'points': karma.points,
                'remark': karma.remark,
                'created_at': karma.created_at
            })
        
        # Student alerts (low attendance, negative karma)
        alerts = []
        
        # Students with low attendance (< 75% this month)
        month_start = today.replace(day=1)
        for student in students[:10]:  # Check first 10 for performance
            student_attendance = StudentAttendance.objects.filter(
                student=student,
                session__date__gte=month_start
            )
            total_days = student_attendance.count()
            if total_days > 0:
                present_days = student_attendance.filter(status='PRESENT').count()
                attendance_pct = (present_days / total_days) * 100
                
                if attendance_pct < 75:
                    alerts.append({
                        'type': 'attendance',
                        'priority': 'high',
                        'student_id': student.id,
                        'student_name': student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}",
                        'message': f'Low attendance: {attendance_pct:.1f}%'
                    })
        
        # Students with high negative karma
        for student in students:
            negative_karma = StudentKarma.objects.filter(
                student=student,
                type='NEGATIVE',
                created_at__gte=week_ago
            ).count()
            
            if negative_karma >= 3:
                alerts.append({
                    'type': 'discipline',
                    'priority': 'medium',
                    'student_id': student.id,
                    'student_name': student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}",
                    'message': f'{negative_karma} negative karma entries this week'
                })
        
        return Response({
            'class_info': {
                'grade': grade,
                'section': section,
                'total_students': total_students,
                'academic_year': class_assignment.academic_year
            },
            'attendance_today': attendance_summary,
            'absent_students_today': absent_students,
            'pending_gatepasses': pending_gatepasses,
            'karma_summary': karma_summary,
            'alerts': alerts[:10]  # Top 10 alerts
        })
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def class_student_details(request, student_id):
    """
    Detailed view of a student for class teacher
    - Attendance percentage
    - Karma score
    - Recent remarks
    - Academic alerts
    """
    try:
        teacher = Teacher.objects.get(user=request.user)
        student = Student.objects.get(id=student_id)
        
        # Verify permission
        enrollment = student.enrollments.filter(status='ACTIVE').first()
        if not enrollment:
            return Response({'error': 'Student has no active enrollment'}, status=status.HTTP_404_NOT_FOUND)
        
        is_class_teacher = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            grade=enrollment.grade,
            section=enrollment.section,
            is_active=True
        ).exists()
        
        if not is_class_teacher and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get attendance stats (current month)
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        attendance_records = StudentAttendance.objects.filter(
            student=student,
            session__date__gte=month_start
        )
        
        total_days = attendance_records.count()
        present_days = attendance_records.filter(status='PRESENT').count()
        late_days = attendance_records.filter(status='LATE').count()
        absent_days = attendance_records.filter(status='ABSENT').count()
        
        attendance_percentage = (present_days / total_days * 100) if total_days > 0 else 0
        
        # Get karma summary
        karma_records = StudentKarma.objects.filter(student=student, academic_year='2025-2026')
        positive_karma = karma_records.filter(type='POSITIVE').aggregate(Sum('points'))['points__sum'] or 0
        negative_karma = karma_records.filter(type='NEGATIVE').aggregate(Sum('points'))['points__sum'] or 0
        
        recent_karma = karma_records.order_by('-created_at')[:5]
        
        return Response({
            'student': {
                'id': student.id,
                'name': student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}",
                'suid': student.suid,
                'email': student.user.email,
                'grade': enrollment.grade,
                'section': enrollment.section,
                'roll_number': enrollment.roll_number
            },
            'attendance': {
                'total_days': total_days,
                'present': present_days,
                'late': late_days,
                'absent': absent_days,
                'percentage': round(attendance_percentage, 2)
            },
            'karma': {
                'positive_total': positive_karma,
                'negative_total': negative_karma,
                'net_score': positive_karma - negative_karma,
                'recent_records': [{
                    'type': k.type,
                    'category': k.category,
                    'points': k.points,
                    'remark': k.remark,
                    'date': k.created_at
                } for k in recent_karma]
            }
        })
    
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
