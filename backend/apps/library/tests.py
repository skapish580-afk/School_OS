from django.test import TestCase
from rest_framework.test import APITestCase
from apps.accounts.models import User
from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.students.models import Student
from apps.library.models import Book, IssueReturnLog
import datetime

class LibraryBookIssueTestCase(APITestCase):
    def setUp(self):
        self.school = School.objects.create(code="SCH-LIB-01", legal_name="Library Test School")
        self.teacher_user = User.objects.create_user(
            email="lib_teacher@school.com",
            password="password123",
            user_type="TEACHER",
            school=self.school,
            first_name="Jane",
            last_name="Doe"
        )
        self.teacher = Teacher.objects.create(user=self.teacher_user)
        
        self.student_user = User.objects.create_user(
            email="lib_student@school.com",
            password="password123",
            user_type="STUDENT",
            school=self.school,
            first_name="Johnny",
            last_name="Smith"
        )
        self.student = Student.objects.create(user=self.student_user, school=self.school, suid="STU-LIB-01")

        self.book = Book.objects.create(
            school=self.school,
            title="Physics Principles",
            author="Isaac Newton",
            isbn="1234567890",
            total_copies=5,
            available_copies=5
        )

    def test_issue_return_log_str_for_teacher_and_student(self):
        """Test that IssueReturnLog string representation works for both teachers and students without AttributeError."""
        due_date = datetime.date.today() + datetime.timedelta(days=14)
        
        log_teacher = IssueReturnLog.objects.create(
            book=self.book,
            borrower_type="TEACHER",
            teacher=self.teacher,
            due_date=due_date
        )
        self.assertIn("Physics Principles issued to Jane Doe", str(log_teacher))

        log_student = IssueReturnLog.objects.create(
            book=self.book,
            borrower_type="STUDENT",
            student=self.student,
            due_date=due_date
        )
        self.assertIn("Physics Principles issued to Johnny Smith", str(log_student))
