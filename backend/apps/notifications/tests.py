from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.schools.models import School
from apps.students.models import Student
from .models import NotificationTemplate, ParentContact, StudentNotificationLog

User = get_user_model()


class NotificationTemplateTestCase(TestCase):
    """Test notification template creation and rendering."""
    
    def setUp(self):
        self.school = School.objects.create(name='Test School')
        self.user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='test123'
        )
    
    def test_create_attendance_template(self):
        """Test creating an attendance notification template."""
        template = NotificationTemplate.objects.create(
            school=self.school,
            category='ATTENDANCE',
            title='Attendance Alert',
            body='Dear {{parent_name}}, {{student_name}}'s attendance is {{attendance_percentage}}%',
            channels={'email': True, 'sms': True, 'whatsapp': False},
            created_by=self.user
        )
        
        self.assertEqual(template.category, 'ATTENDANCE')
        self.assertEqual(template.title, 'Attendance Alert')
        self.assertTrue(template.channels['email'])
        self.assertFalse(template.channels['whatsapp'])


class ParentContactTestCase(TestCase):
    """Test parent contact management."""
    
    def setUp(self):
        self.parent = User.objects.create_user(
            username='parent1',
            email='parent@test.com',
            password='test123',
            first_name='John',
            last_name='Doe'
        )
    
    def test_create_parent_contact(self):
        """Test creating a parent contact."""
        contact = ParentContact.objects.create(
            parent=self.parent,
            phone_number='9876543210',
            phone_country_code='+91',
            email='parent@test.com',
            preferred_channels=['sms', 'email'],
            notifications_enabled=True
        )
        
        self.assertEqual(contact.parent.first_name, 'John')
        self.assertEqual(contact.get_full_phone(), '+919876543210')
        self.assertIn('sms', contact.preferred_channels)


class StudentNotificationLogTestCase(TestCase):
    """Test notification logging."""
    
    def setUp(self):
        self.school = School.objects.create(name='Test School')
        self.student_user = User.objects.create_user(
            username='student1',
            email='student@test.com',
            password='test123'
        )
        self.student = Student.objects.create(
            user=self.student_user,
            school=self.school,
            suid='12345'
        )
        self.parent = User.objects.create_user(
            username='parent1',
            email='parent@test.com',
            password='test123'
        )
    
    def test_create_notification_log(self):
        """Test creating a notification log entry."""
        log = StudentNotificationLog.objects.create(
            student=self.student,
            parent=self.parent,
            notification_type='ATTENDANCE',
            subject='Attendance Alert',
            message='Attendance is low',
            status='SENT',
            channels_sent={'sms': True, 'email': True},
            delivery_status={'sms': 'delivered', 'email': 'sent'}
        )
        
        self.assertEqual(log.notification_type, 'ATTENDANCE')
        self.assertEqual(log.status, 'SENT')
        self.assertTrue(log.channels_sent['sms'])
