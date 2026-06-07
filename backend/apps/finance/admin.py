from django.contrib import admin
from django.utils.html import format_html
from .models import (
    FeeCategory, Invoice, Transaction, FeeSchedule, FeeStructure,
    StudentFeeAssignment, FeeInstallment, FeeHikeConfig, BulkFeeAssignment,
    FeeLedger, FeeLedgerEntry, DiscountRecord, LateFeeRule, FeeAuditLog, InvoiceItem
)


# ============================================================
# FEE SCHEDULE ADMIN
# ============================================================

@admin.register(FeeSchedule)
class FeeScheduleAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'schedule_type', 'installments_per_year', 
                    'discount_percentage', 'is_default', 'is_active')
    list_filter = ('school', 'schedule_type', 'is_default', 'is_active')
    search_fields = ('name', 'description')
    ordering = ('school', 'name')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('school', 'name', 'schedule_type', 'description')
        }),
        ('Schedule Configuration', {
            'fields': ('installments_per_year', 'discount_percentage')
        }),
        ('Late Fee Settings', {
            'fields': ('late_fee_per_day', 'grace_period_days', 'max_late_fee')
        }),
        ('Status', {
            'fields': ('is_default', 'is_active')
        }),
    )


# ============================================================
# FEE STRUCTURE ADMIN
# ============================================================

@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'grade', 'academic_year', 'total_annual_fee_display',
                    'hike_percentage_display', 'is_active')
    list_filter = ('school', 'academic_year', 'is_active', 'grade')
    search_fields = ('name', 'notes')
    ordering = ('school', '-academic_year', 'grade__grade_number')
    readonly_fields = ('total_annual_fee', 'hike_percentage', 'hike_applied_on')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('school', 'name', 'grade', 'academic_year')
        }),
        ('Fee Components', {
            'fields': (
                'tuition_fee', 'admission_fee', 'exam_fee', 'lab_fee',
                'library_fee', 'sports_fee', 'computer_fee', 'transport_fee',
                'misc_fee', 'development_fee'
            )
        }),
        ('Calculated Totals', {
            'fields': ('total_annual_fee',),
            'classes': ('collapse',)
        }),
        ('Fee Hike Tracking', {
            'fields': ('previous_year_fee', 'hike_percentage', 'hike_applied_on'),
            'classes': ('collapse',)
        }),
        ('Status & Notes', {
            'fields': ('is_active', 'notes')
        }),
    )
    
    def total_annual_fee_display(self, obj):
        return f"₹{obj.total_annual_fee:,.2f}"
    total_annual_fee_display.short_description = 'Total Annual Fee'
    
    def hike_percentage_display(self, obj):
        if obj.hike_percentage:
            return f"+{obj.hike_percentage}%"
        return "-"
    hike_percentage_display.short_description = 'Hike %'


# ============================================================
# STUDENT FEE ASSIGNMENT ADMIN
# ============================================================

class FeeInstallmentInline(admin.TabularInline):
    model = FeeInstallment
    extra = 0
    readonly_fields = ('installment_number', 'installment_name', 'amount_due', 
                       'amount_paid', 'due_date', 'status')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(StudentFeeAssignment)
class StudentFeeAssignmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'school', 'fee_schedule', 'academic_year',
                    'net_payable_display', 'total_paid_display', 'balance_due_display', 'status')
    list_filter = ('school', 'academic_year', 'status', 'fee_schedule')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'student__suid')
    ordering = ('school', '-academic_year', 'student__user__first_name')
    readonly_fields = ('total_annual_fee', 'per_installment_fee', 'net_payable', 
                       'total_paid', 'balance_due')
    raw_id_fields = ('student', 'approved_by', 'created_by')
    inlines = [FeeInstallmentInline]
    
    fieldsets = (
        ('Student Info', {
            'fields': ('student', 'school', 'academic_year')
        }),
        ('Fee Configuration', {
            'fields': ('fee_structure', 'fee_schedule')
        }),
        ('Calculated Amounts', {
            'fields': ('total_annual_fee', 'per_installment_fee')
        }),
        ('Discounts & Adjustments', {
            'fields': (
                'scholarship_percentage', 'sibling_discount', 
                'special_discount', 'discount_reason',
                'additional_fee', 'additional_fee_reason'
            )
        }),
        ('Payment Summary', {
            'fields': ('net_payable', 'total_paid', 'balance_due', 'status')
        }),
        ('Approval', {
            'fields': ('requires_approval', 'approved_by', 'approved_at'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )
    
    def net_payable_display(self, obj):
        return f"₹{obj.net_payable:,.2f}"
    net_payable_display.short_description = 'Net Payable'
    
    def total_paid_display(self, obj):
        return f"₹{obj.total_paid:,.2f}"
    total_paid_display.short_description = 'Paid'
    
    def balance_due_display(self, obj):
        if obj.balance_due > 0:
            return format_html('<span style="color: red;">₹{:,.2f}</span>', obj.balance_due)
        return format_html('<span style="color: green;">₹{:,.2f}</span>', obj.balance_due)
    balance_due_display.short_description = 'Balance'


# ============================================================
# FEE INSTALLMENT ADMIN
# ============================================================

@admin.register(FeeInstallment)
class FeeInstallmentAdmin(admin.ModelAdmin):
    list_display = ('fee_assignment', 'installment_name', 'amount_due', 
                    'amount_paid', 'due_date', 'status_colored')
    list_filter = ('status', 'due_date')
    search_fields = ('fee_assignment__student__user__first_name', 
                     'fee_assignment__student__suid')
    ordering = ('due_date',)
    
    def status_colored(self, obj):
        colors = {
            'PENDING': 'orange',
            'PARTIAL': 'blue',
            'PAID': 'green',
            'OVERDUE': 'red',
            'WAIVED': 'gray'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {};">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'


# ============================================================
# FEE HIKE CONFIG ADMIN
# ============================================================

@admin.register(FeeHikeConfig)
class FeeHikeConfigAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'from_academic_year', 'to_academic_year',
                    'hike_percentage', 'effective_date', 'is_applied')
    list_filter = ('school', 'is_applied', 'to_academic_year')
    search_fields = ('name', 'notes')
    ordering = ('-to_academic_year',)
    readonly_fields = ('applied_at', 'applied_by')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('school', 'name')
        }),
        ('Year Configuration', {
            'fields': ('from_academic_year', 'to_academic_year', 'effective_date')
        }),
        ('Hike Percentages', {
            'fields': ('hike_percentage', 'tuition_hike', 'transport_hike', 'other_hike')
        }),
        ('Status', {
            'fields': ('is_applied', 'applied_at', 'applied_by')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )


# ============================================================
# BULK FEE ASSIGNMENT ADMIN
# ============================================================

@admin.register(BulkFeeAssignment)
class BulkFeeAssignmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'target_grade', 'academic_year',
                    'total_students', 'successful_assignments', 'failed_assignments', 'status')
    list_filter = ('school', 'status', 'academic_year')
    search_fields = ('name',)
    ordering = ('-created_at',)
    readonly_fields = ('total_students', 'successful_assignments', 'failed_assignments',
                       'skipped_assignments', 'status', 'error_log', 'completed_at')


# ============================================================
# ORIGINAL ADMIN (UPDATED)
# ============================================================

@admin.register(FeeCategory)
class FeeCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'amount', 'is_recurring', 'is_active')
    list_filter = ('school', 'is_recurring', 'is_active')
    search_fields = ('name', 'description')


class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    readonly_fields = ('receipt_number', 'amount', 'payment_mode', 'reference_number', 
                       'transaction_date', 'collected_by')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'student', 'school', 'total_amount', 
                    'paid_amount', 'balance_display', 'status_colored', 'due_date')
    list_filter = ('status', 'school', 'due_date', 'academic_year')
    search_fields = ('invoice_number', 'student__user__first_name', 
                     'student__user__last_name', 'student__suid')
    raw_id_fields = ('student', 'fee_assignment', 'installment')
    readonly_fields = ('invoice_number', 'paid_amount')
    inlines = [TransactionInline]
    
    def balance_display(self, obj):
        balance = obj.balance_due
        if balance > 0:
            return format_html('<span style="color: red;">₹{:,.2f}</span>', balance)
        return format_html('<span style="color: green;">₹{:,.2f}</span>', balance)
    balance_display.short_description = 'Balance Due'
    
    def status_colored(self, obj):
        colors = {
            'UNPAID': 'orange',
            'PARTIAL': 'blue',
            'PAID': 'green',
            'OVERDUE': 'red',
            'CANCELLED': 'gray'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {};">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'
    
    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ('invoice_number', 'paid_amount', 'status')
        return ('invoice_number',)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'invoice', 'amount', 'payment_mode', 
                    'transaction_date', 'collected_by')
    list_filter = ('payment_mode', 'transaction_date', 'status')
    search_fields = ('receipt_number', 'reference_number', 'invoice__invoice_number')
    readonly_fields = ('receipt_number',)


# ============================================================
# FEE LEDGER ADMIN
# ============================================================

class FeeLedgerEntryInline(admin.TabularInline):
    model = FeeLedgerEntry
    extra = 0
    readonly_fields = ('entry_type', 'date', 'description', 'amount', 'balance_after')
    can_delete = False
    ordering = ['-date', '-created_at']
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(FeeLedger)
class FeeLedgerAdmin(admin.ModelAdmin):
    list_display = ('student', 'academic_year', 'total_charges_display', 
                    'total_payments_display', 'current_balance_display', 'is_cleared')
    list_filter = ('school', 'academic_year', 'is_cleared')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'student__suid')
    readonly_fields = ('total_charges', 'total_payments', 'total_discounts', 
                       'total_fines', 'current_balance', 'is_cleared')
    raw_id_fields = ('student',)
    inlines = [FeeLedgerEntryInline]
    
    def total_charges_display(self, obj):
        return f"₹{obj.total_charges:,.2f}"
    total_charges_display.short_description = 'Charges'
    
    def total_payments_display(self, obj):
        return f"₹{obj.total_payments:,.2f}"
    total_payments_display.short_description = 'Payments'
    
    def current_balance_display(self, obj):
        if obj.current_balance > 0:
            return format_html('<span style="color: red; font-weight: bold;">₹{:,.2f}</span>', obj.current_balance)
        return format_html('<span style="color: green; font-weight: bold;">₹{:,.2f}</span>', obj.current_balance)
    current_balance_display.short_description = 'Balance'


@admin.register(FeeLedgerEntry)
class FeeLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ('ledger', 'entry_type', 'date', 'description', 'amount', 'balance_after')
    list_filter = ('entry_type', 'date', 'ledger__school')
    search_fields = ('description', 'ledger__student__suid')
    ordering = ['-date', '-created_at']


# ============================================================
# DISCOUNT RECORD ADMIN
# ============================================================

@admin.register(DiscountRecord)
class DiscountRecordAdmin(admin.ModelAdmin):
    list_display = ('student', 'name', 'discount_type', 'calculated_amount_display', 
                    'status_colored', 'valid_from', 'valid_until')
    list_filter = ('school', 'discount_type', 'status', 'academic_year')
    search_fields = ('student__suid', 'student__user__first_name', 'name')
    raw_id_fields = ('student', 'requested_by', 'approved_by')
    readonly_fields = ('calculated_amount', 'approved_at')
    
    fieldsets = (
        ('Student Info', {
            'fields': ('student', 'school', 'academic_year')
        }),
        ('Discount Details', {
            'fields': ('discount_type', 'name', 'is_percentage', 'percentage', 
                       'fixed_amount', 'calculated_amount')
        }),
        ('Validity', {
            'fields': ('valid_from', 'valid_until', 'is_recurring')
        }),
        ('Reason & Documentation', {
            'fields': ('reason', 'supporting_documents')
        }),
        ('Approval Workflow', {
            'fields': ('status', 'requested_by', 'approved_by', 'approved_at', 'rejection_reason')
        }),
    )
    
    def calculated_amount_display(self, obj):
        return f"₹{obj.calculated_amount:,.2f}"
    calculated_amount_display.short_description = 'Amount'
    
    def status_colored(self, obj):
        colors = {
            'PENDING': 'orange',
            'APPROVED': 'green',
            'REJECTED': 'red',
            'REVOKED': 'gray'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {};">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'


# ============================================================
# LATE FEE RULE ADMIN
# ============================================================

@admin.register(LateFeeRule)
class LateFeeRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'school', 'calculation_type', 'grace_period_days', 
                    'max_late_fee_display', 'is_active')
    list_filter = ('school', 'calculation_type', 'is_active')
    search_fields = ('name', 'description')
    filter_horizontal = ('specific_grades',)
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('school', 'name', 'description')
        }),
        ('Calculation Settings', {
            'fields': ('calculation_type', 'fixed_amount', 'percentage', 'per_day_amount')
        }),
        ('Limits', {
            'fields': ('grace_period_days', 'max_late_fee')
        }),
        ('Applicability', {
            'fields': ('applies_to_all', 'specific_grades', 'is_active')
        }),
    )
    
    def max_late_fee_display(self, obj):
        return f"₹{obj.max_late_fee:,.2f}" if obj.max_late_fee else "No cap"
    max_late_fee_display.short_description = 'Max Fee'


# ============================================================
# FEE AUDIT LOG ADMIN
# ============================================================

@admin.register(FeeAuditLog)
class FeeAuditLogAdmin(admin.ModelAdmin):
    list_display = ('performed_at', 'action', 'model_type', 'performed_by', 
                    'student', 'description_short')
    list_filter = ('school', 'action', 'model_type', 'performed_at')
    search_fields = ('description', 'student__suid', 'performed_by__email')
    readonly_fields = ('action', 'model_type', 'model_id', 'performed_by', 'performed_at',
                       'student', 'description', 'old_values', 'new_values', 
                       'ip_address', 'user_agent')
    ordering = ['-performed_at']
    
    def description_short(self, obj):
        return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
    description_short.short_description = 'Description'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


# ============================================================
# INVOICE ITEM ADMIN
# ============================================================

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1
    fields = ('description', 'category', 'quantity', 'unit_price', 'discount_amount', 'net_amount')
    readonly_fields = ('net_amount',)