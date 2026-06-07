"""
Signal handlers for automatic report card calculation
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Result, ReportCard
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from decimal import Decimal
from django.db import transaction


def calculate_grade(percentage):
    """Calculate letter grade from percentage"""
    if percentage >= 90:
        return 'A+'
    elif percentage >= 80:
        return 'A'
    elif percentage >= 70:
        return 'B'
    elif percentage >= 60:
        return 'C'
    elif percentage >= 50:
        return 'D'
    else:
        return 'F'


def recalculate_student_report_card(student_id):
    """
    Recalculate report card for a single student based on their approved results
    """
    try:
        student = Student.objects.get(id=student_id)
        
        # Get all APPROVED/LOCKED results for this student
        results = Result.objects.filter(
            student=student,
            moderation_status__in=['APPROVED', 'LOCKED'],
            is_absent=False
        ).select_related('exam')
        
        if not results.exists():
            # No approved results yet, skip
            return
            
        # Calculate totals
        total_obtained = Decimal('0.00')
        total_possible = Decimal('0.00')
        
        for result in results:
            total_obtained += Decimal(str(result.marks_obtained))
            total_possible += Decimal(str(result.exam.max_marks))
        
        if total_possible == 0:
            return
            
        # Calculate percentage
        percentage = (total_obtained / total_possible) * Decimal('100.00')
        percentage = round(percentage, 2)
        
        # Calculate grade
        grade = calculate_grade(float(percentage))
        
        # Update or create report card
        with transaction.atomic():
            report_card, created = ReportCard.objects.update_or_create(
                student=student,
                academic_year='2026-2027',
                term_name='Term 1 - 2025-2026',
                defaults={
                    'total_marks_obtained': total_obtained,
                    'total_marks_possible': total_possible,
                    'percentage': percentage,
                    'grade_awarded': grade,
                }
            )
            
            # Recalculate rankings for the student's class
            recalculate_class_rankings(student)
            
    except Student.DoesNotExist:
        pass
    except Exception as e:
        print(f"Error recalculating report card for student {student_id}: {e}")


def recalculate_class_rankings(student):
    """
    Recalculate rankings for all students in the same class
    """
    try:
        # Get student's enrollment
        enrollment = StudentEnrollment.objects.filter(
            student=student,
            status='ACTIVE'
        ).first()
        
        if not enrollment:
            return
            
        # Get all students in the same class
        same_class_students = StudentEnrollment.objects.filter(
            grade=enrollment.grade,
            section=enrollment.section,
            status='ACTIVE'
        ).values_list('student_id', flat=True)
        
        # Get all report cards for students in this class
        report_cards = ReportCard.objects.filter(
            student_id__in=same_class_students,
            academic_year='2026-2027',
            term_name='Term 1 - 2025-2026'
        ).order_by('-percentage', 'student__user__first_name')
        
        # Assign ranks
        rank = 1
        for report_card in report_cards:
            if report_card.rank != rank:
                report_card.rank = rank
                report_card.save(update_fields=['rank'])
            rank += 1
            
    except Exception as e:
        print(f"Error recalculating rankings: {e}")


@receiver(post_save, sender=Result)
def result_saved(sender, instance, created, **kwargs):
    """
    Automatically recalculate report card when result is saved
    Only trigger for APPROVED or LOCKED results
    """
    if instance.moderation_status in ['APPROVED', 'LOCKED']:
        recalculate_student_report_card(instance.student.id)


@receiver(post_delete, sender=Result)
def result_deleted(sender, instance, **kwargs):
    """
    Recalculate report card when a result is deleted
    """
    if instance.moderation_status in ['APPROVED', 'LOCKED']:
        recalculate_student_report_card(instance.student.id)
