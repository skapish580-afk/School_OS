from django.core.management.base import BaseCommand, CommandError
from apps.enrollments.models import StudentEnrollment
from apps.academics.models import ReportCard
from apps.students.models import Student
from apps.promotions.models import AcademicHistory
from django.db import transaction


class Command(BaseCommand):
    help = 'Backfill AcademicHistory from StudentEnrollment and ReportCard data'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=str, help='Academic year to backfill (e.g., 2024-2025)')
        parser.add_argument('--dry-run', action='store_true', help='Do not write to DB, just report')

    def handle(self, *args, **options):
        year = options.get('year')
        dry = options.get('dry_run')

        enrollments = StudentEnrollment.objects.all()
        if year:
            enrollments = enrollments.filter(academic_year=year)

        total = enrollments.count()
        created = 0
        skipped = 0

        self.stdout.write(f"Found {total} enrollments to examine...")

        for e in enrollments.select_related('student'):
            # Normalize class name
            class_name = str(e.grade)
            section = e.section or ''
            student = e.student

            exists = AcademicHistory.objects.filter(student=student, academic_year=e.academic_year, class_name=class_name, section=section).exists()
            if exists:
                skipped += 1
                continue

            # try to include report card summary
            report = ReportCard.objects.filter(student=student, academic_year=e.academic_year).order_by('-generated_date').first()
            marks = None
            grades = None
            awards = None
            summary = f"Enrollment record imported from enrollments: {class_name} {section} ({e.status})"

            if report:
                marks = {'percentage': float(report.percentage), 'total_obtained': float(report.total_marks_obtained)}
                grades = {'grade_awarded': report.grade_awarded, 'rank': report.rank}
                summary = f"ReportCard: {report.term_name} - {report.grade_awarded} ({report.percentage}%)"

            if dry:
                self.stdout.write(f"DRY: Would create AcademicHistory for {student} - {e.academic_year} - {class_name}/{section}")
                created += 1
                continue

            with transaction.atomic():
                AcademicHistory.objects.create(
                    student=student,
                    academic_year=e.academic_year,
                    class_name=class_name,
                    section=section,
                    marks=marks,
                    grades=grades,
                    awards=awards,
                    summary=summary,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created: {created}, Skipped (already present): {skipped}"))
