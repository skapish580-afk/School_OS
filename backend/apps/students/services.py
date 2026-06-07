from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from .models import Student
from apps.audit.models import AuditLog

@transaction.atomic
def graduation_trigger(student_id, consent_for_alumni=False):
    """
    Triggers the graduation process for a student.
    - Updates status to GRADUATED
    - Sets alumni directory consent
    - Records audit log
    """
    try:
        student = Student.objects.get(id=student_id)

        student.status = 'GRADUATED'
        student.alumni_directory_consent = consent_for_alumni
        student.save()

        # Log the transition
        AuditLog.objects.create(
            actor=None,  # System action
            action='UPDATE',
            content_type=ContentType.objects.get_for_model(student),
            object_id=str(student.id),
            details=f"Student {student.user.full_name} graduated. Alumni Consent: {consent_for_alumni}"
        )

        return True, "Student graduated successfully"
    except Student.DoesNotExist:
        return False, "Student not found"
    except Exception as e:
        return False, str(e)
