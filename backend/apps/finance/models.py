from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import uuid

# ============================================================
# 1. FEE SCHEDULE (PAYMENT FREQUENCY CONFIGURATION)
# ============================================================

class FeeSchedule(models.Model):
    """
    Defines payment frequency options for the school.
    Admin configures these schedules that can be assigned to students.
    
    Examples: Quarterly, Half-Yearly, Yearly, Per-Exam, Monthly
    """
    SCHEDULE_TYPES = [
        ('MONTHLY', 'Monthly'),
        ('BI_MONTHLY', 'Bi-Monthly (Every 2 months)'),
        ('QUARTERLY', 'Quarterly (Every 3 months)'),
        ('HALF_YEARLY', 'Half Yearly (Every 6 months)'),
        ('YEARLY', 'Yearly (Annual)'),
        ('PER_EXAM', 'Per Exam/Term'),
        ('CUSTOM', 'Custom'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_schedules')
    
    name = models.CharField(max_length=100)  # e.g., "Quarterly Payment Plan"
    schedule_type = models.CharField(max_length=20, choices=SCHEDULE_TYPES)
    description = models.TextField(blank=True)
    
    # Number of installments per year
    installments_per_year = models.PositiveIntegerField(default=4)
    
    # Discount for early payment or this schedule type (percentage)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Late fee configuration
    late_fee_per_day = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    grace_period_days = models.PositiveIntegerField(default=7, help_text="Days after due date before late fee applies")
    max_late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Maximum late fee cap")
    
    is_default = models.BooleanField(default=False, help_text="Default schedule for new students")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        unique_together = ['school', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.get_schedule_type_display()})"
    
    def save(self, *args, **kwargs):
        # Ensure only one default per school
        if self.is_default:
            FeeSchedule.objects.filter(school=self.school, is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


# ============================================================
# 2. FEE STRUCTURE (GRADE-WISE FEE DEFINITION)
# ============================================================

class FeeStructure(models.Model):
    """
    Defines the fee structure for a specific grade and academic year.
    This is where the actual fee amounts are set.
    
    Each grade can have different fee amounts.
    Fees can be increased yearly using hike percentage.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_structures')
    
    name = models.CharField(max_length=100)  # e.g., "Grade 10 Fee Structure 2025-26"
    grade = models.ForeignKey('schools.GradeConfiguration', on_delete=models.CASCADE, related_name='fee_structures', null=True, blank=True)
    academic_year = models.CharField(max_length=20)  # e.g., "2025-2026"
    
    # Base annual fees
    tuition_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    admission_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="One-time admission fee")
    exam_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    lab_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    library_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sports_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    computer_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    misc_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Miscellaneous charges")
    
    # Development/Building fund (optional)
    development_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Total annual fee (auto-calculated)
    total_annual_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Fee hike tracking
    previous_year_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Last year's total fee for comparison")
    hike_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Percentage increase from last year")
    hike_applied_on = models.DateField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='fee_structures_created')
    
    class Meta:
        ordering = ['-academic_year', 'grade__grade_order']
        unique_together = ['school', 'grade', 'academic_year']
    
    def __str__(self):
        grade_name = self.grade.grade_name if self.grade else "All Grades"
        return f"{grade_name} - {self.academic_year} (₹{self.total_annual_fee})"
    
    def calculate_total(self):
        """Calculate total annual fee from all components"""
        return (
            self.tuition_fee + self.admission_fee + self.exam_fee +
            self.lab_fee + self.library_fee + self.sports_fee +
            self.computer_fee + self.transport_fee + self.misc_fee +
            self.development_fee
        )
    
    def save(self, *args, **kwargs):
        self.total_annual_fee = self.calculate_total()
        
        # Calculate hike percentage if previous year fee is set
        if self.previous_year_fee and self.previous_year_fee > 0:
            self.hike_percentage = ((self.total_annual_fee - self.previous_year_fee) / self.previous_year_fee) * 100
        
        super().save(*args, **kwargs)
    
    def apply_hike(self, percentage):
        """Apply percentage hike to all fee components"""
        multiplier = Decimal(1 + (percentage / 100))
        
        self.previous_year_fee = self.total_annual_fee
        self.tuition_fee = self.tuition_fee * multiplier
        self.exam_fee = self.exam_fee * multiplier
        self.lab_fee = self.lab_fee * multiplier
        self.library_fee = self.library_fee * multiplier
        self.sports_fee = self.sports_fee * multiplier
        self.computer_fee = self.computer_fee * multiplier
        self.transport_fee = self.transport_fee * multiplier
        self.misc_fee = self.misc_fee * multiplier
        self.development_fee = self.development_fee * multiplier
        self.hike_percentage = percentage
        self.hike_applied_on = timezone.now().date()
        
        self.save()


# ============================================================
# 3. STUDENT FEE ASSIGNMENT (PER-STUDENT FEE CONFIGURATION)
# ============================================================

class StudentFeeAssignment(models.Model):
    """
    Assigns a fee structure and schedule to a specific student.
    This allows:
    - Bulk assignment to all students in a grade
    - Individual customization for special cases (scholarships, sibling discount, etc.)
    """
    ASSIGNMENT_STATUS = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Fee Suspended'),
        ('WAIVED', 'Fee Waived'),
        ('COMPLETED', 'Paid in Full'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='fee_assignments')
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='student_fee_assignments')
    
    # Fee configuration
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE, related_name='student_assignments')
    fee_schedule = models.ForeignKey(FeeSchedule, on_delete=models.CASCADE, related_name='student_assignments')
    
    academic_year = models.CharField(max_length=20)  # e.g., "2025-2026"
    
    # Calculated amounts based on structure and schedule
    total_annual_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    per_installment_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Special adjustments for this student
    scholarship_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Scholarship discount %")
    sibling_discount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Sibling discount amount")
    special_discount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Any other special discount")
    discount_reason = models.TextField(blank=True, help_text="Reason for any special discounts")
    
    # Additional fees for this student
    additional_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Any additional charges")
    additional_fee_reason = models.TextField(blank=True)
    
    # Final payable amount
    net_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Payment tracking
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    status = models.CharField(max_length=20, choices=ASSIGNMENT_STATUS, default='ACTIVE')
    
    # Admin approval for special cases
    requires_approval = models.BooleanField(default=False)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_assignments_approved')
    approved_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='fee_assignments_created')
    
    class Meta:
        ordering = ['-academic_year', '-created_at']
        unique_together = ['student', 'academic_year']
    
    def __str__(self):
        return f"{self.student} - {self.fee_schedule.name} - {self.academic_year}"
    
    def calculate_fees(self):
        """Calculate net payable fee after all discounts"""
        base_fee = self.fee_structure.total_annual_fee if self.fee_structure else Decimal('0')
        
        # Apply schedule discount
        schedule_discount = base_fee * (self.fee_schedule.discount_percentage / Decimal('100')) if self.fee_schedule else Decimal('0')
        
        # Apply scholarship
        scholarship_amount = base_fee * (self.scholarship_percentage / Decimal('100'))
        
        # Calculate net
        total_discounts = schedule_discount + scholarship_amount + self.sibling_discount + self.special_discount
        self.total_annual_fee = base_fee
        self.net_payable = base_fee - total_discounts + self.additional_fee
        
        # Calculate per installment
        if self.fee_schedule and self.fee_schedule.installments_per_year > 0:
            self.per_installment_fee = self.net_payable / Decimal(str(self.fee_schedule.installments_per_year))
        
        # Update balance
        self.balance_due = self.net_payable - self.total_paid
        
        return self.net_payable
    
    def save(self, *args, **kwargs):
        self.calculate_fees()
        super().save(*args, **kwargs)
        # Always sync with ledger on every save to ensure net_payable changes are reflected
        self._sync_to_ledger()

    def _sync_to_ledger(self):
        from django.apps import apps
        FeeLedger = apps.get_model('finance', 'FeeLedger')
        FeeLedgerEntry = apps.get_model('finance', 'FeeLedgerEntry')
        
        ledger, _ = FeeLedger.objects.get_or_create(
            student=self.student,
            school=self.school,
            academic_year=self.academic_year
        )
        
        desc = f"Annual Fee Assignment - {self.fee_structure.name if self.fee_structure else 'Manual'}"
        if self.special_discount > 0 and self.discount_reason:
            desc += f" ({self.discount_reason})"

        # Use update_or_create to prevent duplicate charges and reflect updates
        FeeLedgerEntry.objects.update_or_create(
            ledger=ledger,
            entry_type='CHARGE',
            description__startswith="Annual Fee Assignment",
            defaults={
                'date': self.created_at.date() if self.created_at else timezone.now().date(),
                'description': desc,
                'amount': self.net_payable,
                'created_by': self.created_by
            }
        )
        ledger.recalculate()


# ============================================================
# 4. FEE INSTALLMENT (PAYMENT DUE DATES)
# ============================================================

class FeeInstallment(models.Model):
    """
    Tracks individual installments for a student's fee assignment.
    Auto-generated based on fee schedule.
    """
    INSTALLMENT_STATUS = [
        ('PENDING', 'Pending'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('WAIVED', 'Waived'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fee_assignment = models.ForeignKey(StudentFeeAssignment, on_delete=models.CASCADE, related_name='installments')
    
    installment_number = models.PositiveIntegerField()
    installment_name = models.CharField(max_length=50)  # e.g., "Q1 - Apr-Jun", "H1 - Apr-Sep"
    
    amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    
    late_fee_applied = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    status = models.CharField(max_length=20, choices=INSTALLMENT_STATUS, default='PENDING')
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['fee_assignment', 'installment_number']
        unique_together = ['fee_assignment', 'installment_number']
    
    def __str__(self):
        return f"{self.fee_assignment.student} - {self.installment_name} - ₹{self.amount_due}"
    
    def check_overdue(self):
        """Check and update status if overdue"""
        if self.status == 'PENDING' and self.due_date < timezone.now().date():
            self.status = 'OVERDUE'
            self.save()


# ============================================================
# 5. FEE HIKE CONFIGURATION
# ============================================================

class FeeHikeConfig(models.Model):
    """
    Configuration for annual fee hikes.
    Admin can set up automatic or manual fee increases.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_hike_configs')
    
    name = models.CharField(max_length=100)  # e.g., "2026-27 Fee Revision"
    from_academic_year = models.CharField(max_length=20)  # e.g., "2025-2026"
    to_academic_year = models.CharField(max_length=20)  # e.g., "2026-2027"
    
    hike_percentage = models.DecimalField(max_digits=5, decimal_places=2, help_text="Overall hike percentage")
    
    # Optional: Different hikes for different components
    tuition_hike = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    transport_hike = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    other_hike = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    effective_date = models.DateField()
    
    # Status
    is_applied = models.BooleanField(default=False)
    applied_at = models.DateTimeField(null=True, blank=True)
    applied_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_hikes_applied')
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='fee_hikes_created')
    
    class Meta:
        ordering = ['-to_academic_year']
    
    def __str__(self):
        return f"{self.name} - {self.hike_percentage}% hike"


# ============================================================
# 6. ORIGINAL MODELS (UPDATED)
# ============================================================

class FeeCategory(models.Model):
    """ e.g. 'Tuition Fee - Grade 10', 'Transport - Zone A' """
    # Keep original auto ID for backward compatibility with existing data
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_categories', null=True)
    
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    is_recurring = models.BooleanField(default=True, help_text="Is this a recurring fee?")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    
    class Meta:
        verbose_name_plural = "Fee Categories"
    
    def __str__(self):
        return f"{self.name} (₹{self.amount})"

class Invoice(models.Model):
    """ A bill generated for a student """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('UNPAID', 'Unpaid'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('CANCELLED', 'Cancelled'),
    ]

    # Keep original auto ID for backward compatibility with existing data
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='invoices')
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='invoices', null=True)
    
    # Link to fee assignment and installment
    fee_assignment = models.ForeignKey(StudentFeeAssignment, on_delete=models.CASCADE, null=True, blank=True, related_name='invoices')
    installment = models.ForeignKey(FeeInstallment, on_delete=models.CASCADE, null=True, blank=True, related_name='invoices')
    ledger = models.ForeignKey('FeeLedger', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    invoice_number = models.CharField(max_length=30, unique=True, editable=False)
    categories = models.ManyToManyField(FeeCategory, blank=True) # What are they paying for?
    
    academic_year = models.CharField(max_length=20, blank=True)
    
    # Amounts
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Dates
    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='UNPAID')
    
    @property
    def period_status(self):
        """Distinguish between past, present (this month), and future invoices"""
        today = timezone.now().date()
        if self.status == 'PAID':
            return 'COMPLETED'
            
        if self.due_date < today.replace(day=1):
            return 'PAST'
        elif self.due_date.year == today.year and self.due_date.month == today.month:
            return 'PRESENT'
        else:
            return 'FUTURE'
    
    # Description and notes
    description = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    
    # Prevent editing paid invoices
    is_locked = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='invoices_created')

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            # Auto-generate INV-YYYY-XXXXXXXX
            year = timezone.now().year
            self.invoice_number = f"INV-{year}-{uuid.uuid4().hex[:8].upper()}"
        
        # Calculate subtotal from items if available
        if self.pk:
            items_total = sum(item.net_amount for item in self.items.all())
            if items_total > 0:
                self.subtotal = items_total
        
        # If there are no items, but total_amount is set and subtotal is 0, initialize subtotal
        if not self.subtotal and self.total_amount:
            self.subtotal = self.total_amount
            
        # Recalculate total_amount based on subtotal, discount_amount, and late_fee
        if self.subtotal:
            self.total_amount = self.subtotal - self.discount_amount + self.late_fee
        
        # Auto-update status based on payment
        if self.status not in ['DRAFT', 'CANCELLED']:
            if self.paid_amount >= self.total_amount:
                self.status = 'PAID'
                self.is_locked = True
                if not self.paid_date:
                    self.paid_date = timezone.now().date()
            elif self.due_date and self.due_date < timezone.now().date():
                self.status = 'OVERDUE'
            elif self.paid_amount > 0:
                self.status = 'PARTIAL'
            else:
                self.status = 'UNPAID'
            
        super().save(*args, **kwargs)
        
        # Sync with FeeLedger
        self._sync_to_ledger()

    def _sync_to_ledger(self):
        """Ensure this invoice is reflected in the student's fee ledger"""
        from django.apps import apps
        FeeLedger = apps.get_model('finance', 'FeeLedger')
        FeeLedgerEntry = apps.get_model('finance', 'FeeLedgerEntry')
        
        if not self.ledger:
            ledger, _ = FeeLedger.objects.get_or_create(
                student=self.student,
                school=self.school,
                academic_year=self.academic_year
            )
            self.ledger = ledger
            # Use update to avoid calling save() again and recursing
            self.__class__.objects.filter(pk=self.pk).update(ledger=ledger)
        
        # Create or update ledger entry for this invoice ONLY if it's an ad-hoc invoice
        # If it's linked to an installment, the full annual fee is already charged to the ledger by StudentFeeAssignment
        if not self.installment:
            entry, created = FeeLedgerEntry.objects.update_or_create(
                invoice=self,
                entry_type='CHARGE',
                defaults={
                    'ledger': self.ledger,
                    'date': self.invoice_date,
                    'description': f"Invoice {self.invoice_number}",
                    'amount': self.total_amount,
                    'created_by': self.created_by
                }
            )
            
        # Sync late fee if applicable
        if self.late_fee > 0:
            FeeLedgerEntry.objects.update_or_create(
                invoice=self,
                entry_type='FINE',
                defaults={
                    'ledger': self.ledger,
                    'date': timezone.now().date(),
                    'description': f"Late fee for Invoice {self.invoice_number}",
                    'amount': self.late_fee,
                    'created_by': self.created_by
                }
            )
        else:
            FeeLedgerEntry.objects.filter(invoice=self, entry_type='FINE').delete()
            
        # Recalculate ledger totals
        self.ledger.recalculate()

    def __str__(self):
        student_name = self.student.user.full_name if self.student and self.student.user else 'Unknown'
        return f"{self.invoice_number} - {student_name}"
    
    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount
    
    def can_edit(self):
        return not self.is_locked and self.status != 'PAID'

class Transaction(models.Model):
    """ A payment made against an invoice or directly to the ledger """
    MODE_CHOICES = [
        ('CASH', 'Cash'),
        ('UPI', 'UPI / Online'),
        ('CHEQUE', 'Cheque'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CARD', 'Debit/Credit Card'),
    ]
    
    STATUS_CHOICES = [
        ('SUCCESS', 'Successful'),
        ('PENDING', 'Pending'),
        ('FAILED', 'Failed'),
        ('REVERSED', 'Reversed'),
        ('COMPLETED', 'Completed'),
    ]

    # Keep original auto ID for backward compatibility with existing data
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='fee_transactions', null=True)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_transactions', null=True)
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUCCESS')
    
    reference_number = models.CharField(max_length=100, blank=True, help_text="Cheque No / UPI Ref / Transaction ID")
    reference_id = models.CharField(max_length=50, blank=True, help_text="Legacy field")  # Keep for backward compat
    
    # Payment date (can be different from creation date for backdated entries)
    transaction_date = models.DateField(default=timezone.now)
    
    collected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='payments_collected')
    
    receipt_number = models.CharField(max_length=50, blank=True, unique=True)
    
    # Bank details for cheque/bank transfer
    bank_name = models.CharField(max_length=100, blank=True)
    cheque_date = models.DateField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = f"RCP-{uuid.uuid4().hex[:8].upper()}"
            
        # Auto-fill student and school from invoice if missing
        if self.invoice:
            if not self.student:
                self.student = self.invoice.student
            if not self.school:
                self.school = self.invoice.school
        super().save(*args, **kwargs)
        
        # Update the Invoice's paid amount automatically if linked to invoice
        if self.invoice:
            # ONLY sum successful or completed transactions
            total_paid = sum(t.amount for t in self.invoice.transactions.filter(
                status__in=['SUCCESS', 'COMPLETED']
            ))
            self.invoice.paid_amount = total_paid
            self.invoice.save()
            
            # Also update fee assignment if linked
            if self.invoice.fee_assignment:
                assignment = self.invoice.fee_assignment
                total_assignment_paid = sum(
                    inv.paid_amount for inv in assignment.invoices.exclude(status='CANCELLED')
                )
                assignment.total_paid = total_assignment_paid
                assignment.balance_due = assignment.net_payable - total_assignment_paid
                if assignment.balance_due <= 0:
                    assignment.status = 'COMPLETED'
                assignment.save()
            
            # Update installment if linked
            if self.invoice.installment:
                inst = self.invoice.installment
                # Sum all payments across all invoices for this installment
                total_inst_paid = sum(inv.paid_amount for inv in inst.invoices.exclude(status='CANCELLED'))
                inst.amount_paid = total_inst_paid
                
                if inst.amount_paid >= inst.amount_due:
                    inst.status = 'PAID'
                    if not inst.paid_date:
                        inst.paid_date = timezone.now().date()
                elif inst.amount_paid > 0:
                    inst.status = 'PARTIAL'
                inst.save()
        
        # Sync with FeeLedger
        self._sync_to_ledger()

    def _sync_to_ledger(self):
        """Ensure this transaction is reflected in the student's fee ledger"""
        from django.apps import apps
        FeeLedger = apps.get_model('finance', 'FeeLedger')
        FeeLedgerEntry = apps.get_model('finance', 'FeeLedgerEntry')
        
        # Determine academic year and school
        academic_year = None
        school = self.school
        
        if self.invoice:
            academic_year = self.invoice.academic_year
            if not school: school = self.invoice.school
        
        if not academic_year:
            # Fallback to current year based string
            from django.utils import timezone
            now = timezone.now()
            academic_year = f"{now.year-1}-{now.year}" if now.month < 6 else f"{now.year}-{now.year+1}"
            
        if not school and self.student:
            school = self.student.school

        if not school or not self.student:
            return

        ledger, _ = FeeLedger.objects.get_or_create(
            student=self.student,
            school=school,
            academic_year=academic_year
        )
        
        FeeLedgerEntry.objects.update_or_create(
            transaction=self,
            defaults={
                'ledger': ledger,
                'entry_type': 'PAYMENT',
                'date': self.transaction_date,
                'description': f"Payment Received - {self.receipt_number}",
                'amount': self.amount,
                'created_by': self.collected_by,
                'reference_number': self.reference_number if self.reference_number else self.receipt_number,
                'notes': self.notes
            }
        )
        
        # Recalculate ledger totals
        ledger.recalculate()
    
    def __str__(self):
        return f"{self.receipt_number} - ₹{self.amount}"


# ============================================================
# 7. BULK ASSIGNMENT TRACKING
# ============================================================

class BulkFeeAssignment(models.Model):
    """
    Tracks bulk fee assignment operations.
    When admin assigns fees to all students in a grade at once.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='bulk_fee_assignments')
    
    name = models.CharField(max_length=100)  # e.g., "Grade 10 Fee Assignment 2025-26"
    academic_year = models.CharField(max_length=20)
    
    # Target
    target_grade = models.ForeignKey('schools.GradeConfiguration', on_delete=models.CASCADE, null=True, blank=True)
    target_section = models.ForeignKey('academics.Section', on_delete=models.CASCADE, null=True, blank=True)
    
    # What to assign
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE)
    fee_schedule = models.ForeignKey(FeeSchedule, on_delete=models.CASCADE)
    
    # Results
    total_students = models.PositiveIntegerField(default=0)
    successful_assignments = models.PositiveIntegerField(default=0)
    failed_assignments = models.PositiveIntegerField(default=0)
    skipped_assignments = models.PositiveIntegerField(default=0, help_text="Students with existing assignments")
    
    status = models.CharField(max_length=20, default='PENDING', choices=[
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ])
    
    error_log = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        grade_name = self.target_grade.grade_name if self.target_grade else "All Grades"
        return f"{self.name} - {grade_name} ({self.status})"


# ============================================================
# 8. FEE LEDGER (SINGLE SOURCE OF TRUTH FOR STUDENT FINANCES)
# ============================================================

class FeeLedger(models.Model):
    """
    Complete financial ledger for a student.
    Single source of truth - shows all charges, payments, discounts, fines.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='fee_ledgers')
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_ledgers')
    academic_year = models.CharField(max_length=20)  # e.g., "2025-2026"
    
    # Summary fields (auto-calculated from entries)
    total_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_payments = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_discounts = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_fines = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # Positive = Due, Negative = Credit
    
    # Opening balance from previous year
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Status
    is_cleared = models.BooleanField(default=False)  # True when balance is 0 or credit
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-academic_year', 'student__user__first_name']
        unique_together = ['student', 'academic_year']
    
    def __str__(self):
        return f"{self.student.suid} - {self.academic_year} - Balance: ₹{self.current_balance}"
    
    def recalculate(self):
        """Recalculate all totals and running balances from ledger entries"""
        entries = list(self.entries.order_by('date', 'created_at'))
        
        self.total_charges = sum(e.amount for e in entries if e.entry_type == 'CHARGE')
        self.total_payments = sum(e.amount for e in entries if e.entry_type == 'PAYMENT')
        self.total_discounts = sum(e.amount for e in entries if e.entry_type == 'DISCOUNT')
        self.total_fines = sum(e.amount for e in entries if e.entry_type == 'FINE')
        
        self.current_balance = (
            self.opening_balance + 
            self.total_charges + 
            self.total_fines - 
            self.total_payments - 
            self.total_discounts
        )
        
        self.is_cleared = self.current_balance <= 0
        self.save()

        # Calculate running balance (balance_after) for each entry in chronological order
        running = self.opening_balance
        to_update = []
        for entry in entries:
            if entry.entry_type in ('CHARGE', 'FINE', 'ADJUSTMENT', 'CARRIED_FORWARD'):
                running += entry.amount
            elif entry.entry_type in ('PAYMENT', 'DISCOUNT', 'REFUND'):
                running -= entry.amount
            
            if entry.balance_after != running:
                entry.balance_after = running
                to_update.append(entry)

        if to_update:
            FeeLedgerEntry.objects.bulk_update(to_update, ['balance_after'])

        return self.current_balance


class FeeLedgerEntry(models.Model):
    """
    Individual entry in the fee ledger.
    Every financial transaction creates a ledger entry.
    """
    ENTRY_TYPES = [
        ('CHARGE', 'Fee Charge'),
        ('PAYMENT', 'Payment Received'),
        ('DISCOUNT', 'Discount Applied'),
        ('FINE', 'Fine/Late Fee'),
        ('REFUND', 'Refund'),
        ('ADJUSTMENT', 'Manual Adjustment'),
        ('CARRIED_FORWARD', 'Carried Forward from Previous Year'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ledger = models.ForeignKey(FeeLedger, on_delete=models.CASCADE, related_name='entries')
    
    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPES)
    date = models.DateField()
    
    description = models.CharField(max_length=255)  # e.g., "Tuition Fee - Q1", "Cash Payment"
    category = models.CharField(max_length=100, blank=True)  # Fee category name
    fee_category = models.ForeignKey('FeeCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)  # Always positive
    
    # Running balance after this entry
    balance_after = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # References
    invoice = models.ForeignKey('Invoice', on_delete=models.CASCADE, null=True, blank=True, related_name='ledger_entries')
    transaction = models.ForeignKey('Transaction', on_delete=models.CASCADE, null=True, blank=True, related_name='ledger_entries')
    discount_record = models.ForeignKey('DiscountRecord', on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    
    # Metadata
    reference_number = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='ledger_entries_created')
    
    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name_plural = "Fee Ledger Entries"
    
    def __str__(self):
        return f"{self.date} - {self.entry_type} - ₹{self.amount}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.ledger_id:
            self.ledger.recalculate()

# ============================================================
# 11. SIGNAL HANDLERS FOR CASCADING UPDATES
# ============================================================

@receiver(post_delete, sender=StudentFeeAssignment)
def cleanup_ledger_on_assignment_delete(sender, instance, **kwargs):
    """
    When a fee assignment is deleted, remove its corresponding ledger charge
    and recalculate the student's ledger.
    """
    try:
        # Find the ledger entry created for this assignment
        entries = FeeLedgerEntry.objects.filter(
            ledger__student=instance.student,
            ledger__academic_year=instance.academic_year,
            entry_type='CHARGE',
            description__startswith="Annual Fee Assignment"
        )
        
        # If we have a ledger, recalculate it after deleting entries
        ledger = FeeLedger.objects.filter(
            student=instance.student,
            academic_year=instance.academic_year
        ).first()
        
        entries.delete()
        
        if ledger:
            ledger.recalculate()
    except Exception:
        pass

@receiver(post_delete, sender=Invoice)
@receiver(post_delete, sender=Transaction)
def recalculate_ledger_on_delete(sender, instance, **kwargs):
    """
    Ensure ledger is recalculated when invoices or transactions are deleted.
    """
    try:
        if hasattr(instance, 'ledger') and instance.ledger:
            instance.ledger.recalculate()
        elif hasattr(instance, 'student') and instance.student:
            # Fallback for transactions or invoices without direct ledger link
            academic_year = getattr(instance, 'academic_year', None)
            if academic_year:
                ledger = FeeLedger.objects.filter(
                    student=instance.student,
                    academic_year=academic_year
                ).first()
                if ledger:
                    ledger.recalculate()
    except Exception:
        pass
        # Recalculate ledger totals
        self.ledger.recalculate()


# ============================================================
# 9. DISCOUNT RECORD (SCHOLARSHIPS, DISCOUNTS WITH APPROVAL)
# ============================================================

class DiscountRecord(models.Model):
    """
    Records all discounts and scholarships applied to a student.
    Requires admin approval and maintains audit trail.
    """
    DISCOUNT_TYPES = [
        ('SCHOLARSHIP', 'Scholarship'),
        ('SIBLING', 'Sibling Discount'),
        ('STAFF_CHILD', 'Staff Child Discount'),
        ('MERIT', 'Merit-based Discount'),
        ('FINANCIAL_AID', 'Financial Aid'),
        ('EARLY_PAYMENT', 'Early Payment Discount'),
        ('PROMOTIONAL', 'Promotional Discount'),
        ('OTHER', 'Other'),
    ]
    
    APPROVAL_STATUS = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('REVOKED', 'Revoked'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='discount_records')
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='discount_records')
    academic_year = models.CharField(max_length=20)
    
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES)
    name = models.CharField(max_length=100)  # e.g., "Academic Excellence Scholarship"
    
    # Discount can be percentage or fixed amount
    is_percentage = models.BooleanField(default=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Calculated discount amount
    calculated_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Validity
    valid_from = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    is_recurring = models.BooleanField(default=True, help_text="Apply every year automatically")
    
    # Reason and documentation
    reason = models.TextField(help_text="Reason for granting this discount")
    supporting_documents = models.TextField(blank=True, help_text="Reference to supporting documents")
    
    # Approval workflow
    status = models.CharField(max_length=20, choices=APPROVAL_STATUS, default='PENDING')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='discounts_requested')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='discounts_approved')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.student.suid} - {self.name} ({self.status})"


# ============================================================
# 10. LATE FEE RULE (CONFIGURABLE FINE RULES)
# ============================================================

class LateFeeRule(models.Model):
    """
    Configurable rules for automatic late fee calculation.
    """
    CALCULATION_TYPES = [
        ('FIXED', 'Fixed Amount'),
        ('PERCENTAGE', 'Percentage of Due Amount'),
        ('PER_DAY', 'Per Day Late'),
        ('SLAB', 'Slab-based'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='late_fee_rules')
    
    name = models.CharField(max_length=100)  # e.g., "Standard Late Fee"
    description = models.TextField(blank=True)
    
    calculation_type = models.CharField(max_length=20, choices=CALCULATION_TYPES, default='PER_DAY')
    
    # Fixed amount settings
    fixed_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Percentage settings
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Per day settings
    per_day_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    
    # Grace period and caps
    grace_period_days = models.PositiveIntegerField(default=7)
    max_late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Maximum cap on late fee")
    
    # Applicability
    applies_to_all = models.BooleanField(default=True)
    specific_grades = models.ManyToManyField('schools.GradeConfiguration', blank=True, related_name='late_fee_rules')
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.get_calculation_type_display()})"
    
    def calculate_late_fee(self, due_amount, days_late):
        """Calculate late fee based on rule configuration"""
        if days_late <= self.grace_period_days:
            return Decimal('0')
        
        effective_days = days_late - self.grace_period_days
        
        if self.calculation_type == 'FIXED':
            fee = self.fixed_amount
        elif self.calculation_type == 'PERCENTAGE':
            fee = due_amount * (self.percentage / 100)
        elif self.calculation_type == 'PER_DAY':
            fee = self.per_day_amount * effective_days
        else:
            fee = Decimal('0')
        
        # Apply cap
        if self.max_late_fee > 0 and fee > self.max_late_fee:
            fee = self.max_late_fee
        
        return fee


# ============================================================
# 11. FEE AUDIT LOG (COMPLETE AUDIT TRAIL)
# ============================================================

class FeeAuditLog(models.Model):
    """
    Audit trail for all financial changes.
    Tracks who made what change and when.
    """
    ACTION_TYPES = [
        ('CREATE', 'Created'),
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
        ('APPROVE', 'Approved'),
        ('REJECT', 'Rejected'),
        ('PAYMENT', 'Payment Recorded'),
        ('REFUND', 'Refund Processed'),
        ('DISCOUNT_APPLIED', 'Discount Applied'),
        ('FINE_APPLIED', 'Fine Applied'),
        ('WAIVER', 'Fee Waived'),
    ]
    
    MODEL_TYPES = [
        ('INVOICE', 'Invoice'),
        ('TRANSACTION', 'Transaction'),
        ('FEE_ASSIGNMENT', 'Fee Assignment'),
        ('DISCOUNT', 'Discount Record'),
        ('LEDGER', 'Ledger Entry'),
        ('FEE_STRUCTURE', 'Fee Structure'),
        ('FEE_SCHEDULE', 'Fee Schedule'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='fee_audit_logs')
    
    # What was changed
    action = models.CharField(max_length=20, choices=ACTION_TYPES)
    model_type = models.CharField(max_length=20, choices=MODEL_TYPES)
    model_id = models.CharField(max_length=50)  # UUID or ID of the affected record
    
    # Who and when
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='fee_audit_logs')
    performed_at = models.DateTimeField(auto_now_add=True)
    
    # Related student (if applicable)
    student = models.ForeignKey('students.Student', on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_audit_logs')
    
    # Change details
    description = models.TextField()  # Human readable description
    old_values = models.JSONField(null=True, blank=True)  # Previous state
    new_values = models.JSONField(null=True, blank=True)  # New state
    
    # Additional context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    
    class Meta:
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['school', 'performed_at']),
            models.Index(fields=['student', 'performed_at']),
            models.Index(fields=['model_type', 'model_id']),
        ]
    
    def __str__(self):
        return f"{self.action} - {self.model_type} - {self.performed_at}"


# ============================================================
# 12. INVOICE ITEM (LINE ITEMS IN INVOICE)
# ============================================================

class InvoiceItem(models.Model):
    """
    Individual line items in an invoice.
    Shows detailed breakdown of charges.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    
    description = models.CharField(max_length=255)  # e.g., "Tuition Fee - Q1"
    category = models.ForeignKey(FeeCategory, on_delete=models.SET_NULL, null=True, blank=True)
    
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Optional discount on this item
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['invoice', 'id']
    
    def __str__(self):
        return f"{self.description} - ₹{self.net_amount}"
    
    def save(self, *args, **kwargs):
        self.total_price = self.unit_price * self.quantity
        self.net_amount = self.total_price - self.discount_amount
        super().save(*args, **kwargs)


# ============================================================
# SALARY DEDUCTION
# ============================================================

class SalaryDeduction(models.Model):
    """
    Records a salary deduction for a staff member (teaching or non-teaching)
    for a specific month. Each deduction is scoped to one month.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='salary_deductions')
    teacher = models.ForeignKey('teachers.Teacher', on_delete=models.CASCADE, related_name='salary_deductions')

    # The month this deduction applies to (stored as YYYY-MM)
    month = models.CharField(max_length=7, help_text="Month in YYYY-MM format, e.g. 2026-07")

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(help_text="Reason for the deduction")

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='salary_deductions_recorded'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Deduction ₹{self.amount} for {self.teacher} ({self.month})"