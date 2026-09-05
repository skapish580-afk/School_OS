from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.schools.models import School
from apps.schools.models_settings import SchoolSettings
from apps.students.models import Student
from apps.gatepass.models import GatePass
from unittest.mock import patch
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.gatepass.views import GatePassViewSet

User = get_user_model()


class GatePassNotificationTestCase(TestCase):
    """Test that GatePass views respect global email notification settings."""

    def setUp(self):
        self.school = School.objects.create(legal_name='Test School', code='TEST-01')
        self.school_settings, _ = SchoolSettings.objects.get_or_create(school=self.school)
        
        # Create student user and student profile
        self.student_user = User.objects.create_user(
            email='student@test.com',
            password='test123',
            first_name='Bobby',
            last_name='Smith'
        )
        self.student = Student.objects.create(
            user=self.student_user,
            school=self.school,
            suid='S12345'
        )

        # Create admin user for creating gatepasses
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            password='test123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )

    @patch('apps.gatepass.views.send_gatepass_email')
    def test_gatepass_creation_email_notifications_enabled(self, mock_send_email):
        """Test gate pass creation sends email when email notifications are enabled."""
        mock_send_email.return_value = True
        self.school_settings.email_notifications = True
        self.school_settings.gatepass_sender_email = 'sender@test.com'
        self.school_settings.gatepass_app_password = 'password123'
        self.school_settings.save()

        # Call ViewSet perform_create
        factory = APIRequestFactory()
        request = factory.post('/api/gatepass/', {
            'student': self.student.suid,
            'reason': 'Doctor appointment',
            'valid_until': timezone.now() + timedelta(hours=2)
        })
        force_authenticate(request, user=self.admin_user)

        view = GatePassViewSet.as_view({'post': 'create'})
        response = view(request)

        self.assertEqual(response.status_code, 201)
        mock_send_email.assert_called_once()

    @patch('apps.gatepass.views.send_gatepass_email')
    def test_gatepass_creation_email_notifications_disabled(self, mock_send_email):
        """Test gate pass creation does not send email when email notifications are disabled."""
        mock_send_email.return_value = True
        self.school_settings.email_notifications = False
        self.school_settings.gatepass_sender_email = 'sender@test.com'
        self.school_settings.gatepass_app_password = 'password123'
        self.school_settings.save()

        factory = APIRequestFactory()
        request = factory.post('/api/gatepass/', {
            'student': self.student.suid,
            'reason': 'Doctor appointment',
            'valid_until': timezone.now() + timedelta(hours=2)
        })
        force_authenticate(request, user=self.admin_user)

        view = GatePassViewSet.as_view({'post': 'create'})
        response = view(request)

        self.assertEqual(response.status_code, 201)
        mock_send_email.assert_not_called()

    @patch('django.conf.settings.DEBUG', True)
    def test_gatepass_qr_payload_in_debug(self):
        """Test that in debug/development mode the QR payload points to localhost:3000."""
        gatepass = GatePass.objects.create(
            student=self.student,
            reason='Early departure',
            valid_until=timezone.now() + timedelta(hours=1),
            status='ACTIVE'
        )
        payload = gatepass.generate_qr_payload()
        self.assertEqual(payload, f"http://localhost:3000/verify-pass/?pass_id={gatepass.id}")

    @patch('django.conf.settings.DEBUG', False)
    def test_gatepass_qr_payload_in_production(self):
        """Test that in production mode the QR payload uses the school's domain/subdomain."""
        # Test school website
        self.school.website = 'https://myschool.com'
        self.school.save()
        gatepass = GatePass.objects.create(
            student=self.student,
            reason='Early departure',
            valid_until=timezone.now() + timedelta(hours=1),
            status='ACTIVE'
        )
        self.assertEqual(gatepass.generate_qr_payload(), f"https://myschool.com/verify-pass/?pass_id={gatepass.id}")

        # Test fallback to subdomain
        self.school.website = None
        self.school.subdomain = 'mysubdomain'
        self.school.save()
        self.assertEqual(gatepass.generate_qr_payload(), f"https://mysubdomain.schoolos.in/verify-pass/?pass_id={gatepass.id}")

    @patch('apps.gatepass.views.send_gatepass_email')
    def test_gatepass_creation_custom_email_body(self, mock_send_email):
        """Test gate pass creation uses custom email body when configured."""
        mock_send_email.return_value = True
        self.school_settings.email_notifications = True
        self.school_settings.gatepass_sender_email = 'sender@test.com'
        self.school_settings.gatepass_app_password = 'password123'
        self.school_settings.gatepass_creation_email_body = "Hello! {student_name} is leaving school. Please approve."
        self.school_settings.save()

        factory = APIRequestFactory()
        request = factory.post('/api/gatepass/', {
            'student': self.student.suid,
            'reason': 'Doctor appointment',
            'valid_until': timezone.now() + timedelta(hours=2)
        })
        force_authenticate(request, user=self.admin_user)

        view = GatePassViewSet.as_view({'post': 'create'})
        response = view(request)

        self.assertEqual(response.status_code, 201)
        mock_send_email.assert_called_once()
        args = mock_send_email.call_args[0]
        body = args[4]
        self.assertIn("Hello! Bobby Smith is leaving school.", body)
        self.assertIn("Secret Key:", body)

    @patch('apps.gatepass.views.send_gatepass_email')
    def test_gatepass_departure_custom_email_body(self, mock_send_email):
        """Test gate pass departure uses custom email body when configured."""
        mock_send_email.return_value = True
        self.school_settings.email_notifications = True
        self.school_settings.gatepass_sender_email = 'sender@test.com'
        self.school_settings.gatepass_app_password = 'password123'
        self.school_settings.gatepass_departure_email_body = "Alert: {student_name} has checked out of campus."
        self.school_settings.save()

        gatepass = GatePass.objects.create(
            student=self.student,
            reason='Early departure',
            valid_until=timezone.now() + timedelta(hours=1),
            status='ACTIVE',
            secret_key='123456'
        )

        from apps.gatepass.views import GatePassVerifyAPIView
        factory = APIRequestFactory()
        request = factory.post('/api/gatepass/verify/', {
            'pass_id': str(gatepass.id),
            'secret_key': '123456'
        })
        view = GatePassVerifyAPIView.as_view()
        response = view(request)

        self.assertEqual(response.status_code, 200)
        mock_send_email.assert_called_once()
        args = mock_send_email.call_args[0]
        body = args[4]
        self.assertEqual(body, "Alert: Bobby Smith has checked out of campus.")


