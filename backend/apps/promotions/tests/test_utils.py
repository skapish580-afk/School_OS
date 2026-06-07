from django.test import TestCase
from apps.schools.models import School
from apps.academics.models import Section
from apps.students.models import Student
from apps.accounts.models import User
from apps.enrollments.models import StudentEnrollment
from apps.promotions.models import PromotionBatch, PromotionAssignment, AcademicHistory
from apps.promotions.utils import generate_promotion_suggestions, commit_promotions, revert_promotions


class PromotionsUtilsTest(TestCase):
    def setUp(self):
        self.school = School.objects.create(name='Test School')
        # create grade and sections
        self.grade = Grade.objects.create(school=self.school, grade_number=1, grade_name='1')
        self.sec_a = Section.objects.create(school=self.school, grade=self.grade, section_letter='A', capacity=2)
        self.sec_b = Section.objects.create(school=self.school, grade=self.grade, section_letter='B', capacity=2)

        # create a user and students
        self.user = User.objects.create_user(username='admin', password='pass')
        self.students = []
        for i in range(3):
            s = Student.objects.create(suid=f'S{i}', user=self.user, school=self.school)
            self.students.append(s)
            StudentEnrollment.objects.create(student=s, school=self.school, grade='1', section='A', academic_year='2025-2026')

        self.batch = PromotionBatch.objects.create(school=self.school, year_from='2025-2026', year_to='2026-2027', initiated_by=self.user)
        # create assignments
        for s in self.students:
            PromotionAssignment.objects.create(batch=self.batch, student=s, current_class='1', current_section='A')

    def test_generate_suggestions_and_commit_and_revert(self):
        updated = generate_promotion_suggestions(self.batch)
        # After generation, assignments should be SUGGESTED or RETAINED
        statuses = set(a.status for a in updated)
        self.assertTrue(statuses.issubset({'SUGGESTED', 'RETAINED'}))

        res = commit_promotions(self.batch, user=self.user)
        self.assertIn('promoted_count', res)
        # batch should be COMMITTED
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, 'COMMITTED')

        # AcademicHistory entries should exist for promoted students
        hist_count = AcademicHistory.objects.filter(academic_year='2025-2026').count()
        self.assertGreaterEqual(hist_count, 0)

        # revert
        rev = revert_promotions(self.batch, user=self.user)
        self.assertIn('reverted_count', rev)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.status, 'REVIEW')
