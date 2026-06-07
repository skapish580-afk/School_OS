from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.finance.models import Invoice, FeeInstallment

class Command(BaseCommand):
    help = 'Daily task to check for overdue invoices and installments'

    def handle(self, *args, **options):
        today = timezone.now().date()
        self.stdout.write(f"Checking for overdue items on {today}...")

        # 1. Mark Invoices as OVERDUE
        overdue_invoices = Invoice.objects.filter(
            status__in=['UNPAID', 'PARTIAL'],
            due_date__lt=today
        )
        
        # We need to exclude those that are considered 'PARTIAL' due to payment plans 
        # if that logic is still desired, but usually, once past due, they are overdue.
        # The model save logic handles the status transition.
        
        count = 0
        for invoice in overdue_invoices:
            # Re-saving will trigger the status update logic in models.py
            invoice.save()
            count += 1
        
        self.stdout.write(self.style.SUCCESS(f"Updated {count} invoices to OVERDUE status."))

        # 2. Mark FeeInstallments as OVERDUE
        overdue_installments = FeeInstallment.objects.filter(
            status='PENDING',
            due_date__lt=today
        )
        updated_inst = overdue_installments.update(status='OVERDUE')
        
        self.stdout.write(self.style.SUCCESS(f"Marked {updated_inst} installments as OVERDUE."))
