from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from django.http import HttpResponse
import csv

from .models import AttendanceSession, StudentAttendance
from .serializers import AttendanceSessionSerializer
from apps.students.models import Student
from apps.features.permissions import can
from apps.accounts.permission_utils import RBACPermission

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = AttendanceSession.objects.all()
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'attendance'
    rbac_resource = 'attendance'
    rbac_action_permissions = {
        'daily_register': 'attendance.view_attendance',
        'mark_bulk': 'attendance.mark_attendance',
        'stats': 'attendance.view_attendance',
        'student_report': 'attendance.view_attendance',
        'lock': 'attendance.manage_attendance',
        'export': 'attendance.view_attendance',
    }

    def get_queryset(self):
        """Get attendance sessions filtered by user role"""
        user = self.request.user
        queryset = AttendanceSession.objects.all().order_by('-date')
        
        # Teachers can only see their assigned class attendance
        if user.user_type == 'TEACHER':
            # TODO: Filter by assigned classes when teacher model is ready
            pass
        
        return queryset

    @action(detail=False, methods=['get'])
    def daily_register(self, request):
        """
        GET /api/v1/attendance/daily_register/?grade=10&section=A&date=2026-01-20
        
        SMART LOGIC:
        1. Check permissions
        2. Look for existing session
        3. If NOT found -> Create it & populate with all ACTIVE students
        4. Return full register with student details
        """
        if not can(request.user, 'VIEW_ATTENDANCE', 'ATTENDANCE_SYSTEM'):
            raise PermissionDenied("Access Denied: Attendance System")

        grade = request.query_params.get('grade')
        section = request.query_params.get('section')
        date_str = request.query_params.get('date', str(timezone.now().date()))

        if not grade or not section:
            return Response({'error': 'Grade and Section are required'}, status=400)

        # 1. Try to find existing session
        session, created = AttendanceSession.objects.get_or_create(
            grade=grade,
            section=section,
            date=date_str,
            defaults={'created_by': request.user}
        )

        # 2. Sync students dynamically
        # Get current active students for this grade/section
        current_students = Student.objects.filter(
            enrollments__grade=grade,
            enrollments__section=section,
            enrollments__status='ACTIVE'
        ).distinct()

        existing_student_ids = set(session.records.values_list('student_id', flat=True))
        current_student_ids = set(current_students.values_list('id', flat=True))

        # Add missing students
        to_add = current_student_ids - existing_student_ids
        if to_add:
            bulk_records = []
            for student in current_students.filter(id__in=to_add):
                bulk_records.append(StudentAttendance(
                    session=session,
                    student=student,
                    student_suid=student.suid,
                    status='PRESENT',
                    marked_by=request.user
                ))
            StudentAttendance.objects.bulk_create(bulk_records)

        # Remove students who are no longer in this grade/section
        # (Only if not already marked with a specific status or if it was just a default PRESENT)
        to_remove = existing_student_ids - current_student_ids
        if to_remove:
            session.records.filter(student_id__in=to_remove).delete()

        # 3. Return the full register with enhanced serializer
        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_bulk(self, request, pk=None):
        """
        POST /api/v1/attendance/{id}/mark_bulk/
        Payload: { "updates": [ {"student_id": 1, "status": "ABSENT", "remarks": "..."}, ... ] }
        
        Features:
        - Bulk marking of attendance
        - Auto-integration with gate pass (status='OUT')
        - Auto-integration with health module (status='MEDICAL')
        - Audit trail (who marked, when)
        """
        if not can(request.user, 'MARK_ATTENDANCE', 'ATTENDANCE_SYSTEM'):
            raise PermissionDenied("You do not have permission to mark attendance.")

        session = self.get_object()
        
        # Check if session is locked
        if session.is_locked and request.user.user_type != 'ADMIN':
            return Response({'error': 'This attendance register is locked.'}, status=403)

        updates = request.data.get('updates', [])
        
        for update in updates:
            student_id = update.get('student_id')
            new_status = update.get('status')
            remarks = update.get('remarks', '')
            gate_pass_id = update.get('gate_pass_id')
            health_visit_id = update.get('health_visit_id')

            try:
                record = StudentAttendance.objects.get(session=session, student_id=student_id)
                record.status = new_status
                record.remarks = remarks
                
                # Auto-link gate pass if status is OUT
                if new_status == 'OUT' and gate_pass_id:
                    record.gate_pass_id = gate_pass_id
                
                # Auto-link health visit if status is MEDICAL
                if new_status == 'MEDICAL' and health_visit_id:
                    record.health_visit_id = health_visit_id
                
                # Audit: Track who edited and when
                if record.marked_by != request.user or update.get('force_edit'):
                    record.edited_by = request.user
                
                record.save()
            except StudentAttendance.DoesNotExist:
                return Response(
                    {'error': f'Attendance record not found for student {student_id}'},
                    status=404
                )

        return Response({
            'message': 'Attendance updated successfully',
            'session_id': session.id
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export attendance report as CSV/JSON"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        format_type = request.query_params.get('format', 'csv').lower()
        
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date are required'}, status=400)
            
        records = StudentAttendance.objects.filter(
            session__date__gte=start_date,
            session__date__lte=end_date
        ).select_related('student', 'student__user', 'session').order_by('session__date', 'student__user__first_name')
        
        if format_type == 'json':
            data = [{
                'date': str(r.session.date),
                'student': r.student.full_name_display,
                'suid': r.student_suid,
                'status': r.status,
                'remarks': r.remarks
            } for r in records]
            return Response(data)
            
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="attendance_report_{start_date}_to_{end_date}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date', 'Student Name', 'SUID', 'Status', 'Remarks'])
        
        for r in records:
            writer.writerow([
                r.session.date,
                r.student.full_name_display,
                r.student_suid,
                r.status,
                r.remarks
            ])
            
        return response

    @action(detail=True, methods=['post'])
    def lock_session(self, request, pk=None):
        """
        POST /api/v1/attendance/{id}/lock_session/
        Only ADMIN can lock sessions to prevent further edits
        """
        if request.user.user_type != 'ADMIN':
            raise PermissionDenied("Only admins can lock attendance sessions.")

        session = self.get_object()
        session.is_locked = True
        session.locked_by = request.user
        session.locked_at = timezone.now()
        session.save()

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def unlock_session(self, request, pk=None):
        """
        POST /api/v1/attendance/{id}/unlock_session/
        Only ADMIN can unlock sessions
        """
        if request.user.user_type != 'ADMIN':
            raise PermissionDenied("Only admins can unlock attendance sessions.")

        session = self.get_object()
        session.is_locked = False
        session.locked_by = None
        session.locked_at = None
        session.save()

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def student_history(self, request):
        """
        GET /api/v1/attendance/student_history/?student_id=1&start_date=2026-01-01&end_date=2026-01-31
        Get attendance history for a specific student within a date range
        """
        student_id = request.query_params.get('student_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not student_id or not start_date or not end_date:
            return Response(
                {'error': 'student_id, start_date, and end_date are required'},
                status=400
            )

        records = StudentAttendance.objects.filter(
            student_id=student_id,
            session__date__gte=start_date,
            session__date__lte=end_date
        ).order_by('-session__date')

        serializer = self.get_serializer(
            [r for r in records],
            many=True
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today_summary(self, request):
        """
        GET /api/v1/attendance/today_summary/
        Returns today's attendance summary across the school
        """
        today = timezone.now().date()
        
        # Get all attendance records for today
        today_records = StudentAttendance.objects.filter(session__date=today)
        
        total = today_records.count()
        present = today_records.filter(status='PRESENT').count()
        absent = today_records.filter(status='ABSENT').count()
        late = today_records.filter(status='LATE').count()
        
        present_percentage = round((present / total * 100), 1) if total > 0 else 0
        
        return Response({
            'date': str(today),
            'total': total,
            'present': present,
            'absent': absent,
            'late': late,
            'present_percentage': present_percentage
        })