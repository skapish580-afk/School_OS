from django.test import TestCase
from apps.accounts.models import User
from apps.accounts.rbac_models import Role, UserRole, Permission
from apps.schools.models import School
from apps.transport.models import Vehicle
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.management import call_command

class TransportPermissionsTestCase(APITestCase):
    def setUp(self):
        # Sync standard permissions first
        call_command('sync_permissions')

        # Create Schools
        self.school_a = School.objects.create(legal_name="NHPS School A", code="NHPSA")
        self.school_b = School.objects.create(legal_name="NHPS School B", code="NHPSB")

        # Create Teacher User in School A
        self.teacher_user = User.objects.create_user(
            email="transport_teacher@nhps.com",
            password="password123",
            user_type="TEACHER",
            school=self.school_a
        )

        # Create Vehicles (Buses)
        self.bus_a1 = Vehicle.objects.create(
            school=self.school_a,
            registration_number="MH-02-AB-1234",
            school_bus_number="Bus A1",
            vehicle_type="Bus",
            capacity=40
        )
        self.bus_a2 = Vehicle.objects.create(
            school=self.school_a,
            registration_number="MH-02-CD-5678",
            school_bus_number="Bus A2",
            vehicle_type="Bus",
            capacity=30
        )
        self.bus_b1 = Vehicle.objects.create(
            school=self.school_b,
            registration_number="MH-03-XY-9999",
            school_bus_number="Bus B1",
            vehicle_type="Bus",
            capacity=50
        )

        # Create Teacher Role in School A
        self.role = Role.objects.create(
            school=self.school_a,
            name="Transport Manager",
            role_type="TEACHER"
        )
        UserRole.objects.create(
            user=self.teacher_user,
            role=self.role,
            school=self.school_a,
            is_active=True
        )

    def test_dynamic_vehicle_permissions_creation(self):
        """Test that vehicle permissions are created/updated and deleted dynamically via signals."""
        codename_a1 = f"transport.mark_attendance_{self.bus_a1.id}"
        codename_a2 = f"transport.mark_attendance_{self.bus_a2.id}"
        codename_b1 = f"transport.mark_attendance_{self.bus_b1.id}"

        # Assert permission objects exist in DB
        self.assertTrue(Permission.objects.filter(codename=codename_a1).exists())
        self.assertTrue(Permission.objects.filter(codename=codename_a2).exists())
        self.assertTrue(Permission.objects.filter(codename=codename_b1).exists())

        # Test updates sync details
        self.bus_a1.school_bus_number = "Updated Bus A1"
        self.bus_a1.save()
        perm_a1 = Permission.objects.get(codename=codename_a1)
        self.assertIn("Updated Bus A1", perm_a1.name)

        # Test deletion removes permission
        self.bus_a2.delete()
        self.assertFalse(Permission.objects.filter(codename=codename_a2).exists())

    def test_grouped_permissions_list_school_isolation(self):
        """Test that permissions list only displays vehicles (buses) belonging to the user's school."""
        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.get('/api/v1/auth/rbac/permissions/grouped/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Extract all codenames returned in transport group
        transport_group = next((g for g in response.data if g['module'] == 'transport'), None)
        self.assertIsNotNone(transport_group)

        codenames = [p['codename'] for p in transport_group['permissions']]
        
        # Should include static and School A's buses
        self.assertIn('transport.view_transport', codenames)
        self.assertIn(f'transport.mark_attendance_{self.bus_a1.id}', codenames)
        self.assertIn(f'transport.mark_attendance_{self.bus_a2.id}', codenames)
        
        # Should NOT include School B's bus
        self.assertNotIn(f'transport.mark_attendance_{self.bus_b1.id}', codenames)

    def test_scoped_bus_attendance_marking_permission(self):
        """Test that users can only view or mark attendance for buses they are permitted/scoped to."""
        # 1. Give only Bus A1 permission to the teacher role
        from apps.accounts.permission_utils import clear_permission_cache
        view_perm = Permission.objects.get(codename="transport.view_transport")
        perm_a1 = Permission.objects.get(codename=f"transport.mark_attendance_{self.bus_a1.id}")
        self.role.permissions.add(view_perm, perm_a1)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)

        # Mark attendance payload
        payload = {
            'date': '2026-07-19',
            'journey': 'MORNING',
            'records': []
        }

        # Bus A1 should succeed (200 OK)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/mark_attendance/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Bus A2 should be Forbidden (403)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a2.id}/mark_attendance/', payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Give global mark_attendance permission
        global_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(global_perm)
        
        # Clear cache for teacher permission
        from apps.accounts.permission_utils import clear_permission_cache
        clear_permission_cache(self.teacher_user, self.school_a)

        # Now Bus A2 should succeed too (200 OK)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a2.id}/mark_attendance/', payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_route_waypoints_creation_and_serialization(self):
        """Test creating a route with waypoints and reading route_waypoints on Vehicle serializer."""
        from apps.transport.models import Route
        from apps.accounts.permission_utils import clear_permission_cache
        view_perm = Permission.objects.get(codename="transport.view_transport")
        self.role.permissions.add(view_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        route = Route.objects.create(
            school=self.school_a,
            name="Route - Bus A1",
            waypoints=[[19.076, 72.877], [19.080, 72.880]]
        )
        self.bus_a1.route = route
        self.bus_a1.save()

        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.get('/api/v1/transport/vehicles/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        vehicle_data = next(v for v in response.data if v['id'] == self.bus_a1.id)
        self.assertEqual(vehicle_data['route_waypoints'], [[19.076, 72.877], [19.080, 72.880]])

    def test_arrive_at_student_updates_vehicle_location_and_ping(self):
        """Test that arrive_at_student updates vehicle's current location and last_ping timestamp."""
        from apps.students.models import Student
        from apps.accounts.permission_utils import clear_permission_cache

        student_user = User.objects.create_user(
            email="test_student_geo@nhps.com",
            password="password123",
            user_type="STUDENT",
            school=self.school_a
        )
        student = Student.objects.create(
            user=student_user,
            school=self.school_a,
            suid="STU1001",
            latitude=19.123456,
            longitude=72.987654
        )
        
        # Grant mark_attendance permission
        mark_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(mark_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/arrive_at_student/', {
            'student_id': student.id
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.bus_a1.refresh_from_db()
        self.assertAlmostEqual(float(self.bus_a1.current_latitude), 19.123456)
        self.assertAlmostEqual(float(self.bus_a1.current_longitude), 72.987654)
        self.assertIsNotNone(self.bus_a1.last_ping)

    def test_reach_school_updates_vehicle_location_to_campus(self):
        """Test that reach_school updates vehicle's location to school campus coordinates."""
        from apps.accounts.permission_utils import clear_permission_cache

        self.school_a.latitude = 19.076000
        self.school_a.longitude = 72.877000
        self.school_a.save()

        mark_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(mark_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/reach_school/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.bus_a1.refresh_from_db()
        self.assertAlmostEqual(float(self.bus_a1.current_latitude), 19.076000)
        self.assertAlmostEqual(float(self.bus_a1.current_longitude), 72.877000)
        self.assertIsNotNone(self.bus_a1.last_ping)

    def test_leave_school_updates_vehicle_location_to_campus(self):
        """Test that leave_school updates vehicle's location to school campus coordinates."""
        from apps.accounts.permission_utils import clear_permission_cache

        self.school_a.latitude = 19.076000
        self.school_a.longitude = 72.877000
        self.school_a.save()

        mark_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(mark_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/leave_school/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.bus_a1.refresh_from_db()
        self.assertAlmostEqual(float(self.bus_a1.current_latitude), 19.076000)
        self.assertAlmostEqual(float(self.bus_a1.current_longitude), 72.877000)
        self.assertIsNotNone(self.bus_a1.last_ping)

    def test_transport_attendance_locked_when_attendance_session_locked(self):
        """Test constraint 1: Transport attendance cannot be saved if Attendance register is locked."""
        from apps.attendance.models import AttendanceSession
        from apps.accounts.permission_utils import clear_permission_cache
        import datetime

        today = datetime.date.today()
        AttendanceSession.objects.create(
            school=self.school_a,
            grade="10",
            section="A",
            date=today,
            is_locked=True
        )

        mark_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(mark_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/mark_attendance/', {
            'date': today.strftime('%Y-%m-%d'),
            'journey': 'MORNING',
            'records': []
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("locked in the Attendance module", response.data['error'])

    def test_transport_attendance_locked_after_reach_school(self):
        """Test constraint 2: Clicking Reached School saves attendance records and locks attendance for that bus on that day."""
        from apps.students.models import Student
        from apps.transport.models import TransportAttendance
        from apps.accounts.permission_utils import clear_permission_cache
        import datetime

        student_user = User.objects.create_user(
            email="student_reach@nhps.com",
            password="password123",
            user_type="STUDENT",
            school=self.school_a
        )
        student = Student.objects.create(
            user=student_user,
            school=self.school_a,
            suid="STUREACH01"
        )

        today = datetime.date.today()
        self.school_a.latitude = 19.076000
        self.school_a.longitude = 72.877000
        self.school_a.save()

        mark_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(mark_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)
        reach_res = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/reach_school/', {
            'date': today.strftime('%Y-%m-%d'),
            'journey': 'MORNING',
            'records': [
                {
                    'student_id': student.id,
                    'status': 'PRESENT',
                    'remarks': 'Reached School'
                }
            ]
        }, format='json')
        self.assertEqual(reach_res.status_code, status.HTTP_200_OK)

        # Verify attendance record was saved in TransportAttendance
        ta = TransportAttendance.objects.filter(vehicle=self.bus_a1, student=student, date=today).first()
        self.assertIsNotNone(ta)
        self.assertEqual(ta.status, 'PRESENT')

        # Attempt to mark attendance after reaching school
        mark_res = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/mark_attendance/', {
            'date': today.strftime('%Y-%m-%d'),
            'journey': 'MORNING',
            'records': []
        }, format='json')
        self.assertEqual(mark_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("has reached school for this date", mark_res.data['error'])

    def test_morning_transport_attendance_syncs_to_daily_attendance(self):
        """Test that MORNING transport attendance syncs and creates/updates StudentAttendance in Attendance module."""
        from apps.students.models import Student
        from apps.attendance.models import AttendanceSession, StudentAttendance
        from apps.accounts.permission_utils import clear_permission_cache
        import datetime

        student_user = User.objects.create_user(
            email="student_test@nhps.com",
            password="password123",
            user_type="STUDENT",
            school=self.school_a
        )
        student = Student.objects.create(
            user=student_user,
            school=self.school_a,
            suid="STU001"
        )

        today = datetime.date.today()
        mark_perm = Permission.objects.get(codename="transport.mark_attendance")
        self.role.permissions.add(mark_perm)
        clear_permission_cache(self.teacher_user, self.school_a)

        self.client.force_authenticate(user=self.teacher_user)
        res = self.client.post(f'/api/v1/transport/vehicles/{self.bus_a1.id}/mark_attendance/', {
            'date': today.strftime('%Y-%m-%d'),
            'journey': 'MORNING',
            'records': [
                {
                    'student_id': student.id,
                    'status': 'PRESENT',
                    'remarks': 'On Bus #1'
                }
            ]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Check that StudentAttendance was created in Attendance module
        sa = StudentAttendance.objects.filter(student=student, session__date=today).first()
        self.assertIsNotNone(sa)
        self.assertEqual(sa.status, 'PRESENT')
        self.assertIn("On Bus #1", sa.remarks)

