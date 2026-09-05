from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from apps.schools.models import School
from apps.schools.models_settings import SchoolSettings
from apps.accounts.rbac_models import Role, UserRole, Permission
from apps.teachers.models import Teacher
from apps.accounts.rbac_serializers import RoleDetailSerializer

User = get_user_model()

class RoleAssignmentNotificationTestCase(TestCase):
    def setUp(self):
        self.school = School.objects.create(legal_name='Test School', code='TEST-01')
        self.school_settings, _ = SchoolSettings.objects.get_or_create(school=self.school)
        
        # Create teacher user and profile
        self.teacher_user = User.objects.create_user(
            email='teacher@test.com',
            password='Teacher@123',
            user_type='TEACHER',
            school=self.school,
            first_name='John',
            last_name='Doe'
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user,
            tuid='T2026-000001',
            experience_years=5
        )

        # Create admin user
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            password='testpassword',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )

    def test_role_serializer_saves_plain_password(self):
        """Test that RoleDetailSerializer correctly saves plain_password on create and update."""
        # Create Role
        data = {
            'school': self.school.id,
            'name': 'Librarian',
            'description': 'Responsible for books',
            'username': 'librarian_user',
            'password': 'LibrarianSecretPass'
        }
        
        # We need request context for the serializer
        class MockRequest:
            user = self.admin_user
            
        serializer = RoleDetailSerializer(data=data, context={'request': MockRequest()})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        role = serializer.save()
        
        self.assertEqual(role.plain_password, 'LibrarianSecretPass')
        self.assertEqual(role.username, 'librarian_user')
        
        # Update Role with new password
        update_data = {
            'password': 'UpdatedSecretPass'
        }
        serializer = RoleDetailSerializer(instance=role, data=update_data, partial=True, context={'request': MockRequest()})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_role = serializer.save()
        self.assertEqual(updated_role.plain_password, 'UpdatedSecretPass')

    @patch('smtplib.SMTP_SSL')
    def test_teacher_role_assignment_sends_smtp_email(self, mock_smtp_ssl):
        """Test role assignment to teacher sends email using custom SMTP settings when configured."""
        self.school_settings.email_notifications = True
        self.school_settings.gatepass_sender_email = 'school_sender@test.com'
        self.school_settings.gatepass_app_password = 'school_password'
        self.school_settings.save()

        # Create role
        role = Role.objects.create(
            school=self.school,
            name='Accountant',
            description='Manages fee collection',
            username='accountant_role',
            plain_password='AccountantPassword'
        )

        # Mock SMTP connection and send_message
        mock_server = MagicMock()
        mock_smtp_ssl.return_value = mock_server

        # Assign role to teacher
        user_role = UserRole.objects.create(
            user=self.teacher_user,
            role=role,
            school=self.school,
            assigned_by=self.admin_user
        )

        # Assert SMTP was called
        mock_smtp_ssl.assert_called_once_with('smtp.gmail.com', 465)
        mock_server.login.assert_called_once_with('school_sender@test.com', 'school_password')
        mock_server.send_message.assert_called_once()
        
        # Retrieve the message sent
        sent_message = mock_server.send_message.call_args[0][0]
        self.assertEqual(sent_message['From'], 'school_sender@test.com')
        self.assertEqual(sent_message['To'], 'teacher@test.com')
        self.assertEqual(sent_message['Subject'], 'Official Notification: Role Assigned - Accountant')

    @patch('apps.accounts.signals.send_mail')
    def test_teacher_role_assignment_fallback_email(self, mock_send_mail):
        """Test role assignment falls back to default send_mail if custom SMTP settings are not set."""
        self.school_settings.email_notifications = True
        self.school_settings.gatepass_sender_email = ''
        self.school_settings.gatepass_app_password = ''
        self.school_settings.save()

        # Create role
        role = Role.objects.create(
            school=self.school,
            name='Sports Coach',
            description='Handles sports activities',
            username='sports_coach',
            plain_password='CoachPassword'
        )

        # Assign role
        user_role = UserRole.objects.create(
            user=self.teacher_user,
            role=role,
            school=self.school,
            assigned_by=self.admin_user
        )

        # Assert standard send_mail was called
        mock_send_mail.assert_called_once()
        kwargs = mock_send_mail.call_args[1]
        self.assertEqual(kwargs['subject'], 'Official Notification: Role Assigned - Sports Coach')
        self.assertIn('teacher@test.com', kwargs['recipient_list'])
        self.assertIn('Sports Coach', kwargs['message'])
        self.assertIn('sports_coach', kwargs['message'])
        self.assertIn('CoachPassword', kwargs['message'])

    @patch('apps.accounts.signals.send_mail')
    def test_teacher_role_assignment_no_email_when_disabled(self, mock_send_mail):
        """Test role assignment does not send email if email_notifications is disabled."""
        self.school_settings.email_notifications = False
        self.school_settings.save()

        role = Role.objects.create(
            school=self.school,
            name='Librarian',
            description='Responsible for books',
            username='librarian_user',
            plain_password='LibrarianSecretPass'
        )

        user_role = UserRole.objects.create(
            user=self.teacher_user,
            role=role,
            school=self.school,
            assigned_by=self.admin_user
        )

        mock_send_mail.assert_not_called()


class ListPermissionCheckTestCase(TestCase):
    def setUp(self):
        from django.core.management import call_command
        call_command('sync_permissions')
        self.school = School.objects.create(legal_name='Test School', code='TEST-1')
        
        self.user = User.objects.create_user(
            email='test_list_perm@test.com',
            password='testpassword',
            user_type='TEACHER',
            school=self.school
        )
        
        from apps.accounts.rbac_models import Role, UserRole, Permission
        self.role = Role.objects.create(
            school=self.school,
            name='Test Role',
            role_type='TEACHER'
        )
        
        # Add a specific permission
        self.perm = Permission.objects.get(codename='gatepass.edit_student_gatepass')
        self.role.permissions.add(self.perm)
        
        UserRole.objects.create(
            user=self.user,
            role=self.role,
            school=self.school,
            is_active=True
        )

    def test_check_object_permission_list_matching(self):
        from apps.accounts.permission_utils import check_object_permission
        # Create a mock object
        class MockObj:
            pass
        obj = MockObj()
        
        # Test single permission matches
        self.assertTrue(check_object_permission(self.user, 'gatepass.edit_student_gatepass', obj))
        
        # Test list of permissions where one matches
        self.assertTrue(check_object_permission(self.user, ['gatepass.edit_student_gatepass', 'students.issue_pass'], obj))
        
        # Test list of permissions where none match
        self.assertFalse(check_object_permission(self.user, ['gatepass.view_student_gatepass', 'students.view_profile'], obj))


class HierarchyOverwriteTestCase(TestCase):
    def setUp(self):
        self.school = School.objects.create(legal_name='Hierarchy Test School', code='HTS-01')
        
        # User A with Role Level 50
        self.user_a = User.objects.create_user(
            email='usera@test.com', password='password123', user_type='TEACHER', school=self.school
        )
        self.role_a = Role.objects.create(
            school=self.school, name='High Staff Role', hierarchy_level=50
        )
        UserRole.objects.create(user=self.user_a, role=self.role_a, school=self.school, is_active=True)
        
        # User B with Role Level 49
        self.user_b = User.objects.create_user(
            email='userb@test.com', password='password123', user_type='TEACHER', school=self.school
        )
        self.role_b = Role.objects.create(
            school=self.school, name='Lower Staff Role', hierarchy_level=49
        )
        UserRole.objects.create(user=self.user_b, role=self.role_b, school=self.school, is_active=True)


    def test_lower_hierarchy_user_blocked_from_editing_higher_user_record(self):
        from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy, log_hierarchy_record_edit
        from apps.audit.models import RecordHierarchyLog
        
        # Real model record (e.g. custom Role created by User A Level 50)
        target_role = Role.objects.create(
            school=self.school,
            name='Target Role Created By User A',
            hierarchy_level=10,
            created_by=self.user_a
        )
        
        # Log hierarchy record edit by Level 50 user
        log_hierarchy_record_edit(self.user_a, target_role, 'CREATE', changes_summary='Created High Staff Role', school=self.school)
        
        # Verify RecordHierarchyLog recorded all 3 required pieces of information:
        log_entry = RecordHierarchyLog.objects.filter(object_id=str(target_role.id)).first()
        self.assertIsNotNone(log_entry)
        self.assertEqual(log_entry.role_name, 'High Staff Role')
        self.assertEqual(log_entry.hierarchy_level, 50)
        self.assertTrue('Target Role Created By User A' in log_entry.edited_changes or 'Created High Staff Role' in log_entry.edited_changes)
        
        # User A (Level 50) tries to edit record created by User A (own record) -> Allowed
        allowed, _ = can_user_edit_object_by_hierarchy(self.user_a, target_role, self.school)
        self.assertTrue(allowed)
        
        # User B (Level 49) tries to edit/delete record created by User A (Level 50) -> Blocked!
        allowed, reason = can_user_edit_object_by_hierarchy(self.user_b, target_role, self.school)
        self.assertFalse(allowed)
        self.assertIn("High Staff Role", reason)
        self.assertIn("Level 50", reason)

    def test_calendar_event_hierarchy_deletion_protection(self):
        import datetime
        from apps.schools.models_calendar import SchoolEvent
        from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy, log_hierarchy_record_edit
        
        # Level 50 user creates a SchoolEvent
        event = SchoolEvent.objects.create(
            school=self.school,
            title='Annual Sports Meet',
            event_date=datetime.date.today(),
            description='Sports Day Event'
        )
        log_hierarchy_record_edit(self.user_a, event, 'CREATE', changes_summary='Created School Event Annual Sports Meet', school=self.school)
        
        # User B (Level 49) attempts to delete the event -> Blocked!
        allowed, reason = can_user_edit_object_by_hierarchy(self.user_b, event, self.school)
        self.assertFalse(allowed)
        self.assertIn("High Staff Role", reason)
        self.assertIn("Level 50", reason)

    def test_subject_hierarchy_edit_and_deletion_protection(self):
        from apps.academics.models import Subject
        from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy, log_hierarchy_record_edit
        
        # Level 50 user creates a Subject
        subject = Subject.objects.create(
            school=self.school,
            name='Advanced Mathematics',
            code='MATH-50'
        )
        log_hierarchy_record_edit(self.user_a, subject, 'CREATE', changes_summary='Created Subject Advanced Mathematics', school=self.school)
        
        # User B (Level 49) attempts to edit or delete the Subject -> Blocked!
        allowed, reason = can_user_edit_object_by_hierarchy(self.user_b, subject, self.school)
        self.assertFalse(allowed)
        self.assertIn("High Staff Role", reason)
        self.assertIn("Level 50", reason)

    def test_subject_allocation_hierarchy_protection(self):
        from apps.academics.models import Subject, SubjectMapping, Section
        from apps.schools.models_programs import AcademicProgram, GradeConfiguration
        from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy, log_hierarchy_record_edit
        
        program = AcademicProgram.objects.create(school=self.school, name='Secondary Wing', code='SEC', board='CBSE')
        grade = GradeConfiguration.objects.create(program=program, grade_name='10', grade_order=10)
        section = Section.objects.create(school=self.school, grade_config=grade, section_letter='A')
        subject = Subject.objects.create(school=self.school, name='Physics', code='PHY-10')

        
        # Level 50 user allocates Subject to Grade/Section
        mapping = SubjectMapping.objects.create(
            school=self.school,
            section=section,
            subject=subject,
            is_active=True
        )
        log_hierarchy_record_edit(self.user_a, mapping, 'CREATE', changes_summary='Allocated Subject Physics to Grade 10-A', school=self.school)
        
        # Level 49 user attempts to edit or deallocate SubjectMapping -> Blocked!
        allowed, reason = can_user_edit_object_by_hierarchy(self.user_b, mapping, self.school)
        self.assertFalse(allowed)
        self.assertIn("High Staff Role", reason)
        self.assertIn("Level 50", reason)


class RoleCreatorDeletionTestCase(TestCase):
    def setUp(self):
        from apps.schools.models import School
        from apps.accounts.rbac_models import Role, UserRole, Permission
        from rest_framework.test import APIClient
        
        self.school = School.objects.create(legal_name='Test School', code='TESTSCH')
        self.user_creator = User.objects.create_user(
            email='creator@test.com',
            password='password123',
            first_name='Creator',
            last_name='User',
            user_type='TEACHER',
            school=self.school
        )
        self.user_other = User.objects.create_user(
            email='other@test.com',
            password='password123',
            first_name='Other',
            last_name='User',
            user_type='TEACHER',
            school=self.school
        )
        
        # Grant both users role management permissions (allow_role_creation)
        perm_allow_create, _ = Permission.objects.get_or_create(
            codename='roles.allow_role_creation',
            defaults={'name': 'Allow Role Creation', 'module': 'roles', 'action': 'create', 'resource': 'general'}
        )
        
        role_creator_staff = Role.objects.create(school=self.school, name='Delegated Creator Role', hierarchy_level=50)
        role_creator_staff.permissions.add(perm_allow_create)
        UserRole.objects.create(user=self.user_creator, role=role_creator_staff, school=self.school, is_active=True)
        
        role_other_staff = Role.objects.create(school=self.school, name='Delegated Other Role', hierarchy_level=50)
        role_other_staff.permissions.add(perm_allow_create)
        UserRole.objects.create(user=self.user_other, role=role_other_staff, school=self.school, is_active=True)
        
        from apps.accounts.permission_utils import clear_permission_cache
        clear_permission_cache(self.user_creator, self.school)
        clear_permission_cache(self.user_other, self.school)
        
        # Role 1 created by user_creator
        self.role_by_creator = Role.objects.create(
            school=self.school,
            name='Role Created By Creator',
            hierarchy_level=10,
            created_by=self.user_creator
        )
        
        # Role 2 created by user_other
        self.role_by_other = Role.objects.create(
            school=self.school,
            name='Role Created By Other',
            hierarchy_level=10,
            created_by=self.user_other
        )
        
        self.client_creator = APIClient()
        self.client_creator.force_authenticate(user=self.user_creator)

    def test_delegated_creator_can_delete_own_role(self):
        response = self.client_creator.delete(f'/api/v1/auth/rbac/roles/{self.role_by_creator.id}/')
        self.assertEqual(response.status_code, 204)
        from apps.accounts.rbac_models import Role
        self.assertFalse(Role.objects.filter(id=self.role_by_creator.id).exists())

    def test_delegated_creator_cannot_delete_role_created_by_other(self):
        response = self.client_creator.delete(f'/api/v1/auth/rbac/roles/{self.role_by_other.id}/')
        self.assertIn(response.status_code, [403, 404])

    def test_delegated_creator_sees_only_own_roles_in_list(self):
        response = self.client_creator.get('/api/v1/auth/rbac/roles/')
        self.assertEqual(response.status_code, 200)
        data = response.data.get('results') if isinstance(response.data, dict) else response.data
        role_ids = [r['id'] for r in data]
        self.assertIn(str(self.role_by_creator.id), role_ids)
        self.assertNotIn(str(self.role_by_other.id), role_ids)

    def test_school_admin_sees_all_school_roles_in_list(self):
        admin_user = User.objects.create_user(
            email='admin@test.com',
            password='password123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )
        client_admin = APIClient()
        client_admin.force_authenticate(user=admin_user)
        response = client_admin.get('/api/v1/auth/rbac/roles/')
        self.assertEqual(response.status_code, 200)
        data = response.data.get('results') if isinstance(response.data, dict) else response.data
        role_ids = [r['id'] for r in data]
        self.assertIn(str(self.role_by_creator.id), role_ids)
        self.assertIn(str(self.role_by_other.id), role_ids)


class RoleLoginAssignmentRestrictionTestCase(TestCase):
    def setUp(self):
        from apps.schools.models import School
        from apps.accounts.rbac_models import Role, UserRole
        from rest_framework.test import APIClient
        
        self.school = School.objects.create(legal_name='Login Test School', code='LTS-01')
        self.staff_user = User.objects.create_user(
            email='staff@test.com',
            password='password123',
            user_type='TEACHER',
            school=self.school
        )
        
        # Create role with credentials
        from apps.accounts.rbac_serializers import RoleDetailSerializer
        serializer = RoleDetailSerializer(data={
            'name': 'Coordinator Role',
            'username': 'coordinator',
            'password': 'Password123!',
            'hierarchy_level': 10
        }, context={'request': type('Req', (), {'user': self.staff_user})()})
        serializer.is_valid(raise_exception=True)
        self.role = serializer.save(school=self.school)
        self.client = APIClient()

    def test_role_login_blocked_when_unassigned_and_allowed_when_assigned(self):
        # 1. Attempt login when role is unassigned to staff -> Blocked
        response = self.client.post('/api/v1/auth/rbac/role-login/', {
            'school_name': 'Login Test School',
            'username': 'coordinator',
            'password': 'Password123!'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('not currently assigned', response.data['error'])

        # 2. Assign role to staff member
        from apps.accounts.rbac_models import UserRole
        assignment = UserRole.objects.create(
            user=self.staff_user,
            role=self.role,
            school=self.school,
            is_active=True
        )

        # 3. Attempt login when role is assigned -> Success
        response_success = self.client.post('/api/v1/auth/rbac/role-login/', {
            'school_name': 'Login Test School',
            'username': 'coordinator',
            'password': 'Password123!'
        })
        self.assertEqual(response_success.status_code, 200)
        self.assertIn('access', response_success.data)

        # 4. Revoke assignment -> Blocked again
        assignment.is_active = False
        assignment.save()

        response_revoked = self.client.post('/api/v1/auth/rbac/role-login/', {
            'school_name': 'Login Test School',
            'username': 'coordinator',
            'password': 'Password123!'
        })
        self.assertEqual(response_revoked.status_code, 400)
        self.assertIn('not currently assigned', response_revoked.data['error'])


class StaffWithRolesStrictTeacherFilteringTestCase(TestCase):
    def setUp(self):
        from apps.schools.models import School
        from apps.teachers.models import Teacher
        from rest_framework.test import APIClient
        
        self.school = School.objects.create(legal_name='Staff Filter School', code='SFS-01')
        
        # 1. School Admin user (NOT in Teachers module)
        self.admin_user = User.objects.create_user(
            email='schooladmin@test.com',
            password='password123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )
        
        # 2. Staff member (in Teachers module)
        self.teacher_user = User.objects.create_user(
            email='actualteacher@test.com',
            password='password123',
            user_type='TEACHER',
            school=self.school
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user,
            tuid='T-2026-999999',
            teacher_type='TEACHING'
        )
        
        # 3. Raw user (NOT in Teachers module)
        self.raw_user = User.objects.create_user(
            email='rawuser@test.com',
            password='password123',
            user_type='TEACHER',
            school=self.school
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_staff_with_roles_returns_only_teachers_module_members(self):
        response = self.client.get('/api/v1/auth/rbac/staff-with-roles/')
        self.assertEqual(response.status_code, 200)
        data = response.data.get('results') if isinstance(response.data, dict) else response.data
        user_ids = [u['id'] for u in data]
        
        # Only actualteacher should be returned
        self.assertIn(str(self.teacher_user.id), user_ids)
        self.assertNotIn(str(self.admin_user.id), user_ids)
        self.assertNotIn(str(self.raw_user.id), user_ids)


class SinglePersonRoleAssignmentAndRevocationLogoutTestCase(TestCase):
    def setUp(self):
        from apps.schools.models import School
        from apps.accounts.rbac_models import Role, UserRole
        from apps.accounts.rbac_serializers import RoleDetailSerializer
        from rest_framework.test import APIClient
        
        self.school = School.objects.create(legal_name='Revocation Test School', code='RTS-01')
        self.admin = User.objects.create_user(
            email='admin_revocation@test.com',
            password='password123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )
        self.staff_a = User.objects.create_user(
            email='staff_a@test.com',
            password='password123',
            user_type='TEACHER',
            school=self.school
        )
        self.staff_b = User.objects.create_user(
            email='staff_b@test.com',
            password='password123',
            user_type='TEACHER',
            school=self.school
        )
        
        # Create role with credentials
        serializer = RoleDetailSerializer(data={
            'name': 'Single Person Role',
            'username': 'singleperson',
            'password': 'Password123!',
            'hierarchy_level': 10
        }, context={'request': type('Req', (), {'user': self.admin})()})
        serializer.is_valid(raise_exception=True)
        self.role = serializer.save(school=self.school)
        
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

    def test_cannot_assign_role_to_second_user_simultaneously(self):
        # Clean up any automatic role user assignment from creation
        UserRole.objects.filter(role=self.role).delete()

        # 1. Assign role to staff A -> Success
        res1 = self.client_admin.post('/api/v1/auth/rbac/user-roles/', {
            'user': str(self.staff_a.id),
            'role': str(self.role.id)
        }, format='json')
        self.assertEqual(res1.status_code, 201)

        # 2. Attempt to assign same role to staff B -> Blocked with 400
        res2 = self.client_admin.post('/api/v1/auth/rbac/user-roles/', {
            'user': str(self.staff_b.id),
            'role': str(self.role.id)
        }, format='json')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('already assigned', res2.data['error'])

    def test_revoking_role_causes_active_role_token_request_to_return_401(self):
        from apps.accounts.rbac_models import UserRole
        assignment = UserRole.objects.create(
            user=self.staff_a,
            role=self.role,
            school=self.school,
            is_active=True
        )

        # Login to role credentials
        client_role = APIClient()
        login_res = client_role.post('/api/v1/auth/rbac/role-login/', {
            'school_name': 'Revocation Test School',
            'username': 'singleperson',
            'password': 'Password123!'
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.data['access']
        client_role.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Request while active -> Success
        res_active = client_role.get('/api/v1/auth/rbac/my-permissions/')
        self.assertEqual(res_active.status_code, 200)

        # Admin revokes/deletes assignment
        assignment.delete()

        # Request with same token after revocation -> Blocked with 401 Unauthorized
        res_revoked = client_role.get('/api/v1/auth/rbac/my-permissions/')
        self.assertEqual(res_revoked.status_code, 401)


class AssignmentSettingsDepartmentPermissionTestCase(TestCase):
    def setUp(self):
        call_command('sync_permissions')
        self.school = School.objects.create(legal_name='Dept Permission Test School', code='DPTSCH')
        
        # Delegated manager user
        self.manager_user = User.objects.create_user(
            email='deptmanager@test.com',
            password='Password123!',
            user_type='TEACHER',
            school=self.school
        )
        self.manager_role = Role.objects.create(
            name='Dept Manager Role',
            school=self.school,
            created_by=self.manager_user
        )
        perm_view_roles = Permission.objects.get(codename='roles.view_roles')
        perm_assign_non_teaching = Permission.objects.get(codename='teachers.assign_role_non_teaching')
        perm_dept_accounts = Permission.objects.get(codename='assignment_settings.dept_accounts_finance')
        self.manager_role.permissions.set([perm_view_roles, perm_assign_non_teaching, perm_dept_accounts])
        
        UserRole.objects.create(
            user=self.manager_user,
            role=self.manager_role,
            school=self.school,
            is_active=True
        )

        # Accounts staff member
        from apps.teachers.models import Teacher, TeacherAssignment
        self.accounts_user = User.objects.create_user(
            email='accounts_staff@test.com',
            password='Password123!',
            user_type='TEACHER',
            school=self.school
        )
        self.accounts_teacher = Teacher.objects.create(
            user=self.accounts_user,
            tuid='TUID-ACCT-01',
            teacher_type='NON_TEACHING'
        )
        TeacherAssignment.objects.create(
            teacher=self.accounts_teacher,
            school=self.school,
            role='ACCOUNTANT',
            department='Accounts & Finance',
            academic_year='2025-2026',
            is_active=True
        )

        # Library staff member
        self.library_user = User.objects.create_user(
            email='library_staff@test.com',
            password='Password123!',
            user_type='TEACHER',
            school=self.school
        )
        self.library_teacher = Teacher.objects.create(
            user=self.library_user,
            tuid='TUID-LIB-01',
            teacher_type='NON_TEACHING'
        )
        TeacherAssignment.objects.create(
            teacher=self.library_teacher,
            school=self.school,
            role='LIBRARIAN',
            department='Library',
            academic_year='2025-2026',
            is_active=True
        )

    def test_staff_list_returns_only_allowed_department_staff(self):
        client = APIClient()
        client.force_authenticate(user=self.manager_user)

        res = client.get('/api/v1/auth/rbac/staff-with-roles/')
        self.assertEqual(res.status_code, 200)
        data = res.data.get('results') if isinstance(res.data, dict) else res.data
        returned_ids = [u['id'] for u in data]
        self.assertIn(str(self.accounts_user.id), returned_ids)
        self.assertNotIn(str(self.library_user.id), returned_ids)

    def test_manager_cannot_assign_role_to_unauthorized_department_staff(self):
        client = APIClient()
        client.force_authenticate(user=self.manager_user)

        target_role = Role.objects.create(
            name='Target Role',
            school=self.school,
            created_by=self.manager_user
        )

        # Assign to accounts staff (Allowed)
        res_acct = client.post('/api/v1/auth/rbac/user-roles/', {
            'user': str(self.accounts_user.id),
            'role': str(target_role.id)
        })
        self.assertEqual(res_acct.status_code, 201)

        # Assign to library staff (Blocked)
        res_lib = client.post('/api/v1/auth/rbac/user-roles/', {
            'user': str(self.library_user.id),
            'role': str(target_role.id)
        })
        self.assertEqual(res_lib.status_code, 403)
        self.assertIn('Library', res_lib.data['error'])











