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
from apps.core.school_isolation import SchoolIsolationMixin

def is_grade_11_or_12(grade_name):
    if not grade_name:
        return False
    clean_grade = str(grade_name).lower().replace("grade", "").strip()
    return clean_grade in ['11', '12']

def is_class_teacher_for_session(user, session):
    """
    Check if the user is the designated Class Teacher for the session's grade & section.
    Admins are always allowed. Subject teachers are read-only.
    """
    if not user or not user.is_authenticated:
        return False

    if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
        return True

    from apps.accounts.permission_utils import get_teacher_for_user
    from apps.teachers.models import Teacher, TeacherAssignment
    from apps.academics.models import Section

    teacher = get_teacher_for_user(user)
    if not teacher:
        teacher = Teacher.objects.filter(user=user).first()
    if not teacher:
        return False

    clean_grade = str(session.grade).replace('Grade', '').replace('grade', '').strip()

    # 1. Check Section class_teacher assignment
    sec_match = Section.objects.filter(
        class_teacher=teacher,
        section_letter__iexact=session.section,
        is_active=True
    ).filter(
        Q(grade_config__grade_name__iexact=session.grade) |
        Q(grade_config__grade_name__iexact=clean_grade)
    ).exists()
    if sec_match:
        return True

    # 2. Check TeacherAssignment with CLASS_TEACHER role
    ta_match = TeacherAssignment.objects.filter(
        teacher=teacher,
        role='CLASS_TEACHER',
        is_active=True,
        section__iexact=session.section
    ).filter(
        Q(grade__iexact=session.grade) |
        Q(grade__iexact=clean_grade)
    ).exists()
    if ta_match:
        return True

    return False

class AttendanceViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = AttendanceSession.objects.all()
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    school_field = 'school'

    def get_permissions(self):
        if self.action == 'student_attendance':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['student_attendance']:
            return
        super().check_permissions(request)


    
    # RBAC Configuration
    rbac_module = 'attendance'
    rbac_resource = 'attendance'
    rbac_action_permissions = {
        'list': 'attendance.view_attendance',
        'retrieve': 'attendance.view_attendance',
        'daily_register': 'attendance.view_attendance',
        'stats': 'attendance.view_attendance',
        'student_report': 'attendance.view_attendance',
        'export': 'attendance.view_attendance',
        'section_summary': 'attendance.view_attendance',
        'student_grade_stats': 'attendance.view_attendance',
        'today_summary': 'attendance.view_attendance',
        'student_history': 'attendance.view_attendance',
        
        'create': 'attendance.change_attendance',
        'update': 'attendance.change_attendance',
        'partial_update': 'attendance.change_attendance',
        'destroy': 'attendance.change_attendance',
        'mark_bulk': 'attendance.change_attendance',
        'lock_session': 'attendance.change_attendance',
        'unlock_session': 'attendance.change_attendance',
    }

    def check_section_scope(self, request, grade, section, required_permission):
        """Check if the user is scoped to access the given grade & section"""
        user = request.user
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        from apps.accounts.permission_utils import get_user_roles, get_teacher_for_user
        from apps.core.school_isolation import get_user_school
        from apps.teachers.models import Teacher, TeacherAssignment
        from apps.academics.models import Section
        from django.db.models import Q

        school = get_user_school(user)
        clean_grade = str(grade).replace('Grade', '').replace('grade', '').replace('Class', '').replace('class', '').strip()

        teacher_obj = get_teacher_for_user(user) or Teacher.objects.filter(user=user).first()
        if teacher_obj:
            has_assignment = TeacherAssignment.objects.filter(
                teacher=teacher_obj,
                is_active=True
            ).filter(
                Q(grade__iexact=grade) | Q(grade__icontains=clean_grade),
                section__iexact=section
            )
            if school:
                has_assignment = has_assignment.filter(school=school)
            
            sec_assignment = Section.objects.filter(
                section_letter__iexact=section,
                is_active=True
            ).filter(
                Q(class_teacher=teacher_obj) | Q(co_class_teacher=teacher_obj) | Q(subject_mappings__teacher=teacher_obj)
            ).filter(
                Q(grade_config__grade_name__iexact=grade) | Q(grade_config__grade_name__icontains=clean_grade)
            )
            if school:
                sec_assignment = sec_assignment.filter(school=school)

            if has_assignment.exists() or sec_assignment.exists():
                return True

            raise PermissionDenied("You do not have active assignment or permission to access attendance for this grade and section.")

        # Check role-based scopes if any
        roles = get_user_roles(user, school)
        possible_grade_names = [grade, clean_grade, f"Grade {clean_grade}", f"Class {clean_grade}"]
        for role in roles:
            if role.permissions.filter(codename=required_permission).exists():
                scopes = role.attendance_section_scopes.all()
                if school:
                    scopes = scopes.filter(grade_config__school=school)
                if not scopes.exists():
                    return True
                if scopes.filter(
                    Q(grade_config__grade_name__in=possible_grade_names) | Q(grade_config__grade_name__icontains=clean_grade),
                    section_letter__iexact=section
                ).exists():
                    return True

        raise PermissionDenied("You do not have permission to access attendance for this grade and section.")

    def get_queryset(self):
        """Get attendance sessions filtered by user role"""
        user = self.request.user
        queryset = super().get_queryset().order_by('-date')
        
        # Check permissions and filter by attendance_section_scopes
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_roles
            from apps.core.school_isolation import get_user_school
            school = get_user_school(user)
            roles = get_user_roles(user, school)
            
            # Combine scopes across all roles the user possesses
            has_limitations = False
            allowed_sections = []
            
            for role in roles:
                if role.permissions.filter(codename='attendance.view_attendance').exists():
                    scopes = role.attendance_section_scopes.all()
                    if scopes.exists():
                        has_limitations = True
                        allowed_sections.extend(list(scopes))
                    else:
                        has_limitations = False
                        break
            
            if has_limitations:
                from django.db.models import Q
                q_filter = Q()
                for sec in allowed_sections:
                    q_filter |= Q(grade=sec.grade_config.grade_name, section=sec.section_letter)
                queryset = queryset.filter(q_filter)
                
        return queryset

    @action(detail=False, methods=['get'])
    def section_summary(self, request):
        """
        GET /api/v1/attendance/section_summary/?grade=10&section=A&subject=subject_uuid
        
        Calculates the attendance percentage/stats for all active students in the section.
        """
        if not can(request.user, 'VIEW_ATTENDANCE', 'ATTENDANCE_SYSTEM'):
            raise PermissionDenied("Access Denied: Attendance System")

        grade = request.query_params.get('grade')
        section = request.query_params.get('section')
        subject_id = request.query_params.get('subject')

        if not grade or not section:
            return Response({'error': 'Grade and Section are required'}, status=400)

        self.check_section_scope(request, grade, section, 'attendance.view_attendance')

        is_high_school = is_grade_11_or_12(grade)
        
        school = self.get_user_school()
        from apps.schools.models_calendar import Holiday
        holiday_dates = Holiday.objects.filter(school=school).values_list('date', flat=True) if school else Holiday.objects.values_list('date', flat=True)

        if is_high_school:
            if not subject_id:
                return Response({'error': 'Subject is required for Grade 11/12'}, status=400)
            sessions = AttendanceSession.objects.filter(
                school=school,
                grade=grade,
                section=section,
                session_type='PERIOD',
                subject_id=subject_id,
                is_locked=True
            )
        else:
            sessions = AttendanceSession.objects.filter(
                school=school,
                grade=grade,
                section=section,
                session_type='DAILY',
                is_locked=True
            )

        sessions = sessions.exclude(date__week_day=1).exclude(date__in=holiday_dates)

        from django.db.models import Q
        clean_grade = str(grade).replace('Grade', '').replace('grade', '').strip()

        student_filter = (
            Q(current_section__grade_config__grade_name__iexact=grade) |
            Q(current_section__grade_config__grade_name__iexact=clean_grade) |
            Q(enrollments__grade__iexact=grade) |
            Q(enrollments__grade__iexact=clean_grade)
        ) & (
            Q(current_section__section_letter__iexact=section) |
            Q(enrollments__section__iexact=section)
        )
        if school:
            student_filter &= Q(school=school)

        students = Student.objects.filter(
            student_filter,
            status='ACTIVE'
        ).distinct()

        records = StudentAttendance.objects.filter(
            session__in=sessions,
            student__in=students
        )

        summary = {}
        for student in students:
            summary[str(student.id)] = {
                'present': 0,
                'total': 0,
                'percentage': 100.0
            }

        for record in records:
            student_id = str(record.student_id)
            if student_id in summary:
                summary[student_id]['total'] += 1
                if record.status in ['PRESENT', 'LATE']:
                    summary[student_id]['present'] += 1

        for student_id, stats in summary.items():
            if stats['total'] > 0:
                stats['percentage'] = round((stats['present'] / stats['total']) * 100, 1)
            else:
                stats['percentage'] = 100.0

        return Response(summary)

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
            if request.user.user_type not in ['TEACHER', 'SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'ROLE'] and not hasattr(request.user, 'teacher_profile'):
                raise PermissionDenied("Access Denied: Attendance System")

        grade = request.query_params.get('grade')
        section = request.query_params.get('section')
        date_str = request.query_params.get('date', str(timezone.now().date()))
        subject_id = request.query_params.get('subject')

        if not grade or not section:
            return Response({'error': 'Grade and Section are required'}, status=400)

        self.check_section_scope(request, grade, section, 'attendance.view_attendance')

        # Check if date is in the future
        try:
            date_val = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format'}, status=400)
            
        if date_val > timezone.now().date():
            return Response({'error': 'Attendance cannot be marked for future dates.'}, status=400)

        # Check Sunday or Holiday
        from apps.schools.models_calendar import Holiday
        school = self.get_user_school()
        is_sunday = (date_val.weekday() == 6)
        is_holiday = Holiday.objects.filter(school=school, date=date_val).exists() if school else Holiday.objects.filter(date=date_val).exists()
        
        if is_sunday or is_holiday:
            return Response({'error': 'Attendance cannot be marked on a Sunday or a school holiday.'}, status=400)

        is_high_school = is_grade_11_or_12(grade)
        session_type = 'PERIOD' if is_high_school else 'DAILY'
        
        if is_high_school and not subject_id:
            return Response({'error': 'Subject is required for Grade 11/12'}, status=400)

        actual_subject_id = subject_id if is_high_school else None

        # Canonicalize grade and section from Section model
        from apps.academics.models import Section
        clean_grade = str(grade).replace('Grade', '').replace('grade', '').strip()
        
        sec_qs = Section.objects.filter(
            Q(grade_config__grade_name__iexact=grade) |
            Q(grade_config__grade_name__iexact=clean_grade) |
            Q(grade_config__grade_name__iexact=f"Grade {clean_grade}"),
            section_letter__iexact=section
        )
        if school:
            sec_qs = sec_qs.filter(school=school)
        sec_obj = sec_qs.first()

        canonical_grade = sec_obj.grade_config.grade_name if sec_obj else grade
        canonical_section = sec_obj.section_letter if sec_obj else section

        possible_grades = [
            grade,
            clean_grade,
            f"Grade {clean_grade}",
            canonical_grade
        ]
        if sec_obj:
            possible_grades.append(sec_obj.full_name)

        # 1. Try to find existing session using any grade variant
        session = AttendanceSession.objects.filter(
            school=school,
            grade__in=possible_grades,
            section=canonical_section,
            date=date_str,
            session_type=session_type,
            subject_id=actual_subject_id
        ).first()

        if not session:
            session = AttendanceSession.objects.create(
                school=school,
                grade=canonical_grade,
                section=canonical_section,
                date=date_str,
                session_type=session_type,
                subject_id=actual_subject_id,
                created_by=request.user
            )

        # 2. Sync students dynamically
        current_students = Student.objects.none()
        if sec_obj:
            current_students = Student.objects.filter(
                current_section=sec_obj,
                status__in=['ACTIVE', 'TEMPORARY']
            )
            if school:
                current_students = current_students.filter(school=school)
            current_students = current_students.distinct()

        if not current_students.exists():
            clean_grade = str(canonical_grade).replace('Grade', '').replace('grade', '').strip()
            reg_student_filter = (
                Q(current_section__grade_config__grade_name__iexact=canonical_grade) |
                Q(current_section__grade_config__grade_name__iexact=clean_grade) |
                Q(grade_config__grade_name__iexact=canonical_grade) |
                Q(enrollments__grade__iexact=canonical_grade) |
                Q(enrollments__grade__iexact=clean_grade)
            ) & (
                Q(current_section__section_letter__iexact=canonical_section) |
                Q(enrollments__section__iexact=canonical_section)
            )
            if school:
                reg_student_filter &= Q(school=school)

            current_students = Student.objects.filter(
                reg_student_filter,
                status__in=['ACTIVE', 'TEMPORARY']
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
                    status='ABSENT',
                    marked_by=request.user
                ))
            StudentAttendance.objects.bulk_create(bulk_records)

        # Remove students who are no longer in this grade/section
        # (Only if not already marked with a specific status or if it was just a default PRESENT)
        to_remove = existing_student_ids - current_student_ids
        if to_remove:
            session.records.filter(student_id__in=to_remove).delete()

        # 3. Return the full register with enhanced serializer
        session = AttendanceSession.objects.prefetch_related('records__student__user').get(id=session.id)
        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """
        POST /api/v1/attendance/batch_update/
        Payload: {
            "session_id": 1,
            "records": [ {"id": 10, "status": "PRESENT", "remarks": ""}, ... ]
        }
        """
        if not can(request.user, 'MARK_ATTENDANCE', 'ATTENDANCE_SYSTEM'):
            if request.user.user_type not in ['TEACHER', 'SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'ROLE'] and not hasattr(request.user, 'teacher_profile'):
                raise PermissionDenied("You do not have permission to mark attendance.")

        session_id = request.data.get('session_id')
        records = request.data.get('records', [])

        if not session_id:
            return Response({'error': 'session_id is required'}, status=400)

        try:
            session = AttendanceSession.objects.get(id=session_id)
        except AttendanceSession.DoesNotExist:
            return Response({'error': 'Attendance session not found'}, status=404)

        if not is_class_teacher_for_session(request.user, session):
            return Response(
                {'error': 'Access Denied: Only the designated Class Teacher can modify attendance for this class register. Subject Teachers have view-only access.'},
                status=403
            )

        if session.date > timezone.now().date():
            return Response({'error': 'Attendance cannot be marked for future dates.'}, status=400)

        if session.is_locked:
            return Response({'error': 'This attendance register is locked. Please unlock it to make changes.'}, status=403)

        updated_count = 0
        for r in records:
            rec_id = r.get('id')
            status = r.get('status')
            remarks = r.get('remarks', '')

            rec = StudentAttendance.objects.filter(session=session).filter(
                Q(id=rec_id) | Q(student_id=rec_id)
            ).first()

            if rec:
                rec.status = status
                rec.remarks = remarks
                rec.edited_by = request.user
                rec.save()
                updated_count += 1

        return Response({
            'message': 'Attendance saved successfully',
            'updated_count': updated_count
        })

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
            if request.user.user_type not in ['TEACHER', 'SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'ROLE'] and not hasattr(request.user, 'teacher_profile'):
                raise PermissionDenied("You do not have permission to mark attendance.")

        session = self.get_object()
        
        # Check if date is in the future
        if session.date > timezone.now().date():
            return Response({'error': 'Attendance cannot be marked for future dates.'}, status=400)
        
        # Check if session is locked
        if session.is_locked:
            return Response({'error': 'This attendance register is locked. Please unlock it to make changes.'}, status=403)

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
        grade_param = request.query_params.get('grade', '').strip()
        section_param = request.query_params.get('section', '').strip()
        
        school = self.get_user_school()
        from apps.schools.models_calendar import Holiday
        from apps.students.models import Student
        from django.db.models import Q
        holiday_dates = Holiday.objects.filter(school=school).values_list('date', flat=True) if school else Holiday.objects.values_list('date', flat=True)

        student_qs = Student.objects.select_related(
            'school', 'user', 'grade_config', 'current_section'
        ).prefetch_related('enrollments')

        if school:
            student_qs = student_qs.filter(school=school)

        if hasattr(Student, 'status'):
            student_qs = student_qs.filter(status__in=['ACTIVE', 'TEMPORARY', 'ENROLLED', 'PROMOTED'])

        if grade_param:
            student_qs = student_qs.filter(
                Q(enrollments__grade__iexact=grade_param) |
                Q(grade_config__grade_name__iexact=grade_param) |
                Q(current_section__grade_config__grade_name__iexact=grade_param)
            ).distinct()

        if section_param:
            student_qs = student_qs.filter(
                Q(enrollments__section__iexact=section_param) |
                Q(current_section__section_letter__iexact=section_param)
            ).distinct()

        student_qs = student_qs.order_by('user__first_name', 'user__last_name', 'suid')

        # Calculate overall attendance percentages per student
        student_ids = list(student_qs.values_list('id', flat=True))
        all_records = StudentAttendance.objects.filter(
            student_id__in=student_ids,
            session__is_locked=True
        ).exclude(session__date__week_day=1).exclude(session__date__in=holiday_dates)

        student_stats = {sid: {'present': 0, 'total': 0} for sid in student_ids}
        for rec in all_records:
            sid = rec.student_id
            if sid in student_stats:
                student_stats[sid]['total'] += 1
                if rec.status in ['PRESENT', 'LATE']:
                    student_stats[sid]['present'] += 1

        student_percentages = {}
        for sid, stats in student_stats.items():
            if stats['total'] > 0:
                pct = round((stats['present'] / stats['total']) * 100.0, 2)
            else:
                pct = 100.0
            student_percentages[sid] = f"{pct}%"

        headers = ['Name', 'Grade', 'Section', 'Student Name', 'SUID', 'Attendance (%)']
        data_rows = []
        for s in student_qs:
            school_name = s.school.name if s.school else (school.name if school else '')
            grade_str = ''
            section_str = ''
            active_enrollment = s.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY', 'PROMOTED']).first()
            if active_enrollment:
                grade_str = str(active_enrollment.grade)
                section_str = str(active_enrollment.section)
            else:
                if s.grade_config:
                    grade_str = str(s.grade_config.grade_name)
                if s.current_section:
                    section_str = str(s.current_section.section_letter)

            student_name = s.full_name_display or (s.user.full_name if s.user else s.suid)
            suid = s.suid or ''
            att_pct = student_percentages.get(s.id, '100.0%')

            data_rows.append([
                school_name,
                grade_str,
                section_str,
                student_name,
                suid,
                att_pct
            ])
        
        if format_type == 'json':
            data = [{
                'Name': r[0],
                'Grade': r[1],
                'Section': r[2],
                'Student Name': r[3],
                'SUID': r[4],
                'Attendance (%)': r[5]
            } for r in data_rows]
            return Response(data)
            
        label = f"attendance_report_{start_date}_to_{end_date}" if start_date and end_date else "attendance_report"
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{label}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(headers)
        writer.writerows(data_rows)
        return response

    @action(detail=True, methods=['post'])
    def lock_session(self, request, pk=None):
        """
        POST /api/v1/attendance/{id}/lock_session/
        """
        session = self.get_object()
        if not is_class_teacher_for_session(request.user, session):
            return Response(
                {'error': 'Access Denied: Only the designated Class Teacher can lock the attendance register for this class.'},
                status=403
            )

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
        """
        session = self.get_object()
        if not is_class_teacher_for_session(request.user, session):
            return Response(
                {'error': 'Access Denied: Only the designated Class Teacher can unlock the attendance register for this class.'},
                status=403
            )

        # Enforce unlocking restriction: permission for unlocking shall only be for the past 2 day's attendance from the current date.
        today = timezone.now().date()
        if session.date < today - timezone.timedelta(days=2):
            return Response({'error': "Unlocking is only allowed for the past 2 days' attendance."}, status=400)

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

        school = self.get_user_school()
        from apps.schools.models_calendar import Holiday
        holiday_dates = Holiday.objects.filter(school=school).values_list('date', flat=True) if school else Holiday.objects.values_list('date', flat=True)

        records = StudentAttendance.objects.filter(
            student_id=student_id,
            session__date__gte=start_date,
            session__date__lte=end_date
        ).exclude(
            session__date__week_day=1
        ).exclude(
            session__date__in=holiday_dates
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
        # Check if Sunday or Holiday
        from apps.schools.models_calendar import Holiday
        from django.utils import timezone
        today = timezone.now().date()
        school = self.get_user_school()
        is_sunday = (today.weekday() == 6)
        is_holiday = Holiday.objects.filter(school=school, date=today).exists() if school else Holiday.objects.filter(date=today).exists()
        
        if is_sunday or is_holiday:
            return Response({
                'date': str(today),
                'total': 0,
                'present': 0,
                'absent': 0,
                'late': 0,
                'present_percentage': 0.0,
                'message': 'Today is a Sunday or a holiday.'
            })

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

    @action(detail=False, methods=['get'])
    def student_grade_stats(self, request):
        """
        GET /api/v1/attendance/student_grade_stats/?student_id=1&grade=1
        """
        student_id = request.query_params.get('student_id')
        grade = request.query_params.get('grade')
        
        if not student_id or not grade:
            return Response({'error': 'student_id and grade are required'}, status=400)
            
        school = self.get_user_school()
        
        try:
            student = Student.objects.get(id=student_id, school=school)
            sec_letter = student.current_section.section_letter if student.current_section else '-'
            self.check_section_scope(request, grade, sec_letter, 'attendance.view_attendance')
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)
        
        records = StudentAttendance.objects.filter(
            student__school=school,
            student_id=student_id,
            session__grade=grade,
            session__session_type='DAILY',
            session__is_locked=True
        )
        
        # If there are no locked daily sessions, fallback to all daily sessions
        if not records.exists():
            records = StudentAttendance.objects.filter(
                student__school=school,
                student_id=student_id,
                session__grade=grade,
                session__session_type='DAILY'
            )
            
        # If still none, fallback to PERIOD sessions (for high school)
        if not records.exists():
            records = StudentAttendance.objects.filter(
                student__school=school,
                student_id=student_id,
                session__grade=grade,
                session__session_type='PERIOD'
            )

        total_days = records.count()
        days_present = records.filter(status__in=['PRESENT', 'LATE']).count()
        days_absent = total_days - days_present
        percentage = round((days_present / total_days * 100), 1) if total_days > 0 else 100.0
        
        return Response({
            'percentage': percentage,
            'days_present': days_present,
            'total_days': total_days,
            'days_absent': days_absent
        })

    @action(detail=False, methods=['get'])
    def student_attendance(self, request):
        """
        Get historical locked attendance records and overall attendance percentage for a student.
        Calculates attendance percentage in the exact same way as Discipline & Consistency in Marks Entry:
        Only considers sessions where is_locked=True (excluding Sundays & Holidays).
        Accepts optional start_date and end_date query params (defaults to previous 7 days).
        """
        user = request.user
        from apps.students.models import Student
        from apps.schools.models_calendar import Holiday
        from datetime import datetime, timedelta

        student = Student.objects.filter(user=user).first()
        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found for this user.'}, status=404)

        school = student.school or self.get_user_school()
        if not school:
            return Response({'error': 'School context not found for student.'}, status=400)

        # 1. Determine grade and section for this student
        section_obj = getattr(student, 'current_section', None)
        grade_obj = getattr(student, 'grade_config', None)

        enrollment = student.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY']).first()
        if not section_obj and enrollment and getattr(enrollment, 'section', None):
            from apps.academics.models import Section
            if isinstance(enrollment.section, Section):
                section_obj = enrollment.section
            elif isinstance(enrollment.section, str):
                section_obj = Section.objects.filter(school=school, section_letter__iexact=enrollment.section.strip()).first()

        if not grade_obj and enrollment and getattr(enrollment, 'grade', None):
            from apps.schools.models_programs import GradeConfiguration
            grade_obj = GradeConfiguration.objects.filter(school=school, grade_name__iexact=str(enrollment.grade).strip()).first()

        if not grade_obj and section_obj and getattr(section_obj, 'grade_config', None):
            grade_obj = section_obj.grade_config

        grade_str = grade_obj.grade_name if grade_obj else 'N/A'
        section_str = section_obj.section_letter if section_obj else (getattr(section_obj, 'name', 'A') if section_obj else 'A')
        clean_grade = str(grade_str).replace('Grade', '').replace('grade', '').strip()

        # 2. Get school holidays
        holiday_dates = Holiday.objects.filter(school=school).values_list('date', flat=True) if school else Holiday.objects.values_list('date', flat=True)

        # 3. Query locked attendance records directly for this student
        all_locked_records = StudentAttendance.objects.filter(
            student=student,
            session__is_locked=True
        ).exclude(
            session__date__week_day=1
        ).exclude(
            session__date__in=holiday_dates
        )

        # Fallback: Check if any attendance records exist for this student if registers aren't locked yet
        if not all_locked_records.exists():
            all_locked_records = StudentAttendance.objects.filter(
                student=student
            ).exclude(
                session__date__week_day=1
            ).exclude(
                session__date__in=holiday_dates
            )

        total_conducted = all_locked_records.count()
        present_count = all_locked_records.filter(status__in=['PRESENT', 'LATE']).count()
        absent_count = all_locked_records.filter(status='ABSENT').count()
        late_count = all_locked_records.filter(status='LATE').count()
        excused_count = all_locked_records.filter(status__in=['EXCUSED', 'MEDICAL', 'OUT']).count()

        if total_conducted > 0:
            overall_percentage = round((present_count / total_conducted) * 100, 1)
        else:
            overall_percentage = 0.0


        # 4. Date Range Filter for Recent Daily Logs (Defaults to previous 7 days including today)
        today = datetime.now().date()
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if start_date_str and end_date_str:
            try:
                start_d = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_d = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                end_d = today
                start_d = today - timedelta(days=6)
        else:
            end_d = today
            start_d = today - timedelta(days=6)

        # Filter logs for the selected date range from LOCKED sessions
        range_records = all_locked_records.filter(
            session__date__gte=start_d,
            session__date__lte=end_d
        ).select_related('session', 'session__subject').order_by('-session__date', '-session__created_at')

        logs = []
        for r in range_records:
            sess = r.session
            logs.append({
                'id': str(r.id),
                'date': str(sess.date),
                'day_name': sess.date.strftime('%A'),
                'session_type': sess.session_type,
                'session_type_display': sess.get_session_type_display(),
                'subject_name': sess.subject.name if sess.subject else 'Full Day Attendance',
                'status': r.status,
                'status_display': r.get_status_display(),
                'time_in': r.time_in.strftime('%H:%M') if r.time_in else None,
                'remarks': r.remarks or '',
                'is_locked': True
            })

        student_name = ""
        if student.user:
            student_name = student.user.get_full_name().strip()
        if not student_name:
            student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        if not student_name:
            student_name = getattr(student, 'full_name_display', '') or student.suid or 'Student'

        return Response({
            'student_name': student_name,
            'suid': student.suid,
            'grade': grade_str,
            'section': section_str,
            'school_name': school.display_name or school.legal_name,
            'overall_percentage': overall_percentage,
            'total_conducted': total_conducted,
            'present_count': present_count,
            'absent_count': absent_count,
            'late_count': late_count,
            'excused_count': excused_count,
            'start_date': str(start_d),
            'end_date': str(end_d),
            'logs': logs
        }, status=status.HTTP_200_OK)