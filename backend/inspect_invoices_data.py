
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.finance.models import Invoice
from apps.enrollments.models_promotion import AcademicYear
from apps.schools.models import School

def inspect_invoices():
    print("--- INVOICE INSPECTION ---")
    invoices = Invoice.objects.all()
    print(f"Total Invoices: {invoices.count()}")
    for inv in invoices[:20]:
        print(f"INV: {inv.invoice_number} | Status: {inv.status} | Year: {inv.academic_year} | School: {inv.school.name if inv.school else 'None'} ({inv.school_id})")
    
    print("\n--- ACADEMIC YEARS ---")
    years = AcademicYear.objects.all()
    for y in years:
        print(f"Year: {y.year_code} | School: {y.school.name} | Status: {y.status}")

if __name__ == "__main__":
    inspect_invoices()
