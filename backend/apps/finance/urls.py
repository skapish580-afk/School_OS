from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    InvoiceViewSet, FeeCategoryViewSet, FeeScheduleViewSet,
    FeeStructureViewSet, StudentFeeAssignmentViewSet,
    FeeInstallmentViewSet, FeeHikeConfigViewSet, BulkFeeAssignmentViewSet,
    StudentFeeProfileView,
    # New viewsets
    FeeLedgerViewSet, DiscountRecordViewSet, LateFeeRuleViewSet,
    FeeAuditLogViewSet, FinanceDashboardView, FinanceSummaryView,
    SalaryDeductionViewSet,
)

router = DefaultRouter()

# Original endpoints
router.register(r'invoices', InvoiceViewSet)
router.register(r'categories', FeeCategoryViewSet)

# Fee management endpoints
router.register(r'schedules', FeeScheduleViewSet)
router.register(r'structures', FeeStructureViewSet)
router.register(r'assignments', StudentFeeAssignmentViewSet)
router.register(r'installments', FeeInstallmentViewSet)
router.register(r'hike-configs', FeeHikeConfigViewSet)
router.register(r'bulk-assignments', BulkFeeAssignmentViewSet)

# New endpoints for ledger, discounts, late fees, audit
router.register(r'ledgers', FeeLedgerViewSet)
router.register(r'discounts', DiscountRecordViewSet)
router.register(r'late-fee-rules', LateFeeRuleViewSet)
router.register(r'audit-logs', FeeAuditLogViewSet)

# Salary deductions
router.register(r'salary-deductions', SalaryDeductionViewSet)

urlpatterns = [
    path('invoices/export/', InvoiceViewSet.as_view({'get': 'export'}), name='invoice-export'),
    path('', include(router.urls)),
    path('student-fee-profile/<str:student_id>/', StudentFeeProfileView.as_view(), name='student-fee-profile'),
    path('dashboard/', FinanceDashboardView.as_view(), name='finance-dashboard'),
    path('summary/', FinanceSummaryView.as_view(), name='finance-summary'),
]