"""
Notification Signals
Triggers notifications when events occur in other apps
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender='academics.Result')
def send_marks_notification(sender, instance, created, **kwargs):
    """
    Signal: When a Result is approved, notify parents.
    """
    if not created and instance.status == 'APPROVED' and instance.is_latest_attempt:
        try:
            from .services import NotificationService
            service = NotificationService()
            
            # Get student's school
            school = instance.exam.subject_mapping.enrollment.student.school
            
            service.send_marks_notification(
                student=instance.exam.subject_mapping.enrollment.student,
                result=instance,
                school=school
            )
            logger.info(f"Marks notification sent for {instance}")
        except Exception as e:
            logger.error(f"Error sending marks notification: {e}")


@receiver(post_save, sender='attendance.StudentAttendance')
def send_attendance_notification(sender, instance, **kwargs):
    """
    Signal: When attendance is updated, check if below 75% and notify.
    """
    try:
        from .services import NotificationService
        service = NotificationService()
        
        # Get student's school
        student = instance.student
        school = student.school
        
        # Calculate current attendance percentage
        from apps.attendance.models import StudentAttendance
        total_days = StudentAttendance.objects.filter(
            student=student,
            date__year=timezone.now().year
        ).count()
        present_days = StudentAttendance.objects.filter(
            student=student,
            is_present=True,
            date__year=timezone.now().year
        ).count()
        
        if total_days > 0:
            attendance_percentage = (present_days / total_days) * 100
            
            if attendance_percentage < 75:
                service.send_attendance_alert(
                    student=student,
                    current_percentage=attendance_percentage,
                    school=school
                )
                logger.info(f"Attendance alert sent for {student.user.full_name}")
    except Exception as e:
        logger.error(f"Error sending attendance notification: {e}")


@receiver(post_save, sender='discipline.DisciplineRecord')
def send_discipline_notification(sender, instance, created, **kwargs):
    """
    Signal: When a discipline incident is recorded, notify parents.
    """
    if created:
        try:
            from .services import NotificationService
            service = NotificationService()
            
            student = instance.student
            school = student.school
            
            service.send_discipline_alert(
                student=student,
                incident={
                    'description': instance.incident_type,
                    'date': instance.date.strftime('%d-%m-%Y'),
                    'action': instance.action_taken or 'See school office for details',
                },
                school=school
            )
            logger.info(f"Discipline notification sent for {student.user.full_name}")
        except Exception as e:
            logger.error(f"Error sending discipline notification: {e}")


@receiver(post_save, sender='academics.StudentPromotionDecision')
def send_promotion_notification(sender, instance, created, **kwargs):
    """
    Signal: When promotion decision is finalized, notify parents.
    """
    if created:
        try:
            from .services import NotificationService
            service = NotificationService()
            
            student = instance.student
            school = student.school
            
            service.send_promotion_decision(
                student=student,
                decision=instance,
                school=school
            )
            logger.info(f"Promotion notification sent for {student.user.full_name}")
        except Exception as e:
            logger.error(f"Error sending promotion notification: {e}")


def ready():
    """
    Called when the app is ready.
    Import signals to register them.
    """
    import apps.notifications.signals  # noqa
