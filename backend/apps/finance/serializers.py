from rest_framework import serializers
from .models import (
    FeeCategory, Invoice, Transaction, FeeSchedule, FeeStructure,
    StudentFeeAssignment, FeeInstallment, FeeHikeConfig, BulkFeeAssignment,
    FeeLedger, FeeLedgerEntry, DiscountRecord, LateFeeRule, FeeAuditLog, InvoiceItem,
    SalaryDeduction
)


# ============================================================
# FEE SCHEDULE SERIALIZERS
# ============================================================

class FeeScheduleSerializer(serializers.ModelSerializer):
    schedule_type_display = serializers.CharField(source='get_schedule_type_display', read_only=True)
    
    class Meta:
        model = FeeSchedule
        fields = [
            'id', 'school', 'name', 'schedule_type', 'schedule_type_display',
            'description', 'installments_per_year', 'discount_percentage',
            'late_fee_per_day', 'grace_period_days', 'max_late_fee',
            'is_default', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'school', 'created_at', 'updated_at']


class FeeScheduleListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views"""
    schedule_type_display = serializers.CharField(source='get_schedule_type_display', read_only=True)
    
    class Meta:
        model = FeeSchedule
        fields = ['id', 'name', 'schedule_type', 'schedule_type_display', 
                  'installments_per_year', 'is_default', 'is_active']


# ============================================================
# FEE STRUCTURE SERIALIZERS
# ============================================================

class FeeStructureSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = FeeStructure
        fields = [
            'id', 'school', 'name', 'grade', 'grade_name', 'academic_year',
            'tuition_fee', 'admission_fee', 'exam_fee', 'lab_fee',
            'library_fee', 'sports_fee', 'computer_fee', 'transport_fee',
            'misc_fee', 'development_fee', 'total_annual_fee',
            'previous_year_fee', 'hike_percentage', 'hike_applied_on',
            'is_active', 'notes', 'created_at', 'updated_at',
            'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'total_annual_fee', 'hike_percentage', 'created_at', 'updated_at']


class FeeStructureListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views"""
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    
    class Meta:
        model = FeeStructure
        fields = [
            'id', 'name', 'grade', 'grade_name', 'academic_year', 
            'tuition_fee', 'admission_fee', 'exam_fee', 'lab_fee',
            'library_fee', 'sports_fee', 'computer_fee', 'transport_fee',
            'misc_fee', 'development_fee', 'total_annual_fee', 'is_active'
        ]


# ============================================================
# FEE INSTALLMENT SERIALIZERS
# ============================================================

class FeeInstallmentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = FeeInstallment
        fields = [
            'id', 'fee_assignment', 'installment_number', 'installment_name',
            'amount_due', 'amount_paid', 'due_date', 'paid_date',
            'late_fee_applied', 'status', 'status_display', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ============================================================
# STUDENT FEE ASSIGNMENT SERIALIZERS
# ============================================================

class StudentFeeAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    student_grade = serializers.CharField(source='student.current_grade.grade_name', read_only=True)
    student_section = serializers.CharField(source='student.current_section.section_letter', read_only=True)
    
    fee_structure_name = serializers.CharField(source='fee_structure.name', read_only=True)
    fee_schedule_name = serializers.CharField(source='fee_schedule.name', read_only=True)
    
    installments = FeeInstallmentSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'student_name', 'student_suid', 
            'student_grade', 'student_section', 'school',
            'fee_structure', 'fee_structure_name',
            'fee_schedule', 'fee_schedule_name',
            'academic_year', 'total_annual_fee', 'per_installment_fee',
            'scholarship_percentage', 'sibling_discount', 'special_discount',
            'discount_reason', 'additional_fee', 'additional_fee_reason',
            'net_payable', 'total_paid', 'balance_due',
            'status', 'status_display',
            'requires_approval', 'approved_by', 'approved_by_name', 'approved_at',
            'notes', 'installments',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = [
            'id', 'total_annual_fee', 'per_installment_fee', 'net_payable',
            'balance_due', 'created_at', 'updated_at'
        ]


class StudentFeeAssignmentListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views"""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    fee_schedule_name = serializers.CharField(source='fee_schedule.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'student_name', 'student_suid',
            'fee_schedule_name', 'academic_year',
            'net_payable', 'total_paid', 'balance_due',
            'status', 'status_display'
        ]


# ============================================================
# FEE HIKE CONFIG SERIALIZERS
# ============================================================

class FeeHikeConfigSerializer(serializers.ModelSerializer):
    applied_by_name = serializers.CharField(source='applied_by.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = FeeHikeConfig
        fields = [
            'id', 'school', 'name', 'from_academic_year', 'to_academic_year',
            'hike_percentage', 'tuition_hike', 'transport_hike', 'other_hike',
            'effective_date', 'is_applied', 'applied_at', 'applied_by', 'applied_by_name',
            'notes', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'is_applied', 'applied_at', 'created_at']


# ============================================================
# BULK ASSIGNMENT SERIALIZERS
# ============================================================

class BulkFeeAssignmentSerializer(serializers.ModelSerializer):
    target_grade_name = serializers.CharField(source='target_grade.grade_name', read_only=True)
    target_section_name = serializers.CharField(source='target_section.full_name', read_only=True)
    fee_structure_name = serializers.CharField(source='fee_structure.name', read_only=True)
    fee_schedule_name = serializers.CharField(source='fee_schedule.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = BulkFeeAssignment
        fields = [
            'id', 'school', 'name', 'academic_year',
            'target_grade', 'target_grade_name',
            'target_section', 'target_section_name',
            'fee_structure', 'fee_structure_name',
            'fee_schedule', 'fee_schedule_name',
            'total_students', 'successful_assignments', 
            'failed_assignments', 'skipped_assignments',
            'status', 'error_log',
            'created_at', 'created_by', 'created_by_name', 'completed_at'
        ]
        read_only_fields = [
            'id', 'total_students', 'successful_assignments',
            'failed_assignments', 'skipped_assignments', 'status',
            'error_log', 'created_at', 'completed_at'
        ]


class BulkAssignRequestSerializer(serializers.Serializer):
    """Serializer for bulk assignment request"""
    fee_structure_id = serializers.UUIDField()
    schedule_type = serializers.ChoiceField(
        choices=['YEARLY', 'MONTHLY', 'HALF_YEARLY', 'QUARTERLY', 'BI_MONTHLY'],
        required=False,
        allow_null=True
    )
    academic_year = serializers.CharField(max_length=20)
    grade_id = serializers.UUIDField(required=False, allow_null=True)
    section_id = serializers.UUIDField(required=False, allow_null=True)
    student_ids = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    override_existing = serializers.BooleanField(default=False)


# ============================================================
# ORIGINAL SERIALIZERS (UPDATED)
# ============================================================

class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = ['id', 'school', 'name', 'amount', 'description', 
                  'is_recurring', 'is_active', 'created_at']
        read_only_fields = ['id', 'school', 'created_at']


class TransactionSerializer(serializers.ModelSerializer):
    collected_by_name = serializers.CharField(source='collected_by.full_name', read_only=True)
    payment_mode_display = serializers.CharField(source='get_payment_mode_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'invoice', 'student', 'student_name', 'school',
            'amount', 'payment_mode', 'payment_mode_display',
            'reference_number', 'transaction_date', 'receipt_number',
            'status', 'status_display', 'bank_name', 'cheque_date',
            'collected_by', 'collected_by_name', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['receipt_number', 'created_at', 'updated_at']


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    transactions = TransactionSerializer(many=True, read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    effective_status = serializers.SerializerMethodField()

    def get_effective_status(self, obj):
        """Compute real-time status so stale DB values are never returned to the UI."""
        from django.utils import timezone
        if obj.status in ('DRAFT', 'CANCELLED', 'PAID'):
            return obj.status
        if obj.paid_amount >= obj.total_amount:
            return 'PAID'
        if obj.due_date and obj.due_date < timezone.now().date():
            return 'OVERDUE'
        if obj.paid_amount > 0:
            return 'PARTIAL'
        return 'UNPAID'

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'student', 'student_name', 'student_suid',
            'school', 'fee_assignment', 'installment', 'academic_year',
            'categories', 'total_amount', 'paid_amount', 'late_fee',
            'balance_due', 'status', 'effective_status', 'status_display',
            'period_status', 'due_date',
            'notes', 'transactions', 'created_at', 'updated_at'
        ]
        read_only_fields = ['invoice_number', 'balance_due', 'created_at', 'updated_at']

    def validate(self, attrs):
        student = attrs.get('student')
        installment = attrs.get('installment')
        school = attrs.get('school') or (student.school if student else None)
        
        if student and installment:
            from apps.schools.models_settings import SchoolSettings
            school_settings = SchoolSettings.objects.filter(school=school).first()
            if school_settings and getattr(school_settings, 'prevent_duplicate_billing', True):
                if Invoice.objects.filter(student=student, installment=installment).exclude(status='CANCELLED').exists():
                    raise serializers.ValidationError("An invoice already exists for this installment.")
        return attrs


class InvoiceListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views"""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_status = serializers.SerializerMethodField()

    def get_effective_status(self, obj):
        """Compute real-time status so stale DB values are never returned to the UI."""
        from django.utils import timezone
        if obj.status in ('DRAFT', 'CANCELLED', 'PAID'):
            return obj.status
        if obj.paid_amount >= obj.total_amount:
            return 'PAID'
        if obj.due_date and obj.due_date < timezone.now().date():
            return 'OVERDUE'
        if obj.paid_amount > 0:
            return 'PARTIAL'
        return 'UNPAID'
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'student_name', 'student_suid',
            'total_amount', 'paid_amount', 'balance_due',
            'status', 'effective_status', 'period_status', 'due_date'
        ]


# ============================================================
# INVOICE ITEM SERIALIZERS
# ============================================================

class InvoiceItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'invoice', 'category', 'category_name',
            'description', 'quantity', 'unit_price', 'total_price',
            'discount_amount', 'net_amount', 'notes'
        ]
        read_only_fields = ['id', 'total_price', 'net_amount']


# ============================================================
# FEE LEDGER SERIALIZERS
# ============================================================

class FeeLedgerEntrySerializer(serializers.ModelSerializer):
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    payment_mode = serializers.CharField(source='transaction.payment_mode', read_only=True, allow_null=True)
    
    class Meta:
        model = FeeLedgerEntry
        fields = [
            'id', 'ledger', 'entry_type', 'entry_type_display',
            'date', 'description', 'category',
            'reference_number', 'amount', 'balance_after',
            'invoice', 'transaction', 'discount_record',
            'notes', 'created_at', 'created_by', 'created_by_name',
            'payment_mode'
        ]
        read_only_fields = ['id', 'balance_after', 'created_at']


class FeeLedgerSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    is_rte_student = serializers.BooleanField(source='student.is_rte_student', read_only=True)
    entries = FeeLedgerEntrySerializer(many=True, read_only=True)
    total_reimbursements = serializers.SerializerMethodField()
    
    class Meta:
        model = FeeLedger
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'is_rte_student', 'school',
            'academic_year', 'opening_balance', 'total_charges',
            'total_payments', 'total_discounts', 'total_fines',
            'current_balance', 'is_cleared', 'total_reimbursements',
            'entries', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'current_balance', 'created_at', 'updated_at']

    def get_total_reimbursements(self, obj):
        from apps.finance.models import Transaction
        from django.db.models import Sum
        try:
            start_year = int(obj.academic_year.split('-')[0])
            from datetime import date
            start_date = date(start_year, 4, 1)
            end_date = date(start_year + 1, 3, 31)
            txns = Transaction.objects.filter(
                student=obj.student,
                notes="State Government RTE Fee Reimbursement",
                transaction_date__range=(start_date, end_date)
            )
            return txns.aggregate(total=Sum('amount'))['total'] or 0.00
        except Exception:
            return 0.00


class FeeLedgerListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views"""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    is_rte_student = serializers.BooleanField(source='student.is_rte_student', read_only=True)
    grade_name = serializers.SerializerMethodField()
    total_reimbursements = serializers.SerializerMethodField()
    
    class Meta:
        model = FeeLedger
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'is_rte_student', 'grade_name',
            'academic_year', 'total_charges', 'total_payments',
            'current_balance', 'is_cleared', 'total_reimbursements'
        ]
    
    def get_grade_name(self, obj):
        if obj.student and obj.student.current_grade:
            return obj.student.current_grade.grade_name
        return None

    def get_total_reimbursements(self, obj):
        from apps.finance.models import Transaction
        from django.db.models import Sum
        try:
            start_year = int(obj.academic_year.split('-')[0])
            from datetime import date
            start_date = date(start_year, 4, 1)
            end_date = date(start_year + 1, 3, 31)
            txns = Transaction.objects.filter(
                student=obj.student,
                notes="State Government RTE Fee Reimbursement",
                transaction_date__range=(start_date, end_date)
            )
            return txns.aggregate(total=Sum('amount'))['total'] or 0.00
        except Exception:
            return 0.00


class StudentLedgerHistorySerializer(serializers.Serializer):
    """Serializer for complete student fee history across years"""
    student_id = serializers.UUIDField()
    student_name = serializers.CharField()
    student_suid = serializers.CharField()
    current_grade = serializers.CharField()
    is_rte_student = serializers.BooleanField(default=False)
    ledgers = FeeLedgerSerializer(many=True)
    lifetime_total_charges = serializers.DecimalField(max_digits=12, decimal_places=2)
    lifetime_total_payments = serializers.DecimalField(max_digits=12, decimal_places=2)
    lifetime_balance = serializers.DecimalField(max_digits=12, decimal_places=2)


# ============================================================
# DISCOUNT RECORD SERIALIZERS
# ============================================================

class DiscountRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    
    class Meta:
        model = DiscountRecord
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'school',
            'academic_year', 'discount_type', 'discount_type_display',
            'name', 'reason', 'is_percentage', 'percentage', 'fixed_amount',
            'calculated_amount', 'valid_from', 'valid_until', 'is_recurring',
            'supporting_documents', 'status', 'status_display',
            'requested_by', 'requested_by_name',
            'approved_by', 'approved_by_name', 'approved_at', 'rejection_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'calculated_amount', 'status',
            'approved_by', 'approved_at', 'rejection_reason',
            'created_at', 'updated_at'
        ]


class DiscountRecordListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views"""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DiscountRecord
        fields = [
            'id', 'student_name', 'student_suid', 'name',
            'discount_type', 'discount_type_display',
            'calculated_amount', 'valid_from', 'valid_until',
            'status', 'status_display'
        ]


class DiscountApprovalSerializer(serializers.Serializer):
    """Serializer for approving/rejecting discounts"""
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


# ============================================================
# LATE FEE RULE SERIALIZERS
# ============================================================

class LateFeeRuleSerializer(serializers.ModelSerializer):
    calculation_type_display = serializers.CharField(source='get_calculation_type_display', read_only=True)
    
    class Meta:
        model = LateFeeRule
        fields = [
            'id', 'school', 'name', 'description',
            'calculation_type', 'calculation_type_display',
            'fixed_amount', 'percentage', 'per_day_amount',
            'grace_period_days', 'max_late_fee',
            'applies_to_all', 'specific_grades', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ============================================================
# FEE AUDIT LOG SERIALIZERS
# ============================================================

class FeeAuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    model_type_display = serializers.CharField(source='get_model_type_display', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.full_name', read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    
    class Meta:
        model = FeeAuditLog
        fields = [
            'id', 'school', 'student', 'student_name',
            'action', 'action_display', 'model_type', 'model_type_display', 'model_id',
            'old_values', 'new_values', 'description',
            'ip_address', 'user_agent',
            'performed_at', 'performed_by', 'performed_by_name'
        ]
        read_only_fields = '__all__'


# ============================================================
# DASHBOARD & REPORT SERIALIZERS
# ============================================================

class FinanceDashboardSerializer(serializers.Serializer):
    """Dashboard summary data"""
    total_students = serializers.IntegerField()
    students_assigned = serializers.IntegerField()
    total_fee_assigned = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_outstanding = serializers.DecimalField(max_digits=15, decimal_places=2)
    collection_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    
    pending_invoices = serializers.IntegerField()
    overdue_invoices = serializers.IntegerField()
    pending_discounts = serializers.IntegerField()
    
    monthly_collection = serializers.ListField(
        child=serializers.DictField()
    )
    collection_by_category = serializers.ListField(
        child=serializers.DictField()
    )
    grade_wise_collection = serializers.ListField(
        child=serializers.DictField()
    )


class FeeReportRequestSerializer(serializers.Serializer):
    """Request serializer for fee reports"""
    report_type = serializers.ChoiceField(choices=[
        'collection_summary', 'outstanding_report', 'grade_wise',
        'category_wise', 'defaulters', 'discount_report'
    ])
    academic_year = serializers.CharField(required=False)
    from_date = serializers.DateField(required=False)
    to_date = serializers.DateField(required=False)
    grade_id = serializers.UUIDField(required=False)
    section_id = serializers.UUIDField(required=False)
    fee_category_id = serializers.UUIDField(required=False)
    export_format = serializers.ChoiceField(
        choices=['json', 'csv', 'excel', 'pdf'],
        default='json'
    )


# ============================================================
# SALARY DEDUCTION SERIALIZER
# ============================================================

class SalaryDeductionSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField(read_only=True)
    teacher_tuid = serializers.CharField(source='teacher.tuid', read_only=True)
    recorded_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SalaryDeduction
        fields = [
            'id', 'school', 'teacher', 'teacher_name', 'teacher_tuid',
            'month', 'amount', 'description',
            'recorded_by', 'recorded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'recorded_by', 'school']

    def validate(self, data):
        amount = data.get('amount')
        description = data.get('description')

        if amount is None or amount <= 0:
            raise serializers.ValidationError({'amount': 'Amount to Deduct (₹) is mandatory and must be greater than 0.'})

        if not description or not str(description).strip():
            raise serializers.ValidationError({'description': 'Description / Reason is mandatory.'})

        return data

    def get_teacher_name(self, obj):
        try:
            return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()
        except Exception:
            return obj.teacher.tuid

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return getattr(obj.recorded_by, 'full_name', None) or obj.recorded_by.email
        return None