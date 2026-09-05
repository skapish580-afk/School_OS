from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.accounts.permission_utils import RBACPermission
from apps.students.models import Student
from .models import Route, Stop, Vehicle, TransportAssignment, TransportAttendance, VehicleDailyStatus
from apps.attendance.models import AttendanceSession, StudentAttendance
from .serializers import RouteSerializer, StopSerializer, VehicleSerializer, TransportAssignmentSerializer
from apps.core.school_isolation import SchoolIsolationMixin

class RouteViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'transport'
    rbac_resource = 'route'
    rbac_action_permissions = {
        'list': 'transport.view_route',
        'retrieve': 'transport.view_route',
        'create': 'transport.assign_route',
        'update': 'transport.assign_route',
        'partial_update': 'transport.assign_route',
        'destroy': 'transport.assign_route',
    }

    def perform_create(self, serializer):
        serializer.save(school=self.get_user_school())

class StopViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'transport'
    rbac_resource = 'stop'
    school_field = 'route__school'
    rbac_action_permissions = {
        'list': 'transport.view_route',
        'retrieve': 'transport.view_route',
        'create': 'transport.assign_route',
        'update': 'transport.assign_route',
        'partial_update': 'transport.assign_route',
        'destroy': 'transport.assign_route',
    }

from rest_framework.decorators import action
def check_transport_attendance_lock(vehicle, date_val):
    """
    Checks if transport attendance is locked for a given vehicle and date.
    Returns (is_locked, lock_reason).
    """
    from apps.attendance.models import AttendanceSession
    from .models import VehicleDailyStatus

    # 1. Check if Attendance module has locked attendance register for this date in the school
    if vehicle.school and AttendanceSession.objects.filter(school=vehicle.school, date=date_val, is_locked=True).exists():
        return True, "Attendance register for this date has been locked in the Attendance module."

    # 2. Check if Reached School button was clicked for this bus on this date
    if VehicleDailyStatus.objects.filter(vehicle=vehicle, date=date_val, reached_school=True).exists():
        return True, f"Bus {vehicle.school_bus_number or vehicle.registration_number} has reached school for this date. Attendance is now uneditable."

    return False, ""

class VehicleViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Vehicle.objects.select_related('route').all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'transport'
    rbac_resource = 'vehicle'
    rbac_action_permissions = {
        'list': None,
        'retrieve': None,
        'create': 'transport.edit_bus',
        'update': 'transport.edit_bus',
        'partial_update': 'transport.edit_bus',
        'destroy': 'transport.edit_bus',
        'assign_students': ['transport.assign_route', 'transport.edit_bus'],
        'geocode_students': None,
        'get_attendance': None,
        'arrive_at_student': None,
        'reach_school': None,
        'leave_school': None,
        'mark_attendance': None,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return queryset
            
        from apps.accounts.permission_utils import get_user_permissions
        school = self.get_user_school()
        user_perms = get_user_permissions(user, school)
        
        has_specific_bus_perms = any(p.startswith('transport.mark_attendance_') for p in user_perms)
        
        # If user has general manage/view permissions AND no specific bus restrictions, return all school vehicles
        if any(p in user_perms for p in ['transport.view_transport', 'transport.edit_bus', 'transport.view_route', 'transport.assign_route']) or (not has_specific_bus_perms and 'transport.mark_attendance' in user_perms):
            return queryset
            
        # Otherwise, filter vehicles to only those the user has specific mark_attendance permissions for
        allowed_vehicle_ids = []
        for perm in user_perms:
            if perm.startswith('transport.mark_attendance_'):
                v_id_str = perm.replace('transport.mark_attendance_', '')
                try:
                    allowed_vehicle_ids.append(int(v_id_str))
                except ValueError:
                    allowed_vehicle_ids.append(v_id_str)
                
        return queryset.filter(id__in=allowed_vehicle_ids)

    def perform_create(self, serializer):
        # Automatically assign the school of the creator
        school = self.get_user_school()
        serializer.save(school=school)

    def perform_update(self, serializer):
        instance = serializer.save()
        # If route is updated, sync it to all transport assignments
        if 'route' in serializer.validated_data:
            TransportAssignment.objects.filter(vehicle=instance).update(route=instance.route)

    @action(detail=True, methods=['post'])
    def geocode_students(self, request, pk=None):
        """Deprecated geocoding: Now just returns current student coordinates"""
        return Response({'status': 'complete', 'message': 'Coordinates are now managed in Student Profile.'})

    @action(detail=True, methods=['post'])
    def assign_students(self, request, pk=None):
        vehicle = self.get_object()
        student_ids = request.data.get('student_ids', [])
        
        results = {
            'total': len(student_ids),
            'processed': 0
        }
        
        for idx, s_id in enumerate(student_ids):
            student = Student.objects.get(id=s_id)
            
            TransportAssignment.objects.update_or_create(
                student=student,
                defaults={
                    'vehicle': vehicle, 
                    'route': vehicle.route,
                    'order': idx
                }
            )
            results['processed'] += 1
        
        return Response({
            'status': 'students processed',
            'results': results
        })

    @action(detail=True, methods=['get'])
    def get_attendance(self, request, pk=None):
        vehicle = self.get_object()
        
        # Check granular permissions
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_permissions
            school = self.get_user_school()
            user_perms = get_user_permissions(user, school)
            bus_permission = f"transport.mark_attendance_{vehicle.id}"
            
            can_view = ('transport.view_transport' in user_perms) or ('transport.mark_attendance' in user_perms) or (bus_permission in user_perms)
            if not can_view:
                return Response({'error': 'You do not have permission to view attendance for this bus.'}, status=403)

        date_str = request.query_params.get('date')
        journey = request.query_params.get('journey')
        
        if not date_str or not journey:
            return Response({'error': 'date and journey are required'}, status=400)
            
        import datetime
        try:
            date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format'}, status=400)

        is_locked, lock_reason = check_transport_attendance_lock(vehicle, date_val)

        assignments = TransportAssignment.objects.filter(
            vehicle=vehicle,
            student__status__in=['ACTIVE', 'TEMPORARY']
        )
        
        from .models import TransportAttendance
        records = TransportAttendance.objects.filter(
            vehicle=vehicle,
            date=date_val,
            journey=journey
        )
        records_dict = {r.student_id: r for r in records}
        
        data = []
        for assign in assignments:
            student = assign.student
            record = records_dict.get(student.id)
            data.append({
                'student_id': student.id,
                'student_name': student.full_name_display,
                'student_suid': student.suid,
                'status': record.status if record else 'ABSENT',
                'remarks': record.remarks if record else '',
                'latitude': float(student.latitude) if student.latitude else None,
                'longitude': float(student.longitude) if student.longitude else None,
            })
            
        return Response({
            'is_locked': is_locked,
            'lock_reason': lock_reason,
            'records': data
        })

    @action(detail=True, methods=['post'])
    def arrive_at_student(self, request, pk=None):
        vehicle = self.get_object()
        
        # Check permissions
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_permissions
            school = self.get_user_school()
            user_perms = get_user_permissions(user, school)
            bus_permission = f"transport.mark_attendance_{vehicle.id}"
            
            can_mark = ('transport.mark_attendance' in user_perms) or (bus_permission in user_perms)
            if not can_mark:
                return Response({'error': 'You do not have permission to update location for this bus.'}, status=403)

        date_str = request.data.get('date')
        if date_str:
            import datetime
            try:
                date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                from django.utils import timezone
                date_val = timezone.now().date()
        else:
            from django.utils import timezone
            date_val = timezone.now().date()

        is_locked, lock_reason = check_transport_attendance_lock(vehicle, date_val)
        if is_locked:
            return Response({'error': lock_reason}, status=403)

        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required'}, status=400)
            
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)
            
        if not student.latitude or not student.longitude:
            return Response({'error': f'Student {student.full_name_display} does not have GPS location coordinates set.'}, status=400)
            
        from django.utils import timezone
        now = timezone.now()
        
        vehicle.current_latitude = student.latitude
        vehicle.current_longitude = student.longitude
        vehicle.last_ping = now
        vehicle.save()
        
        return Response({
            'status': 'success',
            'message': f'Bus location updated to student {student.full_name_display} coordinates.',
            'current_latitude': float(vehicle.current_latitude),
            'current_longitude': float(vehicle.current_longitude),
            'last_ping': vehicle.last_ping.isoformat()
        })

    @action(detail=True, methods=['post'])
    def reach_school(self, request, pk=None):
        vehicle = self.get_object()
        
        # Check permissions
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_permissions
            school = self.get_user_school()
            user_perms = get_user_permissions(user, school)
            bus_permission = f"transport.mark_attendance_{vehicle.id}"
            
            can_mark = ('transport.mark_attendance' in user_perms) or (bus_permission in user_perms)
            if not can_mark:
                return Response({'error': 'You do not have permission to update location for this bus.'}, status=403)

        school = vehicle.school
        school_lat = getattr(school, 'school_latitude', None) or getattr(school, 'latitude', None)
        school_lng = getattr(school, 'school_longitude', None) or getattr(school, 'longitude', None)
        
        if not school_lat or not school_lng:
            return Response({'error': 'School campus GPS coordinates are not configured in School settings.'}, status=400)

        date_str = request.data.get('date')
        if date_str:
            import datetime
            try:
                date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                from django.utils import timezone
                date_val = timezone.now().date()
        else:
            from django.utils import timezone
            date_val = timezone.now().date()

        # Check if attendance is locked in Attendance module
        from apps.attendance.models import AttendanceSession
        if school and AttendanceSession.objects.filter(school=school, date=date_val, is_locked=True).exists():
            return Response({'error': 'Attendance register for this date has been locked in the Attendance module.'}, status=403)
            
        from django.utils import timezone
        now = timezone.now()

        # Save transport attendance records if provided
        records = request.data.get('records', [])
        journey = request.data.get('journey', 'MORNING')

        if records:
            for r in records:
                student_id = r.get('student_id')
                status_val = r.get('status', 'ABSENT')
                remarks = r.get('remarks', '')
                
                try:
                    student = Student.objects.get(id=student_id)
                except Student.DoesNotExist:
                    continue
                    
                TransportAttendance.objects.update_or_create(
                    vehicle=vehicle,
                    student=student,
                    date=date_val,
                    journey=journey,
                    defaults={
                        'status': status_val,
                        'remarks': remarks,
                        'marked_by': user
                    }
                )
                
                # Sync to Daily Attendance if journey is MORNING
                if journey == 'MORNING':
                    try:
                        grade = None
                        section = None
                        
                        enrollment = student.enrollments.filter(status='ACTIVE').first()
                        if enrollment:
                            grade = str(enrollment.grade)
                            section = str(enrollment.section)
                        elif student.current_section:
                            section = str(student.current_section.name)
                            if hasattr(student.current_section, 'grade') and student.current_section.grade:
                                grade = str(student.current_section.grade.name)
                            elif getattr(student, 'grade_config', None):
                                grade = str(student.grade_config)
                        elif getattr(student, 'grade_config', None):
                            grade = str(student.grade_config)
                            section = 'A'
                            
                        grade = grade or 'ALL'
                        section = section or 'A'
                        school = student.school or vehicle.school
                        
                        if school:
                            session, s_created = AttendanceSession.objects.get_or_create(
                                school=school,
                                grade=grade,
                                section=section,
                                date=date_val,
                                session_type='DAILY',
                                defaults={'created_by': user}
                            )
                            
                            sa, sa_created = StudentAttendance.objects.get_or_create(
                                session=session,
                                student=student,
                                defaults={
                                    'status': status_val,
                                    'student_suid': student.suid,
                                    'remarks': f"Bus Morning Attendance: {remarks}".strip() if remarks else "Marked via Bus Attendance",
                                    'marked_by': user
                                }
                            )
                            if not sa_created:
                                sa.status = status_val
                                sa.remarks = f"Bus Morning Attendance: {remarks}".strip() if remarks else "Marked via Bus Attendance"
                                sa.edited_by = user
                                sa.save()
                    except Exception as e:
                        print(f"[TRANSPORT] Error syncing student {student.suid} to daily attendance: {e}")

        # Mark VehicleDailyStatus for this vehicle and date
        VehicleDailyStatus.objects.update_or_create(
            vehicle=vehicle,
            date=date_val,
            defaults={
                'reached_school': True,
                'reached_school_at': now
            }
        )
        
        vehicle.current_latitude = school_lat
        vehicle.current_longitude = school_lng
        vehicle.current_status = 'REACHED_SCHOOL'
        vehicle.last_ping = now
        vehicle.save()
        
        return Response({
            'status': 'success',
            'message': f'Bus {vehicle.registration_number} location updated to School Campus. Attendance saved and locked.',
            'current_latitude': float(vehicle.current_latitude),
            'current_longitude': float(vehicle.current_longitude),
            'last_ping': vehicle.last_ping.isoformat(),
            'is_locked': True,
            'lock_reason': f"Bus {vehicle.school_bus_number or vehicle.registration_number} has reached school for this date. Attendance is now uneditable."
        })

    @action(detail=True, methods=['post'])
    def leave_school(self, request, pk=None):
        vehicle = self.get_object()
        
        # Check permissions
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_permissions
            school = self.get_user_school()
            user_perms = get_user_permissions(user, school)
            bus_permission = f"transport.mark_attendance_{vehicle.id}"
            
            can_mark = ('transport.mark_attendance' in user_perms) or (bus_permission in user_perms)
            if not can_mark:
                return Response({'error': 'You do not have permission to update location for this bus.'}, status=403)

        date_str = request.data.get('date')
        if date_str:
            import datetime
            try:
                date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                from django.utils import timezone
                date_val = timezone.now().date()
        else:
            from django.utils import timezone
            date_val = timezone.now().date()

        is_locked, lock_reason = check_transport_attendance_lock(vehicle, date_val)
        if is_locked:
            return Response({'error': lock_reason}, status=403)

        school = vehicle.school
        school_lat = getattr(school, 'school_latitude', None) or getattr(school, 'latitude', None)
        school_lng = getattr(school, 'school_longitude', None) or getattr(school, 'longitude', None)
        
        if not school_lat or not school_lng:
            return Response({'error': 'School campus GPS coordinates are not configured in School settings.'}, status=400)
            
        from django.utils import timezone
        now = timezone.now()
        
        vehicle.current_latitude = school_lat
        vehicle.current_longitude = school_lng
        vehicle.current_status = 'LEFT_SCHOOL'
        vehicle.last_ping = now
        vehicle.save()
        
        return Response({
            'status': 'success',
            'message': f'Bus {vehicle.registration_number} location updated to School Campus (Departed).',
            'current_latitude': float(vehicle.current_latitude),
            'current_longitude': float(vehicle.current_longitude),
            'last_ping': vehicle.last_ping.isoformat()
        })

    @action(detail=True, methods=['post'])
    def mark_attendance(self, request, pk=None):
        vehicle = self.get_object()
        
        # Check granular permissions
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_permissions
            school = self.get_user_school()
            user_perms = get_user_permissions(user, school)
            bus_permission = f"transport.mark_attendance_{vehicle.id}"
            
            can_mark = ('transport.mark_attendance' in user_perms) or (bus_permission in user_perms)
            if not can_mark:
                return Response({'error': 'You do not have permission to mark attendance for this bus.'}, status=403)

        date_str = request.data.get('date')
        journey = request.data.get('journey')
        records = request.data.get('records', [])
        
        if not date_str or not journey:
            return Response({'error': 'date and journey are required'}, status=400)

        import datetime
        try:
            date_val = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format'}, status=400)

        is_locked, lock_reason = check_transport_attendance_lock(vehicle, date_val)
        if is_locked:
            return Response({'error': lock_reason}, status=403)
            
        user = request.user
        updated_count = 0
        
        for r in records:
            student_id = r.get('student_id')
            status_val = r.get('status', 'ABSENT')
            remarks = r.get('remarks', '')
            
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                continue
                
            ta, created = TransportAttendance.objects.update_or_create(
                vehicle=vehicle,
                student=student,
                date=date_val,
                journey=journey,
                defaults={
                    'status': status_val,
                    'remarks': remarks,
                    'marked_by': user
                }
            )
            updated_count += 1
            
            # Sync to Daily Attendance if journey is MORNING
            if journey == 'MORNING':
                try:
                    grade = None
                    section = None
                    
                    enrollment = student.enrollments.filter(status='ACTIVE').first()
                    if enrollment:
                        grade = str(enrollment.grade)
                        section = str(enrollment.section)
                    elif student.current_section:
                        section = str(student.current_section.name)
                        if hasattr(student.current_section, 'grade') and student.current_section.grade:
                            grade = str(student.current_section.grade.name)
                        elif getattr(student, 'grade_config', None):
                            grade = str(student.grade_config)
                    elif getattr(student, 'grade_config', None):
                        grade = str(student.grade_config)
                        section = 'A'
                        
                    grade = grade or 'ALL'
                    section = section or 'A'
                    school = student.school or vehicle.school
                    
                    if school:
                        session, s_created = AttendanceSession.objects.get_or_create(
                            school=school,
                            grade=grade,
                            section=section,
                            date=date_val,
                            session_type='DAILY',
                            defaults={'created_by': user}
                        )
                        
                        sa, sa_created = StudentAttendance.objects.get_or_create(
                            session=session,
                            student=student,
                            defaults={
                                'status': status_val,
                                'student_suid': student.suid,
                                'remarks': f"Bus Morning Attendance: {remarks}".strip() if remarks else "Marked via Bus Attendance",
                                'marked_by': user
                            }
                        )
                        if not sa_created:
                            sa.status = status_val
                            sa.remarks = f"Bus Morning Attendance: {remarks}".strip() if remarks else "Marked via Bus Attendance"
                            sa.edited_by = user
                            sa.save()
                except Exception as e:
                    print(f"[TRANSPORT] Error syncing student {student.suid} to daily attendance: {e}")
                    
        return Response({
            'status': 'success',
            'message': f'Attendance marked for {updated_count} students.',
            'updated_count': updated_count
        })

class TransportAssignmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = TransportAssignment.objects.all()
    serializer_class = TransportAssignmentSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'transport'
    rbac_resource = 'assignment'
    school_field = 'student__school'
    def get_permissions(self):
        if self.action == 'student_transport':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['student_transport']:
            return
        super().check_permissions(request)

    @action(detail=False, methods=['get'])
    def student_transport(self, request):
        user = request.user
        from apps.students.models import Student
        from apps.transport.models import TransportAssignment
        from django.db.models import Q

        student = Student.objects.filter(user=user).first()
        if not student and hasattr(user, 'email') and user.email:
            student = Student.objects.filter(user__email__iexact=user.email).first()
        if not student and hasattr(user, 'username') and user.username:
            student = Student.objects.filter(suid__iexact=user.username).first()
        if not student and hasattr(user, 'suid') and user.suid:
            student = Student.objects.filter(suid__iexact=user.suid).first()

        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        query = Q(student=student)
        if student.suid:
            query |= Q(student__suid__iexact=student.suid)
        if student.user:
            query |= Q(student__user=student.user)

        assignment = TransportAssignment.objects.filter(query).select_related(
            'vehicle', 'route', 'stop', 'vehicle__route'
        ).first()

        if not assignment and hasattr(student.user, 'email') and student.user.email:
            assignment = TransportAssignment.objects.filter(
                student__user__email__iexact=student.user.email
            ).select_related('vehicle', 'route', 'stop', 'vehicle__route').first()

        vehicle = assignment.vehicle if assignment else None
        route = assignment.route if assignment else None
        stop = assignment.stop if assignment else None

        if not vehicle and route:
            vehicle = route.vehicles.first()
        if not route and vehicle:
            route = vehicle.route

        if not assignment and not vehicle and not route and not stop:
            return Response({
                'is_assigned': False,
                'message': 'No transport allocation found for your account.'
            }, status=status.HTTP_200_OK)

        student_name = ""
        if student.user:
            student_name = student.user.get_full_name().strip()
        if not student_name:
            student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        if not student_name:
            student_name = getattr(student, 'full_name_display', '') or student.suid or 'Student'

        sch = student.school
        school_data = {
            'school_name': sch.name if sch else 'School Campus',
            'school_address': getattr(sch, 'address', '') or getattr(sch, 'city', '') or 'School Campus',
            'school_latitude': float(sch.latitude) if (sch and getattr(sch, 'latitude', None)) else None,
            'school_longitude': float(sch.longitude) if (sch and getattr(sch, 'longitude', None)) else None,
        }

        has_reached_school = False
        has_left_school = False
        
        c_status = getattr(vehicle, 'current_status', None)
        if c_status == 'REACHED_SCHOOL':
            has_reached_school = True
        elif c_status == 'LEFT_SCHOOL':
            has_left_school = True
        elif vehicle and vehicle.current_latitude and vehicle.current_longitude and school_data['school_latitude'] and school_data['school_longitude']:
            lat_diff = abs(float(vehicle.current_latitude) - school_data['school_latitude'])
            lng_diff = abs(float(vehicle.current_longitude) - school_data['school_longitude'])
            if lat_diff < 0.0005 and lng_diff < 0.0005:
                has_reached_school = True

        stops_data = []
        if route:
            for s in route.stops.all().order_by('order'):
                lat = float(s.latitude) if s.latitude else None
                lng = float(s.longitude) if s.longitude else None
                stops_data.append({
                    'id': str(s.id),
                    'name': s.name,
                    'order': s.order,
                    'pickup_time': str(s.pickup_time) if s.pickup_time else '-',
                    'drop_time': str(s.drop_time) if s.drop_time else '-',
                    'latitude': lat,
                    'longitude': lng
                })

        bus_stops_data = []
        if vehicle:
            assignments_qs = TransportAssignment.objects.filter(vehicle=vehicle).select_related('student', 'stop').order_by('order', 'stop__order')
            for idx, assign_item in enumerate(assignments_qs):
                st_obj = assign_item.student
                stop_obj = assign_item.stop
                
                lat = float(stop_obj.latitude) if (stop_obj and stop_obj.latitude) else (float(st_obj.latitude) if getattr(st_obj, 'latitude', None) else None)
                lng = float(stop_obj.longitude) if (stop_obj and stop_obj.longitude) else (float(st_obj.longitude) if getattr(st_obj, 'longitude', None) else None)
                
                st_name = ""
                if st_obj.user:
                    st_name = st_obj.user.get_full_name().strip()
                if not st_name:
                    st_name = f"{getattr(st_obj, 'first_name', '')} {getattr(st_obj, 'last_name', '')}".strip()
                if not st_name:
                    st_name = getattr(st_obj, 'full_name_display', '') or st_obj.suid or 'Student'

                bus_stops_data.append({
                    'id': str(assign_item.id),
                    'sequence_number': idx + 1,
                    'student_name': st_name,
                    'suid': st_obj.suid,
                    'stop_name': stop_obj.name if stop_obj else f"Stop {idx + 1}",
                    'pickup_time': str(stop_obj.pickup_time) if (stop_obj and stop_obj.pickup_time) else '-',
                    'drop_time': str(stop_obj.drop_time) if (stop_obj and stop_obj.drop_time) else '-',
                    'latitude': lat,
                    'longitude': lng
                })

        # Match arrived student stop sequence number if bus is currently at a student stop
        arrived_stop_sequence = None
        arrived_student_name = None
        if vehicle and vehicle.current_latitude and vehicle.current_longitude and c_status != 'LEFT_SCHOOL' and c_status != 'REACHED_SCHOOL':
            v_lat = float(vehicle.current_latitude)
            v_lng = float(vehicle.current_longitude)
            for bs in bus_stops_data:
                if bs.get('latitude') and bs.get('longitude'):
                    if abs(bs['latitude'] - v_lat) < 0.0005 and abs(bs['longitude'] - v_lng) < 0.0005:
                        arrived_stop_sequence = bs['sequence_number']
                        arrived_student_name = bs['student_name']
                        break

        bus_data = None
        if vehicle:
            bus_data = {
                'id': str(vehicle.id),
                'registration_number': vehicle.registration_number,
                'school_bus_number': vehicle.school_bus_number or vehicle.registration_number,
                'vehicle_type': vehicle.vehicle_type,
                'capacity': vehicle.capacity,
                'driver_name': vehicle.driver_name or 'Assigned Driver',
                'driver_phone': vehicle.driver_phone or 'Contact School Admin',
                'current_latitude': float(vehicle.current_latitude) if vehicle.current_latitude else None,
                'current_longitude': float(vehicle.current_longitude) if vehicle.current_longitude else None,
                'last_ping': str(vehicle.last_ping) if vehicle.last_ping else None,
                'current_status': c_status,
                'has_reached_school': has_reached_school,
                'has_left_school': has_left_school,
                'arrived_stop_sequence': arrived_stop_sequence,
                'arrived_student_name': arrived_student_name,
            }

        elif route:
            bus_data = {
                'id': 'N/A',
                'registration_number': 'N/A',
                'school_bus_number': 'Assigned Bus',
                'vehicle_type': 'Bus',
                'capacity': 0,
                'driver_name': 'Assigned Driver',
                'driver_phone': 'Contact School Admin',
                'current_latitude': None,
                'current_longitude': None,
                'last_ping': None,
                'has_reached_school': False,
                'arrived_stop_sequence': None,
                'arrived_student_name': None,
            }


        # Calculate polyline route positions
        route_positions = []
        if route and route.waypoints and isinstance(route.waypoints, list) and len(route.waypoints) > 0:
            for pt in route.waypoints:
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    try:
                        route_positions.append([float(pt[0]), float(pt[1])])
                    except (ValueError, TypeError):
                        pass

        if not route_positions:
            pos_list = []
            for bs in bus_stops_data:
                if bs.get('latitude') and bs.get('longitude'):
                    pos_list.append([bs['latitude'], bs['longitude']])

            for s in stops_data:
                if s.get('latitude') and s.get('longitude'):
                    if [s['latitude'], s['longitude']] not in pos_list:
                        pos_list.append([s['latitude'], s['longitude']])

            if school_data['school_latitude'] and school_data['school_longitude']:
                pos_list.append([school_data['school_latitude'], school_data['school_longitude']])

            route_positions = pos_list


        # Fetch recent bus attendance records for this student
        from .models import TransportAttendance
        recent_att_qs = TransportAttendance.objects.filter(student=student).select_related('vehicle').order_by('-date', '-journey', '-marked_at')[:30]
        recent_attendance_data = [{
            'id': str(att.id),
            'date': str(att.date),
            'journey': att.journey,
            'status': att.status,
            'remarks': att.remarks or '',
            'bus_number': (att.vehicle.school_bus_number or att.vehicle.registration_number) if att.vehicle else 'School Bus',
            'marked_at': att.marked_at.isoformat() if att.marked_at else None,
        } for att in recent_att_qs]

        return Response({
            'is_assigned': True,
            'student_name': student_name,
            'suid': student.suid,
            'school': school_data,
            'bus': bus_data,
            'route': {
                'name': route.name if route else 'Assigned Route',
                'origin': route.origin if route else 'School Campus',
                'destination': route.destination if route else 'Destination Stop'
            } if route else None,
            'stop': {
                'name': stop.name,
                'pickup_time': str(stop.pickup_time) if stop.pickup_time else '-',
                'drop_time': str(stop.drop_time) if stop.drop_time else '-'
            } if stop else None,
            'all_stops': stops_data,
            'bus_stops': bus_stops_data,
            'route_positions': route_positions,
            'recent_attendance': recent_attendance_data
        }, status=status.HTTP_200_OK)




