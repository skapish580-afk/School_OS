from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.finance.models import Invoice, FeeInstallment
from datetime import timedelta

class Command(BaseCommand):
    help = 'Daily task to check for overdue invoices and send payment reminders'

    def handle(self, *args, **options):
        today = timezone.now().date()
        self.stdout.write(f"Checking for overdue items on {today}...")

        # 1. Mark Invoices as OVERDUE (bulk update — no model.save() needed)
        count = Invoice.objects.filter(
            status__in=['UNPAID', 'PARTIAL'],
            due_date__lt=today
        ).update(status='OVERDUE')
        
        self.stdout.write(self.style.SUCCESS(f"Updated {count} invoices to OVERDUE status."))

        # 2. Mark FeeInstallments as OVERDUE
        overdue_installments = FeeInstallment.objects.filter(
            status='PENDING',
            due_date__lt=today
        )
        updated_inst = overdue_installments.update(status='OVERDUE')
        
        self.stdout.write(self.style.SUCCESS(f"Marked {updated_inst} installments as OVERDUE."))

        # 3. Send Payment Reminders
        from apps.schools.models_settings import SchoolSettings
        from apps.notifications.services import ChannelService

        school_settings_cache = {}

        # A. Upcoming reminders (7 days prior)
        upcoming_date = today + timedelta(days=7)
        upcoming_invoices = Invoice.objects.filter(
            status__in=['UNPAID', 'PARTIAL'],
            due_date=upcoming_date
        ).select_related('student', 'student__user', 'school')

        upcoming_count = 0
        for inv in upcoming_invoices:
            school = inv.school
            if not school:
                continue
            if school.id not in school_settings_cache:
                school_settings_cache[school.id] = SchoolSettings.objects.filter(school=school).first()

            s_settings = school_settings_cache[school.id]
            if not s_settings or not s_settings.send_payment_reminders:
                continue

            email_notifications = s_settings.email_notifications
            sms_notifications = s_settings.sms_notifications

            if not email_notifications and not sms_notifications:
                continue

            student = inv.student
            if not student:
                continue
            guardians = student.guardians.all()
            primary_guardian = guardians.filter(is_primary=True).first() or guardians.first()

            email = None
            phone = None
            recipient_name = None

            if primary_guardian:
                email = primary_guardian.email
                phone = primary_guardian.phone
                recipient_name = primary_guardian.name
            else:
                email = student.user.email
                phone = getattr(student, 'phone', None)
                recipient_name = student.user.full_name

            # Prioritize email (Gmail) if both are enabled, else choose the enabled channel
            channel = None
            if email_notifications and sms_notifications:
                channel = 'email'
            elif email_notifications:
                channel = 'email'
            elif sms_notifications:
                channel = 'sms'

            if not channel:
                continue

            due_date_str = inv.due_date.strftime('%d-%m-%Y') if inv.due_date else ''
            subject = f"Payment Reminder: Invoice {inv.invoice_number} is due on {due_date_str}"
            message = f"Dear {recipient_name},\n\nThis is an automated reminder that invoice {inv.invoice_number} for student {student.user.full_name} is due on {due_date_str}. The pending balance is INR {inv.balance_due}. Please clear it before the due date."

            sent = False
            if channel == 'email' and email:
                sent = ChannelService.send_email(email=email, subject=subject, message=message)
            elif channel == 'sms' and phone:
                full_phone = phone if phone.startswith('+') else f"+91{phone}"
                sent = ChannelService.send_sms(phone=full_phone, message=message)

            if sent:
                upcoming_count += 1

        self.stdout.write(self.style.SUCCESS(f"Sent {upcoming_count} upcoming payment reminders."))

        # B. Overdue reminders (weekly)
        overdue_remind_invoices = Invoice.objects.filter(
            status='OVERDUE'
        ).select_related('student', 'student__user', 'school')

        overdue_count = 0
        for inv in overdue_remind_invoices:
            if not inv.due_date:
                continue

            days_past_due = (today - inv.due_date).days
            if days_past_due <= 0 or days_past_due % 7 != 0:
                continue

            school = inv.school
            if not school:
                continue
            if school.id not in school_settings_cache:
                school_settings_cache[school.id] = SchoolSettings.objects.filter(school=school).first()

            s_settings = school_settings_cache[school.id]
            if not s_settings or not s_settings.send_payment_reminders:
                continue

            email_notifications = s_settings.email_notifications
            sms_notifications = s_settings.sms_notifications

            if not email_notifications and not sms_notifications:
                continue

            student = inv.student
            if not student:
                continue
            guardians = student.guardians.all()
            primary_guardian = guardians.filter(is_primary=True).first() or guardians.first()

            email = None
            phone = None
            recipient_name = None

            if primary_guardian:
                email = primary_guardian.email
                phone = primary_guardian.phone
                recipient_name = primary_guardian.name
            else:
                email = student.user.email
                phone = getattr(student, 'phone', None)
                recipient_name = student.user.full_name

            channel = None
            if email_notifications and sms_notifications:
                channel = 'email'
            elif email_notifications:
                channel = 'email'
            elif sms_notifications:
                channel = 'sms'

            if not channel:
                continue

            subject = f"OVERDUE: Payment reminder for Invoice {inv.invoice_number}"
            message = f"Dear {recipient_name},\n\nThis is an automated reminder that invoice {inv.invoice_number} for student {student.user.full_name} is OVERDUE. The current balance due is INR {inv.balance_due}. Please pay immediately."

            sent = False
            if channel == 'email' and email:
                sent = ChannelService.send_email(email=email, subject=subject, message=message)
            elif channel == 'sms' and phone:
                full_phone = phone if phone.startswith('+') else f"+91{phone}"
                sent = ChannelService.send_sms(phone=full_phone, message=message)

            if sent:
                overdue_count += 1

        self.stdout.write(self.style.SUCCESS(f"Sent {overdue_count} overdue invoice reminders."))
