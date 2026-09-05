from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import User
from apps.schools.models import School
from apps.schools.models_dashboard import BroadcastNotification

class BroadcastNotificationTestCase(APITestCase):
    def setUp(self):
        self.school_a = School.objects.create(legal_name="School A", code="SCHA")
        self.school_b = School.objects.create(legal_name="School B", code="SCHB")

        self.admin_a = User.objects.create_user(
            email="admin_a@scha.com",
            password="password123",
            user_type="SCHOOL_ADMIN",
            school=self.school_a
        )
        self.teacher_a = User.objects.create_user(
            email="teacher_a@scha.com",
            password="password123",
            user_type="TEACHER",
            school=self.school_a
        )
        self.student_a = User.objects.create_user(
            email="student_a@scha.com",
            password="password123",
            user_type="STUDENT",
            school=self.school_a
        )

        self.teacher_b = User.objects.create_user(
            email="teacher_b@schb.com",
            password="password123",
            user_type="TEACHER",
            school=self.school_b
        )

    def test_notify_teachers_school_isolation(self):
        """Test that Notify Teachers filters teachers of school A only and creates broadcast."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post('/api/v1/schools/broadcasts/send/', {
            'title': 'Staff Meeting',
            'message': 'Meeting at 3 PM today',
            'audience': 'TEACHERS',
            'priority': 'HIGH'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['recipients_count'], 1)

        # Verify Teacher A can see notification
        self.client.force_authenticate(user=self.teacher_a)
        teacher_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(teacher_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(teacher_res.data), 1)
        self.assertEqual(teacher_res.data[0]['title'], 'Staff Meeting')
        self.assertEqual(teacher_res.data[0]['priority'], 'HIGH')

        # Verify Student A cannot see TEACHERS notification
        self.client.force_authenticate(user=self.student_a)
        student_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(student_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(student_res.data), 0)

        # Verify Teacher B (School B) cannot see School A notification
        self.client.force_authenticate(user=self.teacher_b)
        teacher_b_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(teacher_b_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(teacher_b_res.data), 0)

    def test_notify_students_school_isolation(self):
        """Test that Notify Students creates broadcast for students of school A only."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post('/api/v1/schools/broadcasts/send/', {
            'title': 'Sports Day Notice',
            'message': 'Registration opens tomorrow',
            'audience': 'STUDENTS',
            'priority': 'NORMAL'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify Student A can see notification
        self.client.force_authenticate(user=self.student_a)
        student_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(student_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(student_res.data), 1)
        self.assertEqual(student_res.data[0]['title'], 'Sports Day Notice')

        # Verify Teacher A does not see STUDENTS notification
        self.client.force_authenticate(user=self.teacher_a)
        teacher_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(len(teacher_res.data), 0)

    def test_notify_everyone_school_isolation(self):
        """Test that Notify Everyone reaches both Teachers and Students of school A."""
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post('/api/v1/schools/broadcasts/send/', {
            'title': 'Holiday Announcement',
            'message': 'School remains closed on Monday',
            'audience': 'BOTH',
            'priority': 'URGENT'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Both Teacher A and Student A see notification
        self.client.force_authenticate(user=self.teacher_a)
        t_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(len(t_res.data), 1)

        self.client.force_authenticate(user=self.student_a)
        s_res = self.client.get('/api/v1/schools/broadcasts/my_notifications/')
        self.assertEqual(len(s_res.data), 1)

    def test_automatic_date_driven_student_rollover(self):
        """Test that existing active students get automatically rolled over into active academic year."""
        from apps.students.models import Student
        from apps.enrollments.models import StudentEnrollment
        from apps.schools.models_settings import SchoolSettings, sync_school_academic_years

        settings, _ = SchoolSettings.objects.get_or_create(school=self.school_a)
        settings.academic_year_start_month = 4
        settings.academic_year_start_day = 1
        settings.academic_year_end_month = 3
        settings.academic_year_end_day = 31
        settings.save()

        student = Student.objects.create(
            user=self.student_a,
            school=self.school_a,
            suid="SUID1001",
            status="ACTIVE"
        )
        old_enrollment = StudentEnrollment.objects.create(
            student=student,
            school=self.school_a,
            grade="9",
            section="A",
            academic_year="2025-2026",
            status="ACTIVE"
        )

        sync_school_academic_years(self.school_a)

        curr_code = settings.get_academic_year_code_for_date()
        new_enrollment = StudentEnrollment.objects.filter(student=student, academic_year=curr_code).first()
        self.assertIsNotNone(new_enrollment)
        self.assertEqual(new_enrollment.grade, "9")
        self.assertEqual(new_enrollment.section, "A")
        self.assertEqual(new_enrollment.status, "ACTIVE")
        # Ensure past enrollment remains preserved
        self.assertTrue(StudentEnrollment.objects.filter(id=old_enrollment.id).exists())
