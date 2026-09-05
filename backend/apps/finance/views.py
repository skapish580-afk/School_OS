from apps.core.school_isolation import SchoolIsolationMixin
from django.shortcuts import render
from django.http import HttpResponse
import csv
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db import transaction
from django.db.models import Sum, Count, Q, F, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.enrollments.models_promotion import AcademicYear

from .models import (
    Invoice, Transaction, FeeCategory, FeeSchedule, FeeStructure,
    StudentFeeAssignment, FeeInstallment, FeeHikeConfig, BulkFeeAssignment,
    FeeLedger, FeeLedgerEntry, DiscountRecord, LateFeeRule, FeeAuditLog, InvoiceItem
)
from .serializers import (
    InvoiceSerializer, InvoiceListSerializer, TransactionSerializer, 
    FeeCategorySerializer, FeeScheduleSerializer, FeeScheduleListSerializer,
    FeeStructureSerializer, FeeStructureListSerializer,
    StudentFeeAssignmentSerializer, StudentFeeAssignmentListSerializer,
    FeeInstallmentSerializer, FeeHikeConfigSerializer,
    BulkFeeAssignmentSerializer, BulkAssignRequestSerializer,
    # New serializers
    FeeLedgerSerializer, FeeLedgerListSerializer, FeeLedgerEntrySerializer,
    StudentLedgerHistorySerializer, DiscountRecordSerializer, DiscountRecordListSerializer,
    DiscountApprovalSerializer, LateFeeRuleSerializer, FeeAuditLogSerializer,
    InvoiceItemSerializer, FinanceDashboardSerializer, FeeReportRequestSerializer
)
from apps.accounts.permission_utils import RBACPermission
from apps.students.models import Student
from apps.academics.models import Section
from apps.enrollments.models import StudentEnrollment


# ============================================================
# FEE SCHEDULE VIEWSET
# ============================================================

class FeeScheduleViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing fee payment schedules (Quarterly, Half-Yearly, etc.)
    """
    queryset = FeeSchedule.objects.all()
    serializer_class = FeeScheduleSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'fee_schedule'
    
    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FeeScheduleListSerializer
        return FeeScheduleSerializer
        
    def perform_create(self, serializer):
        school = getattr(self.request.user, 'school', None)
        serializer.save(school=school)
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this schedule as the default for the school"""
        schedule = self.get_object()
        schedule.is_default = True
        schedule.save()
        return Response({'message': f'{schedule.name} is now the default schedule'})


# ============================================================
# FEE STRUCTURE VIEWSET
# ============================================================

class FeeStructureViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing grade-wise fee structures
    """
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'fee_structure'
    rbac_action_permissions = {
        'list':           'finance.view_fee_structure',
        'retrieve':       'finance.view_fee_structure',
        'create':         'finance.edit_fee_structure',
        'update':         'finance.edit_fee_structure',
        'partial_update': 'finance.edit_fee_structure',
        'destroy':        'finance.edit_fee_structure',
        'apply_hike':     'finance.edit_fee_structure',
        'copy_to_next_year': 'finance.edit_fee_structure',
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        grade_id = self.request.query_params.get('grade')
        if grade_id:
            queryset = queryset.filter(grade_id=grade_id)
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FeeStructureListSerializer
        return FeeStructureSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def apply_hike(self, request, pk=None):
        """Apply percentage hike to this fee structure"""
        structure = self.get_object()
        percentage = float(request.data.get('percentage', 0))
        
        if percentage <= 0:
            return Response({'error': 'Hike percentage must be positive'}, status=400)
        
        structure.apply_hike(percentage)
        return Response({
            'message': f'{percentage}% hike applied successfully',
            'new_total': str(structure.total_annual_fee)
        })
    
    @action(detail=False, methods=['post'])
    def copy_to_next_year(self, request):
        """Copy all structures from one academic year to next with optional hike"""
        from_year = request.data.get('from_year')
        to_year = request.data.get('to_year')
        hike_percentage = float(request.data.get('hike_percentage', 0))
        school_id = request.data.get('school_id')
        
        if not all([from_year, to_year, school_id]):
            return Response({'error': 'from_year, to_year, and school_id are required'}, status=400)
        
        structures = FeeStructure.objects.filter(school_id=school_id, academic_year=from_year)
        created_count = 0
        
        for old_structure in structures:
            # Check if already exists
            if FeeStructure.objects.filter(
                school_id=school_id, 
                grade=old_structure.grade, 
                academic_year=to_year
            ).exists():
                continue
            
            # Create new structure
            multiplier = 1 + (hike_percentage / 100)
            new_structure = FeeStructure.objects.create(
                school_id=school_id,
                name=old_structure.name.replace(from_year, to_year),
                grade=old_structure.grade,
                academic_year=to_year,
                tuition_fee=old_structure.tuition_fee * multiplier,
                admission_fee=old_structure.admission_fee,  # Usually no hike on admission
                exam_fee=old_structure.exam_fee * multiplier,
                lab_fee=old_structure.lab_fee * multiplier,
                library_fee=old_structure.library_fee * multiplier,
                sports_fee=old_structure.sports_fee * multiplier,
                computer_fee=old_structure.computer_fee * multiplier,
                transport_fee=old_structure.transport_fee * multiplier,
                misc_fee=old_structure.misc_fee * multiplier,
                development_fee=old_structure.development_fee * multiplier,
                previous_year_fee=old_structure.total_annual_fee,
                hike_percentage=hike_percentage,
                hike_applied_on=timezone.now().date(),
                created_by=request.user
            )
            created_count += 1
        
        return Response({
            'message': f'{created_count} fee structures copied to {to_year}',
            'hike_applied': f'{hike_percentage}%'
        })


# ============================================================
# STUDENT FEE ASSIGNMENT VIEWSET
# ============================================================

class StudentFeeAssignmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'student__school'
    """
    API for managing individual student fee assignments
    """
    queryset = StudentFeeAssignment.objects.all()
    serializer_class = StudentFeeAssignmentSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'fee_assignment'
    rbac_action_permissions = {
        'list':                   ['finance.view_fee_assignment', 'finance.bulk_assign', 'finance.allocate_plan'],
        'retrieve':               ['finance.view_fee_assignment', 'finance.bulk_assign', 'finance.allocate_plan'],
        'create':                 'finance.edit_fee_assignment',
        'update':                 'finance.edit_fee_assignment',
        'partial_update':         'finance.edit_fee_assignment',
        'destroy':                'finance.edit_fee_assignment',
        'bulk_assign':            ['finance.edit_fee_assignment', 'finance.bulk_assign'],
        'bulk_allocate_schedule': ['finance.edit_fee_assignment', 'finance.allocate_plan'],
        'record_reimbursement':   ['finance.edit_ledger', 'finance.edit_fee_assignment'],
    }

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'student', 'student__user', 'fee_structure', 'fee_schedule'
        ).prefetch_related('installments')
        
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return StudentFeeAssignmentListSerializer
        return StudentFeeAssignmentSerializer
    
    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()
        student = assignment.student
        academic_year = assignment.academic_year

        from apps.finance.models import FeeLedgerEntry, Invoice, FeeLedger
        # 1. Delete uncollected invoices associated with assignment
        Invoice.objects.filter(
            student=student,
            academic_year=academic_year,
            fee_assignment=assignment
        ).exclude(status='PAID').delete()

        # 2. Delete charge entries in FeeLedgerEntry
        FeeLedgerEntry.objects.filter(
            ledger__student=student,
            ledger__academic_year=academic_year,
            entry_type='CHARGE',
            description__startswith="Annual Fee Assignment"
        ).delete()

        # 3. Delete installments
        assignment.installments.all().delete()

        # 4. Delete assignment instance
        res = super().destroy(request, *args, **kwargs)

        # 5. Recalculate ledger
        ledger = FeeLedger.objects.filter(student=student, academic_year=academic_year).first()
        if ledger:
            ledger.recalculate()

        return Response({'message': 'Fee assignment deleted successfully'}, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        # Apply concession if student has fee concession applicable
        student = instance.student
        if student.fee_concession_applicable and student.fee_concession_amount > 0:
            instance.special_discount = student.fee_concession_amount
            if not instance.discount_reason:
                instance.discount_reason = f"Concession of ₹{student.fee_concession_amount} applied"
            instance.save()
        # Generate installments
        self._generate_installments(instance)
    
    def _generate_installments(self, assignment):
        """Generate fee installments based on schedule"""
        schedule = assignment.fee_schedule
        if not schedule:
            return
        
        # Ensure assignment net_payable and per_installment_fee are fresh and saved
        assignment.calculate_fees()
        assignment.save()

        # Clean up any pre-existing installments to prevent duplicate or stale amount records
        assignment.installments.all().delete()

        # Determine installment dates based on schedule type
        installment_names = self._get_installment_names(schedule)
        due_dates = self._get_due_dates(schedule, assignment.academic_year)
        
        from decimal import Decimal
        if schedule.installments_per_year > 0:
            amount_per_installment = assignment.net_payable / Decimal(str(schedule.installments_per_year))
        else:
            amount_per_installment = assignment.net_payable

        for i, (name, due_date) in enumerate(zip(installment_names, due_dates), 1):
            FeeInstallment.objects.create(
                fee_assignment=assignment,
                installment_number=i,
                installment_name=name,
                amount_due=amount_per_installment,
                due_date=due_date
            )
    
    def _get_installment_names(self, schedule):
        """Get installment names based on schedule type"""
        names = {
            'MONTHLY': [f'Month {i}' for i in range(1, 13)],
            'QUARTERLY': ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'],
            'HALF_YEARLY': ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'],
            'YEARLY': ['Annual Fee'],
            'PER_EXAM': ['Term 1 Exam', 'Term 2 Exam', 'Final Exam'],
        }
        return names.get(schedule.schedule_type, [f'Installment {i}' for i in range(1, schedule.installments_per_year + 1)])
    
    def _get_due_dates(self, schedule, academic_year):
        """Generate due dates based on schedule type"""
        # Parse academic year (e.g., "2025-2026")
        start_year = int(academic_year.split('-')[0])
        
        # Academic year typically starts in April
        base_date = datetime(start_year, 4, 15)  # April 15th
        
        dates = []
        if schedule.schedule_type == 'MONTHLY':
            for i in range(12):
                dates.append((base_date + relativedelta(months=i)).date())
        elif schedule.schedule_type == 'QUARTERLY':
            for i in range(4):
                dates.append((base_date + relativedelta(months=i*3)).date())
        elif schedule.schedule_type == 'HALF_YEARLY':
            dates = [base_date.date(), (base_date + relativedelta(months=6)).date()]
        elif schedule.schedule_type == 'YEARLY':
            dates = [base_date.date()]
        elif schedule.schedule_type == 'PER_EXAM':
            # Typical exam schedule
            dates = [
                datetime(start_year, 7, 15).date(),   # Term 1
                datetime(start_year, 11, 15).date(),  # Term 2
                datetime(start_year + 1, 2, 15).date()  # Final
            ]
        else:
            # Custom - spread evenly
            for i in range(schedule.installments_per_year):
                months_gap = 12 // schedule.installments_per_year
                dates.append((base_date + relativedelta(months=i*months_gap)).date())
        
        return dates

    def _generate_all_invoices(self, assignment):
        """Generate all invoices for the entire academic year upon assignment"""
        if assignment.student.is_rte_student:
            return
            
        installments = assignment.installments.all().order_by('installment_number')
        
        for installment in installments:
            # Check if invoice already exists
            if not Invoice.objects.filter(installment=installment).exists():
                Invoice.objects.create(
                    student=assignment.student,
                    school=assignment.school,
                    fee_assignment=assignment,
                    installment=installment,
                    academic_year=assignment.academic_year,
                    total_amount=installment.amount_due,
                    due_date=installment.due_date,
                    created_by=assignment.created_by
                )
    
    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        """
        Bulk assign fees to multiple students.
        Can target: all students, specific grade, or specific section
        """
        serializer = BulkAssignRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        
        data = serializer.validated_data
        concession_selections = request.data.get('concession_selections', {})
        
        try:
            fee_structure = FeeStructure.objects.get(id=data['fee_structure_id'])
        except FeeStructure.DoesNotExist:
            return Response({'error': 'Fee structure not found'}, status=404)
        
        # Auto-create or fetch the payment schedule for this school
        schedule_type = data.get('schedule_type') or 'YEARLY'
        schedule_defaults = {
            'YEARLY': {'name': 'Yearly Payment Plan', 'installments_per_year': 1},
            'MONTHLY': {'name': 'Monthly Payment Plan', 'installments_per_year': 12},
            'HALF_YEARLY': {'name': 'Semester Payment Plan', 'installments_per_year': 2},
            'QUARTERLY': {'name': 'Quarterly Payment Plan', 'installments_per_year': 4},
            'BI_MONTHLY': {'name': 'Bi-Monthly Payment Plan', 'installments_per_year': 6},
        }
        defaults = schedule_defaults.get(schedule_type, {'name': f'{schedule_type} Plan', 'installments_per_year': 1})
        
        fee_schedule, created = FeeSchedule.objects.get_or_create(
            school=fee_structure.school,
            schedule_type=schedule_type,
            defaults={
                'name': defaults['name'],
                'installments_per_year': defaults['installments_per_year'],
                'is_active': True,
            }
        )
        
        # Create bulk assignment record
        bulk_record = BulkFeeAssignment.objects.create(
            school=fee_structure.school,
            name=f"Bulk Assignment - {timezone.now().strftime('%Y-%m-%d %H:%M')}",
            academic_year=data['academic_year'],
            target_grade_id=data.get('grade_id'),
            target_section_id=data.get('section_id'),
            fee_structure=fee_structure,
            fee_schedule=fee_schedule,
            status='IN_PROGRESS',
            created_by=request.user
        )
        
        # Build student query
        students = Student.objects.filter(
            school=fee_structure.school,
            status__in=['ACTIVE', 'TEMPORARY']
        )
        if data.get('academic_year'):
            students = students.filter(enrollments__academic_year=data['academic_year']).distinct()
        
        if data.get('student_ids'):
            students = students.filter(id__in=data['student_ids'])
        elif data.get('grade_id'):
            students = students.filter(grade_config_id=data['grade_id'])
        elif fee_structure.grade:
            students = students.filter(grade_config=fee_structure.grade)
        
        if not data.get('student_ids') and data.get('section_id'):
            students = students.filter(current_section_id=data['section_id'])
        
        bulk_record.total_students = students.count()
        
        successful = 0
        failed = 0
        skipped = 0
        errors = []
        
        for student in students:
            try:
                # Check if assignment already exists
                existing = StudentFeeAssignment.objects.filter(
                    student=student,
                    academic_year=data['academic_year']
                ).first()
                
                if existing and not data.get('override_existing', False):
                    skipped += 1
                    continue
                
                # If overriding existing but we want to preserve schedule if not changed
                selected_schedule = fee_schedule
                if existing:
                    # preserve the schedule they had if they had one
                    if not data.get('schedule_type'):
                        selected_schedule = existing.fee_schedule
                        
                    # Wipe the associated ledger entry first to prevent double charging
                    from apps.finance.models import FeeLedgerEntry, Invoice
                    FeeLedgerEntry.objects.filter(
                        ledger__student=student,
                        ledger__academic_year=data['academic_year'],
                        entry_type='CHARGE',
                        description__startswith='Annual Fee Assignment'
                    ).delete()
                    
                    # Delete associated invoices so we don't have orphans
                    Invoice.objects.filter(
                        student=student,
                        academic_year=data['academic_year'],
                        fee_assignment=existing
                    ).delete()
                    
                    existing.delete()
                
                # Create assignment
                assignment = StudentFeeAssignment.objects.create(
                    student=student,
                    school=fee_structure.school,
                    fee_structure=fee_structure,
                    fee_schedule=selected_schedule,
                    academic_year=data['academic_year'],
                    created_by=request.user
                )

                # Apply concession if applicable
                if student.fee_concession_applicable and student.fee_concession_amount > 0:
                    selected_fee_field = concession_selections.get(str(student.id))
                    if selected_fee_field:
                        assignment.special_discount = student.fee_concession_amount
                        field_labels = {
                            'tuition_fee': 'Tuition Fee',
                            'admission_fee': 'Admission Fee',
                            'exam_fee': 'Exam Fee',
                            'lab_fee': 'Lab Fee',
                            'library_fee': 'Library Fee',
                            'sports_fee': 'Sports Fee',
                            'computer_fee': 'Computer Fee',
                            'transport_fee': 'Transport Fee',
                            'misc_fee': 'Miscellaneous Fee',
                            'development_fee': 'Development Fee'
                        }
                        lbl = field_labels.get(selected_fee_field, selected_fee_field)
                        assignment.discount_reason = f"Concession of ₹{student.fee_concession_amount} applied to {lbl}"
                        assignment.save()
                
                # Generate installments
                self._generate_installments(assignment)
                
                # Generate all invoices for the payment plan
                self._generate_all_invoices(assignment)
                
                successful += 1
                
            except Exception as e:
                failed += 1
                errors.append(f"Student {student.suid}: {str(e)}")
        
        # Update bulk record
        bulk_record.successful_assignments = successful
        bulk_record.failed_assignments = failed
        bulk_record.skipped_assignments = skipped
        bulk_record.status = 'COMPLETED'
        bulk_record.error_log = '\n'.join(errors)
        bulk_record.completed_at = timezone.now()
        bulk_record.save()
        
        return Response({
            'message': 'Bulk assignment completed',
            'total_students': bulk_record.total_students,
            'successful': successful,
            'failed': failed,
            'skipped': skipped,
            'bulk_assignment_id': str(bulk_record.id)
        })
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a fee assignment that requires approval"""
        assignment = self.get_object()
        assignment.approved_by = request.user
        assignment.approved_at = timezone.now()
        assignment.requires_approval = False
        assignment.save()
        return Response({'message': 'Fee assignment approved'})
    
    @action(detail=True, methods=['post'])
    def generate_invoice(self, request, pk=None):
        """Generate invoice for a specific installment"""
        assignment = self.get_object()
        if assignment.student.is_rte_student:
            return Response({'error': 'Cannot generate invoice for RTE student. Fees are reimbursed by the state.'}, status=400)
            
        installment_id = request.data.get('installment_id')
        
        if installment_id:
            installment = FeeInstallment.objects.get(id=installment_id)
        else:
            # Get next pending installment
            installment = assignment.installments.filter(
                status__in=['PENDING', 'OVERDUE']
            ).order_by('installment_number').first()
        
        if not installment:
            return Response({'error': 'No pending installments'}, status=400)
        
        # Check if an invoice already exists for this installment
        from apps.schools.models_settings import SchoolSettings
        school_settings = SchoolSettings.objects.filter(school=assignment.school).first()
        if school_settings and getattr(school_settings, 'prevent_duplicate_billing', True):
            if Invoice.objects.filter(installment=installment).exists():
                return Response({'error': 'An invoice already exists for this installment.'}, status=400)
        
        # Create invoice
        invoice = Invoice.objects.create(
            student=assignment.student,
            school=assignment.school,
            fee_assignment=assignment,
            installment=installment,
            academic_year=assignment.academic_year,
            total_amount=installment.amount_due,
            due_date=installment.due_date
        )
        
        return Response({
            'message': 'Invoice generated',
            'invoice_number': invoice.invoice_number,
            'invoice_id': str(invoice.id)
        })

    @action(detail=False, methods=['post'])
    def bulk_allocate_schedule(self, request):
        """
        Bulk allocate payment schedules (schedules) to multiple students.
        POST /api/v1/finance/assignments/bulk_allocate_schedule/
        """
        schedule_type = request.data.get('schedule_type')
        academic_year = request.data.get('academic_year')
        grade_id = request.data.get('grade_id')
        section_id = request.data.get('section_id')
        student_ids = request.data.get('student_ids', [])
        override_existing = request.data.get('override_existing', False)
        custom_installments = request.data.get('custom_installments', [])

        if not schedule_type or not academic_year:
            return Response({'error': 'schedule_type and academic_year are required'}, status=400)

        from apps.core.school_isolation import get_user_school
        from apps.schools.models import School
        school = getattr(request.user, 'school', None) or get_user_school(request.user)
        if not school:
            school_id = request.data.get('school') or request.query_params.get('school')
            if school_id:
                school = School.objects.filter(id=school_id).first()

        if not school:
            return Response({'error': 'School context missing'}, status=400)

        # Auto-create or fetch FeeSchedule
        schedule_defaults = {
            'YEARLY': {'name': 'Yearly Payment Plan', 'installments_per_year': 1},
            'MONTHLY': {'name': 'Monthly Payment Plan', 'installments_per_year': 12},
            'HALF_YEARLY': {'name': 'Semester Payment Plan', 'installments_per_year': 2},
            'QUARTERLY': {'name': 'Quarterly Payment Plan', 'installments_per_year': 4},
            'BI_MONTHLY': {'name': 'Bi-Monthly Payment Plan', 'installments_per_year': 6},
        }
        defaults = schedule_defaults.get(schedule_type, {'name': f'{schedule_type} Plan', 'installments_per_year': 1})
        
        fee_schedule, _ = FeeSchedule.objects.get_or_create(
            school=school,
            schedule_type=schedule_type,
            defaults={
                'name': defaults['name'],
                'installments_per_year': defaults['installments_per_year'],
                'is_active': True,
            }
        )

        students = Student.objects.filter(school=school, status__in=['ACTIVE', 'TEMPORARY'])
        if academic_year:
            students = students.filter(enrollments__academic_year=academic_year).distinct()
        if student_ids and 'ALL' not in student_ids:
            students = students.filter(id__in=student_ids)
        elif grade_id:
            students = students.filter(grade_config_id=grade_id)
        if section_id:
            students = students.filter(current_section_id=section_id)

        successful = 0
        skipped = 0

        for student in students:
            assignment = StudentFeeAssignment.objects.filter(
                student=student,
                academic_year=academic_year
            ).first()

            if assignment:
                if assignment.fee_schedule == fee_schedule and not custom_installments:
                    skipped += 1
                    continue
                if not override_existing:
                    skipped += 1
                    continue

                # Wipe existing ledger entries and invoices
                from apps.finance.models import FeeLedgerEntry, Invoice
                FeeLedgerEntry.objects.filter(
                    ledger__student=student,
                    ledger__academic_year=academic_year,
                    entry_type='CHARGE',
                    description__startswith='Annual Fee Assignment'
                ).delete()
                
                Invoice.objects.filter(
                    student=student,
                    academic_year=academic_year,
                    fee_assignment=assignment
                ).delete()

                # Apply concession if student has fee concession
                if student.fee_concession_applicable and student.fee_concession_amount > 0:
                    assignment.special_discount = student.fee_concession_amount
                    if not assignment.discount_reason:
                        assignment.discount_reason = f"Concession of ₹{student.fee_concession_amount} applied"

                # Update schedule & calculate net payable with concession
                assignment.fee_schedule = fee_schedule
                assignment.save()

                # Regenerate
                if custom_installments:
                    assignment.installments.all().delete()
                    student_net = assignment.net_payable
                    total_custom = sum(Decimal(str(inst.get('amount', 0))) for inst in custom_installments)

                    # Constraint: sum of installments cannot exceed net payable amount
                    if total_custom > student_net + Decimal('0.01'):
                        return Response({
                            'error': f"Total installments amount (₹{total_custom:.2f}) exceeds the net payable fee (₹{student_net:.2f}) for student {student.suid}."
                        }, status=400)

                    for i, inst in enumerate(custom_installments, 1):
                        amount = Decimal(str(inst.get('amount', 0)))
                        if amount < 0:
                            return Response({'error': f"Installment amount cannot be negative for student {student.suid}."}, status=400)

                        due_date_str = inst.get('due_date')
                        due_date = parse_date(due_date_str) if due_date_str else timezone.now().date()
                        FeeInstallment.objects.create(
                            fee_assignment=assignment,
                            installment_number=i,
                            installment_name=f"Installment {i}",
                            amount_due=amount,
                            due_date=due_date
                        )
                else:
                    self._generate_installments(assignment)
                    
                self._generate_all_invoices(assignment)
                successful += 1
            else:
                # If they don't have assignment, we need a structure. Let's find one for their grade
                from apps.finance.models import FeeStructure
                grade_id_to_use = grade_id or getattr(student.current_grade, 'id', None)
                fee_structure = FeeStructure.objects.filter(
                    school=school,
                    grade_id=grade_id_to_use,
                    academic_year=academic_year
                ).first()
                if not fee_structure:
                    fee_structure = FeeStructure.objects.filter(
                        school=school,
                        academic_year=academic_year
                    ).first()

                if fee_structure:
                    assignment = StudentFeeAssignment.objects.create(
                        student=student,
                        school=school,
                        fee_structure=fee_structure,
                        fee_schedule=fee_schedule,
                        academic_year=academic_year,
                        created_by=request.user
                    )

                    if student.fee_concession_applicable and student.fee_concession_amount > 0:
                        assignment.special_discount = student.fee_concession_amount
                        if not assignment.discount_reason:
                            assignment.discount_reason = f"Concession of ₹{student.fee_concession_amount} applied"
                        assignment.save()
                    
                    if custom_installments:
                        assignment.installments.all().delete()
                        student_net = assignment.net_payable
                        total_custom = sum(Decimal(str(inst.get('amount', 0))) for inst in custom_installments)

                        # Constraint: sum of installments cannot exceed net payable amount
                        if total_custom > student_net + Decimal('0.01'):
                            return Response({
                                'error': f"Total installments amount (₹{total_custom:.2f}) exceeds the net payable fee (₹{student_net:.2f}) for student {student.suid}."
                            }, status=400)

                        for i, inst in enumerate(custom_installments, 1):
                            amount = Decimal(str(inst.get('amount', 0)))
                            if amount < 0:
                                return Response({'error': f"Installment amount cannot be negative for student {student.suid}."}, status=400)

                            due_date_str = inst.get('due_date')
                            due_date = parse_date(due_date_str) if due_date_str else timezone.now().date()
                            FeeInstallment.objects.create(
                                fee_assignment=assignment,
                                installment_number=i,
                                installment_name=f"Installment {i}",
                                amount_due=amount,
                                due_date=due_date
                            )
                    else:
                        self._generate_installments(assignment)
                        
                    self._generate_all_invoices(assignment)
                    successful += 1
                else:
                    skipped += 1

        return Response({
            'message': 'Payment structures allocated successfully',
            'successful': successful,
            'skipped': skipped
        })

    @action(detail=False, methods=['post'])
    def record_reimbursement(self, request):
        """
        Record a state reimbursement for an RTE student.
        POST /api/v1/finance/assignments/record_reimbursement/
        """
        student_id = request.data.get('student_id')
        amount_raw = request.data.get('amount')
        date_received = request.data.get('date_received')
        mode = request.data.get('mode_of_payment', 'BANK_TRANSFER')
        transaction_id = request.data.get('transaction_id', '')

        if not student_id:
            return Response({'error': 'Student ID is required'}, status=400)
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)

        try:
            amount = Decimal(str(amount_raw))
        except:
            return Response({'error': 'Invalid amount'}, status=400)

        if amount <= 0:
            return Response({'error': 'Amount must be positive'}, status=400)

        from apps.finance.models import Transaction
        txn = Transaction.objects.create(
            student=student,
            school=student.school,
            amount=amount,
            payment_mode=mode,
            reference_number=transaction_id,
            transaction_date=date_received or timezone.now().date(),
            collected_by=request.user,
            notes="State Government RTE Fee Reimbursement"
        )

        return Response({
            'message': 'Reimbursement recorded successfully',
            'receipt_number': txn.receipt_number
        })


# ============================================================
# FEE INSTALLMENT VIEWSET
# ============================================================

class FeeInstallmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing fee installments
    """
    queryset = FeeInstallment.objects.all()
    serializer_class = FeeInstallmentSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'installment'
    
    def get_queryset(self):
        queryset = super().get_queryset().select_related('fee_assignment', 'fee_assignment__student')
        
        assignment_id = self.request.query_params.get('assignment')
        if assignment_id:
            queryset = queryset.filter(fee_assignment_id=assignment_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Get overdue installments
        overdue = self.request.query_params.get('overdue')
        if overdue and overdue.lower() == 'true':
            queryset = queryset.filter(
                status='PENDING',
                due_date__lt=timezone.now().date()
            )
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def check_overdue(self, request):
        """Update status of all overdue installments"""
        updated = FeeInstallment.objects.filter(
            status='PENDING',
            due_date__lt=timezone.now().date()
        ).update(status='OVERDUE')
        
        return Response({'message': f'{updated} installments marked as overdue'})


# ============================================================
# FEE HIKE CONFIG VIEWSET
# ============================================================

class FeeHikeConfigViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing annual fee hike configurations
    """
    queryset = FeeHikeConfig.objects.all()
    serializer_class = FeeHikeConfigSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'fee_hike'
    
    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def apply_hike(self, request, pk=None):
        """Apply the configured hike to all fee structures"""
        config = self.get_object()
        
        if config.is_applied:
            return Response({'error': 'This hike has already been applied'}, status=400)
        
        structures = FeeStructure.objects.filter(
            school=config.school,
            academic_year=config.from_academic_year
        )
        
        applied_count = 0
        for structure in structures:
            structure.apply_hike(config.hike_percentage)
            structure.academic_year = config.to_academic_year
            structure.save()
            applied_count += 1
        
        config.is_applied = True
        config.applied_at = timezone.now()
        config.applied_by = request.user
        config.save()
        
        return Response({
            'message': f'Hike applied to {applied_count} fee structures',
            'hike_percentage': str(config.hike_percentage)
        })


# ============================================================
# BULK FEE ASSIGNMENT VIEWSET
# ============================================================

class BulkFeeAssignmentViewSet(SchoolIsolationMixin, viewsets.ReadOnlyModelViewSet):
    school_field = 'school'
    """
    API for viewing bulk assignment history
    """
    queryset = BulkFeeAssignment.objects.all()
    serializer_class = BulkFeeAssignmentSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'bulk_assignment'
    
    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'target_grade', 'target_section', 'fee_structure', 'fee_schedule'
        )
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset


# ============================================================
# ORIGINAL VIEWSETS (UPDATED)
# ============================================================

class FeeCategoryViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    queryset = FeeCategory.objects.all()
    serializer_class = FeeCategorySerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'fee'
    rbac_action_permissions = {
        'list':           ['finance.manage_categories', 'finance.generate_invoice', 'finance.view_overview'],
        'retrieve':       ['finance.manage_categories', 'finance.generate_invoice', 'finance.view_overview'],
        'create':         'finance.manage_categories',
        'update':         'finance.manage_categories',
        'partial_update': 'finance.manage_categories',
        'destroy':        'finance.manage_categories',
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset

    def perform_create(self, serializer):
        school = getattr(self.request.user, 'school', None)
        serializer.save(school=school)


class InvoiceViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    queryset = Invoice.objects.all().order_by('-created_at')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, RBACPermission]

    def get_permissions(self):
        if self.action == 'student_invoices':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['student_invoices']:
            return
        super().check_permissions(request)

    
    rbac_module = 'finance'
    rbac_resource = 'invoice'
    rbac_action_permissions = {
        'list':                ['finance.view_invoice', 'finance.view_overview'],
        'retrieve':            ['finance.view_invoice', 'finance.view_overview'],
        'create':              'finance.generate_invoice',
        'destroy':             'finance.generate_invoice',
        'check_duplicate':     ['finance.generate_invoice', 'finance.view_overview'],
        'record_payment':      'finance.collect_fee',
        'export':              'finance.view_invoice',
        'apply_grade_late_fee': ['finance.change_invoice', 'finance.apply_late_fees'],
    }

    def perform_destroy(self, instance):
        ledger = instance.ledger
        installment = instance.installment
        instance.delete()
        if ledger:
            ledger.recalculate()
        if installment:
            paid_sum = sum(inv.paid_amount for inv in installment.invoices.all())
            installment.amount_paid = paid_sum
            if paid_sum >= installment.amount_due:
                installment.status = 'PAID'
            elif paid_sum > 0:
                installment.status = 'PARTIAL'
            else:
                installment.status = 'PENDING'
            installment.save()

    
    def get_queryset(self):
        queryset = super().get_queryset().select_related('student', 'student__user').prefetch_related('transactions')
        
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        return InvoiceSerializer

    def perform_create(self, serializer):
        student = serializer.validated_data.get('student')
        installment = serializer.validated_data.get('installment')
        
        school = serializer.validated_data.get('school')
        if not school and student:
            school = student.school
            
        fee_assignment = serializer.validated_data.get('fee_assignment')
        academic_year = serializer.validated_data.get('academic_year')
        
        if installment and not fee_assignment:
            fee_assignment = installment.fee_assignment
            
        if not academic_year and fee_assignment:
            academic_year = fee_assignment.academic_year
        elif not academic_year:
            from django.utils import timezone
            now = timezone.now()
            academic_year = f"{now.year-1}-{now.year}" if now.month < 6 else f"{now.year}-{now.year+1}"
            
        serializer.save(
            created_by=self.request.user,
            school=school,
            fee_assignment=fee_assignment,
            academic_year=academic_year
        )

    @action(detail=False, methods=['post'])
    def apply_grade_late_fee(self, request):
        """Apply late fee to all overdue invoices of a selected grade"""
        grade_id = request.data.get('grade_id')
        late_fee_amount = request.data.get('late_fee_amount')
        
        if not grade_id:
            return Response({'error': 'grade_id is required'}, status=400)
        if late_fee_amount is None:
            return Response({'error': 'late_fee_amount is required'}, status=400)
            
        try:
            from decimal import Decimal, InvalidOperation
            late_fee_amount = Decimal(str(late_fee_amount))
        except (ValueError, TypeError, InvalidOperation):
            return Response({'error': 'Invalid late_fee_amount'}, status=400)
            
        if late_fee_amount < 0:
            return Response({'error': 'late_fee_amount must be positive'}, status=400)
            
        today = timezone.now().date()
        overdue_invoices = Invoice.objects.filter(
            Q(student__grade_config_id=grade_id) | Q(student__current_section__grade_config_id=grade_id)
        ).filter(
            Q(status='OVERDUE') | Q(status__in=['UNPAID', 'PARTIAL'], due_date__lt=today)
        ).distinct()
        
        updated_count = 0
        for invoice in overdue_invoices:
            invoice.late_fee = late_fee_amount
            invoice.save()
            updated_count += 1
            
        return Response({
            'message': f'Applied late fee of INR {late_fee_amount} to {updated_count} invoices.',
            'updated_count': updated_count
        })

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """
        POST /api/v1/finance/invoices/{id}/record_payment/
        { "amount": 5000, "mode": "CASH", "reference": "..." }
        """
        invoice = self.get_object()
        amount_raw = request.data.get('amount', 0)
        try:
            amount = Decimal(str(amount_raw))
        except:
            return Response({'error': 'Invalid amount format'}, status=400)
        mode = request.data.get('mode', 'CASH')
        reference = request.data.get('reference', '')

        if amount <= 0:
            return Response({'error': 'Invalid amount'}, status=400)
        
        notes = request.data.get('notes', '')

        # Create Transaction
        txn = Transaction.objects.create(
            invoice=invoice,
            student=invoice.student,
            school=invoice.school,
            amount=amount,
            payment_mode=mode,
            reference_number=reference,
            collected_by=request.user,
            notes=notes
        )

        return Response({
            'message': 'Payment Recorded Successfully',
            'receipt_number': txn.receipt_number,
            'new_balance': str(invoice.balance_due)
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get finance dashboard statistics"""
        school_id = request.query_params.get('school')
        academic_year = request.query_params.get('academic_year', '2025-2026')
        
        queryset = Invoice.objects.all()
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        
        stats = queryset.aggregate(
            total_invoiced=Sum('total_amount'),
            total_collected=Sum('paid_amount'),
            total_pending=Sum('total_amount') - Sum('paid_amount')
        )
        
        status_counts = queryset.values('status').annotate(count=Count('id'))
        
        return Response({
            'total_invoiced': stats['total_invoiced'] or 0,
            'total_collected': stats['total_collected'] or 0,
            'total_pending': stats['total_pending'] or 0,
            'by_status': {item['status']: item['count'] for item in status_counts}
        })

    @action(detail=False, methods=['get'])
    def student_invoices(self, request):
        """
        Get all invoices generated by the school for the currently logged-in student.
        Calculates summary metrics: Total Fee Amount, Amount Paid, Pending Balance, Payment Coverage.
        """
        user = request.user
        from apps.students.models import Student
        from decimal import Decimal

        student = Student.objects.filter(user=user).first()
        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found for this user.'}, status=404)

        school = student.school or self.get_user_school()
        if not school:
            return Response({'error': 'School context not found for student.'}, status=400)

        # Fetch all invoices generated for this student
        invoices_qs = Invoice.objects.filter(
            student=student
        ).select_related(
            'student', 'school', 'fee_assignment', 'installment'
        ).prefetch_related('categories', 'items').order_by('-created_at', '-invoice_date')

        # Fallback: Also check invoices matching student.suid if needed
        if not invoices_qs.exists() and student.suid:
            invoices_qs = Invoice.objects.filter(
                student__suid=student.suid
            ).select_related(
                'student', 'school', 'fee_assignment', 'installment'
            ).prefetch_related('categories', 'items').order_by('-created_at', '-invoice_date')

        total_fee_amount = Decimal(0)
        amount_paid = Decimal(0)
        pending_balance = Decimal(0)

        for inv in invoices_qs:
            if inv.status == 'CANCELLED':
                continue
            inv_total = inv.total_amount or Decimal(0)
            inv_paid = inv.paid_amount or Decimal(0)

            total_fee_amount += inv_total
            amount_paid += inv_paid

            if inv.status != 'PAID' and inv_paid < inv_total:
                pending_balance += (inv_total - inv_paid)

        if total_fee_amount > Decimal(0):
            payment_coverage = round(float((amount_paid / total_fee_amount) * 100), 1)
        else:
            payment_coverage = 100.0


        invoice_list = []
        for inv in invoices_qs:
            cats = list(inv.categories.values_list('name', flat=True))
            category_str = ", ".join(cats) if cats else "Tuition & School Fees"

            desc = inv.description
            if not desc and inv.installment:
                desc = getattr(inv.installment, 'installment_name', None) or getattr(inv.installment, 'name', '') or 'Fee Installment'
            elif not desc and inv.fee_assignment:
                desc = f"Academic Year {inv.academic_year or 'Fee'}"
            elif not desc:
                desc = f"School Fee Invoice ({category_str})"


            status_val = inv.status
            if inv.paid_amount >= inv.total_amount and inv.total_amount > Decimal(0):
                status_val = 'PAID'

            invoice_list.append({
                'id': str(inv.id),
                'invoice_number': inv.invoice_number,
                'description': desc,
                'category': category_str,
                'subtotal': float(inv.subtotal or inv.total_amount),
                'discount_amount': float(inv.discount_amount or 0),
                'late_fee': float(inv.late_fee or 0),
                'total_amount': float(inv.total_amount),
                'paid_amount': float(inv.paid_amount),
                'pending_amount': float(max(Decimal(0), inv.total_amount - inv.paid_amount)),
                'invoice_date': str(inv.invoice_date),
                'due_date': str(inv.due_date) if inv.due_date else '',
                'paid_date': str(inv.paid_date) if inv.paid_date else None,
                'status': status_val,
                'status_display': inv.get_status_display() if hasattr(inv, 'get_status_display') else status_val,
                'is_paid': (status_val == 'PAID')
            })

        student_name = ""
        if student.user:
            student_name = student.user.get_full_name().strip()
        if not student_name:
            student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        if not student_name:
            student_name = getattr(student, 'full_name_display', '') or student.suid or 'Student'

        return Response({
            'student_name': student_name,
            'suid': student.suid,
            'school_name': school.display_name or school.legal_name,
            'total_fee_amount': float(total_fee_amount),
            'amount_paid': float(amount_paid),
            'pending_balance': float(pending_balance),
            'payment_coverage': payment_coverage,
            'invoices': invoice_list
        }, status=status.HTTP_200_OK)

    
    @action(detail=False, methods=['get', 'post'])
    def check_duplicate(self, request):
        """
        Check if an invoice already exists for a student/installment combination
        GET/POST /api/v1/finance/invoices/check_duplicate/
        """
        # Support both GET params and POST data
        if request.method == 'POST':
            student_id = request.data.get('student_id')
            installment_id = request.data.get('installment_id')
            categories = request.data.get('categories', [])
        else:
            student_id = request.query_params.get('student_id')
        
        return Response({'is_duplicate': False})

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export financial report (invoices) as CSV/JSON"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        format_type = request.query_params.get('format', 'csv').lower()
        
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date are required'}, status=400)
            
        invoices = Invoice.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        ).select_related('student', 'student__user').order_by('-created_at')
        
        if format_type == 'json':
            serializer = InvoiceListSerializer(invoices, many=True)
            return Response(serializer.data)
            
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="financial_report_{start_date}_to_{end_date}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Invoice No', 'Date', 'Student Name', 'SUID', 'Total Amount', 'Paid Amount', 'Balance', 'Status', 'Due Date'])
        
        for inv in invoices:
            writer.writerow([
                inv.invoice_number,
                inv.created_at.date(),
                inv.student.full_name_display if inv.student else 'N/A',
                inv.student.suid if inv.student else 'N/A',
                inv.total_amount,
                inv.paid_amount,
                inv.balance_due,
                inv.status,
                inv.due_date
            ])
            
        return response

    @action(detail=False, methods=['get', 'post'])
    def check_duplicate(self, request):
        """
        Check if an invoice already exists for a student/installment combination
        GET/POST /api/v1/finance/invoices/check_duplicate/
        """
        # Support both GET params and POST data
        if request.method == 'POST':
            student_id = request.data.get('student_id')
            installment_id = request.data.get('installment_id')
            categories = request.data.get('categories', [])
        else:
            student_id = request.query_params.get('student_id')
            installment_id = request.query_params.get('installment_id')
            categories = request.query_params.getlist('categories', [])
        
        if not student_id:
            return Response({'error': 'student_id is required'}, status=400)
        
        # Check for existing invoices
        filters = {'student_id': student_id}
        
        if installment_id:
            filters['installment_id'] = installment_id
        
        existing = Invoice.objects.filter(**filters).exclude(status='CANCELLED')
        
        if installment_id:
            # Specific installment check
            invoice = existing.first()
            has_duplicate = invoice is not None
            return Response({
                'has_duplicate': has_duplicate,
                'invoice_number': invoice.invoice_number if invoice else None,
                'invoice_status': invoice.status if invoice else None,
                'invoice_amount': str(invoice.total_amount) if invoice else None,
                'message': 'An invoice already exists for this installment' if has_duplicate else None
            })
        else:
            # Return all unpaid invoices for the student
            unpaid = existing.exclude(status='PAID')
            recent_unpaid = unpaid.first()
            return Response({
                'has_duplicate': unpaid.exists(),
                'unpaid_count': unpaid.count(),
                'invoice_number': recent_unpaid.invoice_number if recent_unpaid else None,
                'invoice_status': recent_unpaid.status if recent_unpaid else None,
                'invoice_amount': str(recent_unpaid.total_amount) if recent_unpaid else None,
                'message': f'Student has {unpaid.count()} unpaid invoices' if unpaid.exists() else None
            })


# ============================================================
# STUDENT FEE PROFILE API
# ============================================================

from rest_framework.views import APIView

class StudentFeeProfileView(APIView):
    """
    Get comprehensive fee profile for a student
    GET /api/v1/finance/student-fee-profile/{student_id}/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, student_id):
        try:
            student = Student.objects.select_related('user', 'grade_config', 'current_section', 'school').get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)
        
        # Get academic year from query params or determine current one
        academic_year = request.query_params.get('academic_year')
        if not academic_year:
            from apps.enrollments.models import AcademicYear
            active_year = AcademicYear.objects.filter(school=student.school, status='ACTIVE').first()
            if active_year:
                academic_year = active_year.year_code
            else:
                # Dynamic fallback
                now = timezone.now()
                # Most academic years start in April or June
                if now.month >= 4:
                    academic_year = f"{now.year}-{now.year + 1}"
                else:
                    academic_year = f"{now.year - 1}-{now.year}"
        
        # Get fee assignment for current year
        assignment = StudentFeeAssignment.objects.filter(
            student=student,
            academic_year=academic_year
        ).select_related('fee_structure', 'fee_schedule').prefetch_related('installments').first()
        
        # Get all invoices for this student
        invoices = Invoice.objects.filter(
            student=student
        ).order_by('-created_at')[:10]
        
        # Get payment history (transactions)
        transactions = Transaction.objects.filter(
            student=student
        ).order_by('-transaction_date')[:20]
        
        # Calculate summary from Ledger
        ledger = FeeLedger.objects.filter(student=student, academic_year=academic_year).first()
        
        total_fees = float(ledger.total_charges + ledger.total_fines) if ledger else 0
        total_paid = float(ledger.total_payments) if ledger else 0
        total_pending = total_fees - total_paid
        
        # Next due installment
        next_due_date = None
        next_due_amount = 0
        if assignment:
            next_installment = assignment.installments.filter(status__in=['UNPAID', 'PARTIAL']).order_by('due_date').first()
            if next_installment:
                next_due_date = next_installment.due_date.isoformat() if next_installment.due_date else None
                next_due_amount = float(next_installment.amount_due) - float(next_installment.amount_paid)
        
        # Build response
        response_data = {
            'student': {
                'id': str(student.id),
                'suid': student.suid,
                'full_name': student.user.full_name if student.user else "Unknown Student",
                'first_name': student.user.first_name if student.user else None,
                'last_name': student.user.last_name if student.user else None,
                'current_class': f"{student.current_grade.grade_name}-{student.current_section.section_letter}" if student.current_grade and student.current_section else None,
                'email': student.user.email if student.user else None,
                'photo': student.profile_photo.url if student.profile_photo else None,
                'is_rte_student': student.is_rte_student,
            },
            'current_assignment': {
                'id': str(assignment.id) if assignment else None,
                'academic_year_name': academic_year,
                'fee_schedule_name': assignment.fee_schedule.name if assignment else None,
                'schedule_type': assignment.fee_schedule.schedule_type if assignment else None,
                'total_annual_fee': str(assignment.total_annual_fee) if assignment else '0',
                'net_payable': str(assignment.net_payable) if assignment else '0',
                'total_paid': str(assignment.total_paid) if assignment else '0',
                'balance_due': str(assignment.balance_due) if assignment else '0',
                'status': assignment.status if assignment else None,
                'scholarship_percentage': str(assignment.scholarship_percentage) if assignment else '0',
                'sibling_discount': str(assignment.sibling_discount) if assignment else '0',
            } if assignment else None,
            'installments': [
                {
                    'id': inst.id,
                    'installment_number': inst.installment_number,
                    'installment_name': inst.installment_name,
                    'amount': str(inst.amount_due),
                    'paid_amount': str(inst.amount_paid),
                    'balance': str(float(inst.amount_due) - float(inst.amount_paid)),
                    'due_date': inst.due_date.isoformat() if inst.due_date else None,
                    'status': inst.status,
                }
                for inst in (assignment.installments.all().order_by('installment_number') if assignment else [])
            ],
            'recent_invoices': [
                {
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'total_amount': str(inv.total_amount),
                    'paid_amount': str(inv.paid_amount),
                    'balance_due': str(inv.balance_due),
                    'status': inv.status,
                    'due_date': inv.due_date.isoformat() if inv.due_date else None,
                    'created_at': inv.created_at.isoformat() if inv.created_at else None,
                }
                for inv in invoices
            ],
            'payment_history': [
                {
                    'id': tx.id,
                    'date': tx.transaction_date.isoformat() if tx.transaction_date else None,
                    'amount': str(tx.amount),
                    'mode': tx.payment_mode,
                    'reference': tx.reference_number or '',
                    'invoice_number': tx.invoice.invoice_number if tx.invoice else None,
                    'notes': tx.notes or '',
                }
                for tx in transactions
            ],
            'summary': {
                'total_fees': total_fees,
                'total_paid': total_paid,
                'total_pending': total_pending,
                'next_due_date': next_due_date,
                'next_due_amount': next_due_amount,
            },
        }
        
        return Response(response_data)


# ============================================================
# FEE LEDGER VIEWSET
# ============================================================

class FeeLedgerViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing student fee ledgers - single source of truth for finances
    """
    queryset = FeeLedger.objects.all()
    serializer_class = FeeLedgerSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'ledger'
    rbac_action_permissions = {
        'list':           'finance.view_ledger',
        'retrieve':       'finance.view_ledger',
        'create':         'finance.edit_ledger',
        'update':         'finance.edit_ledger',
        'partial_update': 'finance.edit_ledger',
        'destroy':        'finance.edit_ledger',
        'add_charge':     'finance.edit_ledger',
        'add_payment':    'finance.edit_ledger',
        'summary':        'finance.view_ledger',
    }

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'student', 'student__user', 'student__grade_config', 'school'
        ).prefetch_related('entries')
        
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        
        is_cleared = self.request.query_params.get('is_cleared')
        if is_cleared is not None:
            queryset = queryset.filter(is_cleared=is_cleared.lower() == 'true')
        
        return queryset.order_by('-academic_year', 'student__user__first_name')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FeeLedgerListSerializer
        return FeeLedgerSerializer
    
    @action(detail=True, methods=['post'])
    def add_charge(self, request, pk=None):
        """Add a fee charge to the ledger"""
        ledger = self.get_object()
        
        if ledger.is_closed:
            return Response({'error': 'Ledger is closed'}, status=400)
        
        amount = Decimal(request.data.get('amount', 0))
        description = request.data.get('description', '')
        category_id = request.data.get('fee_category')
        reference = request.data.get('reference_number', '')
        
        if amount <= 0:
            return Response({'error': 'Amount must be positive'}, status=400)
        
        entry = FeeLedgerEntry.objects.create(
            ledger=ledger,
            entry_type='CHARGE',
            date=timezone.now().date(),
            description=description,
            fee_category_id=category_id,
            reference_number=reference,
            amount=amount,
            created_by=request.user
        )
        
        # Update ledger totals
        ledger.total_charges += amount
        ledger.save()
        
        # Log audit
        self._log_audit(ledger, 'CHARGE_ADDED', amount, description)
        
        return Response({
            'message': 'Charge added successfully',
            'entry_id': str(entry.id),
            'new_balance': str(ledger.closing_balance)
        })
    
    @action(detail=True, methods=['post'])
    def add_payment(self, request, pk=None):
        """Record a payment to the ledger"""
        ledger = self.get_object()
        
        if ledger.is_closed:
            return Response({'error': 'Ledger is closed'}, status=400)
        
        amount = Decimal(request.data.get('amount', 0))
        payment_mode = request.data.get('payment_mode', 'CASH')
        reference = request.data.get('reference_number', '')
        description = request.data.get('description', f'Payment via {payment_mode}')
        
        if amount <= 0:
            return Response({'error': 'Amount must be positive'}, status=400)
        
        # Create transaction
        txn = Transaction.objects.create(
            student=ledger.student,
            school=ledger.school,
            amount=amount,
            payment_mode=payment_mode,
            reference_number=reference,
            transaction_date=timezone.now(),
            collected_by=request.user,
            status='COMPLETED',
            notes=description
        )
        
        entry = FeeLedgerEntry.objects.create(
            ledger=ledger,
            entry_type='PAYMENT',
            date=timezone.now().date(),
            description=description,
            reference_number=txn.receipt_number,
            amount=amount,
            transaction=txn,
            created_by=request.user
        )
        
        # Update ledger totals
        ledger.total_payments += amount
        ledger.save()
        
        # Log audit
        self._log_audit(ledger, 'PAYMENT_RECORDED', amount, f'Payment {txn.receipt_number}')
        
        return Response({
            'message': 'Payment recorded successfully',
            'receipt_number': txn.receipt_number,
            'entry_id': str(entry.id),
            'new_balance': str(ledger.closing_balance)
        })
    
    @action(detail=True, methods=['post'])
    def close_ledger(self, request, pk=None):
        """Close the ledger for an academic year"""
        ledger = self.get_object()
        
        if ledger.is_closed:
            return Response({'error': 'Ledger is already closed'}, status=400)
        
        ledger.is_closed = True
        ledger.closed_at = timezone.now()
        ledger.save()
        
        # Log audit
        self._log_audit(ledger, 'LEDGER_CLOSED', ledger.closing_balance, 
                        f'Closed for {ledger.academic_year}')
        
        return Response({
            'message': 'Ledger closed successfully',
            'closing_balance': str(ledger.closing_balance)
        })
    
    @action(detail=False, methods=['get'])
    def student_history(self, request):
        """Get complete fee history for a student across all years"""
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'student parameter is required'}, status=400)
        
        try:
            student = Student.objects.select_related('user', 'grade_config').get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)
        
        ledgers = FeeLedger.objects.filter(student=student).order_by('academic_year')
        for ledger in ledgers:
            ledger.recalculate()
        
        # Calculate lifetime totals
        totals = ledgers.aggregate(
            total_charges=Coalesce(Sum('total_charges'), Decimal('0')),
            total_payments=Coalesce(Sum('total_payments'), Decimal('0'))
        )
        
        history_data = {
            'student_id': str(student.id),
            'student_name': student.user.full_name if student.user else f"{student.first_name} {student.last_name}",
            'student_suid': student.suid,
            'current_grade': student.current_grade.grade_name if student.current_grade else None,
            'is_rte_student': student.is_rte_student,
            'ledgers': FeeLedgerSerializer(ledgers, many=True).data,
            'lifetime_total_charges': totals['total_charges'],
            'lifetime_total_payments': totals['total_payments'],
            'lifetime_balance': totals['total_charges'] - totals['total_payments']
        }
        
        return Response(history_data)
    
    @action(detail=False, methods=['post'])
    def create_or_get(self, request):
        """Get or create a ledger for a student/year combo"""
        student_id = request.data.get('student_id')
        school_id = request.data.get('school_id')
        academic_year = request.data.get('academic_year')
        
        if not all([student_id, school_id, academic_year]):
            return Response({'error': 'student_id, school_id, and academic_year are required'}, status=400)
        
        ledger, created = FeeLedger.objects.get_or_create(
            student_id=student_id,
            school_id=school_id,
            academic_year=academic_year,
            defaults={'opening_balance': Decimal('0')}
        )
        
        return Response({
            'ledger_id': str(ledger.id),
            'created': created,
            'current_balance': str(ledger.current_balance)
        })
    
    def _log_audit(self, ledger, action, amount, description):
        """Helper to create audit log entries"""
        FeeAuditLog.objects.create(
            school=ledger.school,
            student=ledger.student,
            action=action,
            model_name='FeeLedger',
            record_id=str(ledger.id),
            new_value=str(amount),
            description=description,
            performed_by=self.request.user if self.request.user.is_authenticated else None
        )


# ============================================================
# DISCOUNT RECORD VIEWSET
# ============================================================

class DiscountRecordViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing discounts and scholarships with approval workflow
    """
    queryset = DiscountRecord.objects.all()
    serializer_class = DiscountRecordSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'discount'
    
    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'student', 'student__user', 'school', 'fee_category',
            'created_by', 'approved_by'
        )
        
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        status_filter = self.request.query_params.get('approval_status')
        if status_filter:
            queryset = queryset.filter(approval_status=status_filter)
        
        discount_type = self.request.query_params.get('discount_type')
        if discount_type:
            queryset = queryset.filter(discount_type=discount_type)
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DiscountRecordListSerializer
        return DiscountRecordSerializer
    
    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        
        # Log audit
        FeeAuditLog.objects.create(
            school=instance.school,
            student=instance.student,
            action='DISCOUNT_ADDED',
            model_name='DiscountRecord',
            record_id=str(instance.id),
            new_value=str(instance.calculated_amount),
            description=f'{instance.discount_type} - {instance.name}',
            performed_by=self.request.user
        )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a discount request"""
        discount = self.get_object()
        
        if discount.approval_status != 'PENDING':
            return Response({'error': 'Discount is not pending approval'}, status=400)
        
        discount.approval_status = 'APPROVED'
        discount.approved_by = request.user
        discount.approved_at = timezone.now()
        discount.save()
        
        # Apply to ledger if exists
        ledger = FeeLedger.objects.filter(
            student=discount.student,
            school=discount.school,
            academic_year=discount.academic_year,
            is_closed=False
        ).first()
        
        if ledger:
            FeeLedgerEntry.objects.create(
                ledger=ledger,
                entry_type='DISCOUNT',
                date=timezone.now().date(),
                description=f'{discount.name} ({discount.get_discount_type_display()})',
                fee_category=discount.fee_category,
                amount=discount.calculated_amount,
                discount_record=discount,
                created_by=request.user
            )
            ledger.total_discounts += discount.calculated_amount
            ledger.save()
        
        # Log audit
        FeeAuditLog.objects.create(
            school=discount.school,
            student=discount.student,
            action='DISCOUNT_APPROVED',
            model_name='DiscountRecord',
            record_id=str(discount.id),
            new_value=str(discount.calculated_amount),
            description=f'Approved: {discount.name}',
            performed_by=request.user
        )
        
        return Response({
            'message': 'Discount approved successfully',
            'calculated_amount': str(discount.calculated_amount)
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a discount request"""
        discount = self.get_object()
        
        if discount.approval_status != 'PENDING':
            return Response({'error': 'Discount is not pending approval'}, status=400)
        
        reason = request.data.get('reason', '')
        
        discount.approval_status = 'REJECTED'
        discount.rejection_reason = reason
        discount.save()
        
        # Log audit
        FeeAuditLog.objects.create(
            school=discount.school,
            student=discount.student,
            action='DISCOUNT_REJECTED',
            model_name='DiscountRecord',
            record_id=str(discount.id),
            description=f'Rejected: {discount.name}. Reason: {reason}',
            performed_by=request.user
        )
        
        return Response({'message': 'Discount rejected'})
    
    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        """Get all pending discount approvals"""
        school_id = request.query_params.get('school')
        queryset = DiscountRecord.objects.filter(approval_status='PENDING')
        
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        serializer = DiscountRecordListSerializer(queryset, many=True)
        return Response(serializer.data)


# ============================================================
# LATE FEE RULE VIEWSET
# ============================================================

class LateFeeRuleViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    school_field = 'school'
    """
    API for managing late fee calculation rules
    """
    queryset = LateFeeRule.objects.all()
    serializer_class = LateFeeRuleSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'late_fee'
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('priority')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        """Calculate late fee for a given amount and days overdue"""
        rule = self.get_object()
        
        amount = Decimal(request.data.get('amount', 0))
        days_overdue = int(request.data.get('days_overdue', 0))
        
        if days_overdue <= rule.grace_period_days:
            return Response({'late_fee': '0', 'message': 'Within grace period'})
        
        effective_days = days_overdue - rule.grace_period_days
        late_fee = rule.calculate_late_fee(amount, effective_days)
        
        return Response({
            'late_fee': str(late_fee),
            'days_overdue': days_overdue,
            'effective_days': effective_days,
            'calculation_type': rule.calculation_type
        })
    
    @action(detail=False, methods=['post'])
    def apply_late_fees(self, request):
        """Apply late fees to all overdue invoices"""
        school_id = request.data.get('school_id')
        
        if not school_id:
            return Response({'error': 'school_id is required'}, status=400)
        
        # Get active late fee rule
        rule = LateFeeRule.objects.filter(
            school_id=school_id,
            is_active=True
        ).order_by('priority').first()
        
        if not rule:
            return Response({'error': 'No active late fee rule found'}, status=400)
        
        today = timezone.now().date()
        overdue_invoices = Invoice.objects.filter(
            school_id=school_id,
            status__in=['UNPAID', 'PARTIAL'],
            due_date__lt=today
        )
        
        applied_count = 0
        total_late_fee = Decimal('0')
        
        for invoice in overdue_invoices:
            days_overdue = (today - invoice.due_date).days
            
            if days_overdue <= rule.grace_period_days:
                continue
            
            effective_days = days_overdue - rule.grace_period_days
            late_fee = rule.calculate_late_fee(invoice.total_amount, effective_days)
            
            if late_fee > 0 and late_fee != invoice.late_fee:
                old_late_fee = invoice.late_fee
                invoice.late_fee = late_fee
                invoice.save()
                
                # Add to ledger if exists
                ledger = FeeLedger.objects.filter(
                    student=invoice.student,
                    school=invoice.school,
                    academic_year=invoice.academic_year,
                    is_closed=False
                ).first()
                
                if ledger and late_fee > old_late_fee:
                    additional_fee = late_fee - old_late_fee
                    FeeLedgerEntry.objects.create(
                        ledger=ledger,
                        entry_type='FINE',
                        date=today,
                        description=f'Late fee for Invoice {invoice.invoice_number}',
                        reference_number=invoice.invoice_number,
                        amount=additional_fee,
                        invoice=invoice,
                        created_by=request.user
                    )
                    ledger.total_fines += additional_fee
                    ledger.save()
                
                applied_count += 1
                total_late_fee += late_fee
        
        return Response({
            'message': f'Late fees applied to {applied_count} invoices',
            'total_late_fee': str(total_late_fee)
        })


# ============================================================
# FEE AUDIT LOG VIEWSET
# ============================================================

class FeeAuditLogViewSet(SchoolIsolationMixin, viewsets.ReadOnlyModelViewSet):
    school_field = 'school'
    """
    API for viewing fee audit logs (read-only)
    """
    queryset = FeeAuditLog.objects.all()
    serializer_class = FeeAuditLogSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'finance'
    rbac_resource = 'audit'
    
    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'school', 'student', 'student__user', 'performed_by'
        )
        
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        action_filter = self.request.query_params.get('action')
        if action_filter:
            queryset = queryset.filter(action=action_filter)
        
        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)
        
        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)
        
        return queryset.order_by('-created_at')


# ============================================================
# FINANCE DASHBOARD VIEW
# ============================================================

class FinanceDashboardView(APIView):
    """
    Comprehensive finance dashboard with key metrics
    GET /api/v1/finance/dashboard/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        school_id = request.query_params.get('school')
        academic_year = request.query_params.get('academic_year')
        
        if not school_id:
            return Response({'error': 'school parameter is required'}, status=400)
            
        if not academic_year:
            active_year = AcademicYear.objects.filter(school_id=school_id, status='ACTIVE').first()
            if active_year:
                academic_year = active_year.year_code
            else:
                # Fallback to current year based string if no active year found
                now = timezone.now()
                if now.month >= 6: # Assume academic year starts in June
                    academic_year = f"{now.year}-{now.year + 1}"
                else:
                    academic_year = f"{now.year - 1}-{now.year}"
        
        # Student count
        total_students = Student.objects.filter(
            school_id=school_id,
            status='ACTIVE'
        ).count()
        
        # Students assigned to fees
        students_assigned = StudentFeeAssignment.objects.filter(
            school_id=school_id,
            academic_year=academic_year
        ).count()
        
        # Fee totals from ledgers
        ledger_stats = FeeLedger.objects.filter(
            school_id=school_id,
            academic_year=academic_year
        ).aggregate(
            total_charges=Coalesce(Sum('total_charges'), Decimal('0')),
            total_payments=Coalesce(Sum('total_payments'), Decimal('0')),
            total_discounts=Coalesce(Sum('total_discounts'), Decimal('0')),
            total_fines=Coalesce(Sum('total_fines'), Decimal('0'))
        )
        
        total_fee_assigned = ledger_stats['total_charges']
        total_collected = ledger_stats['total_payments']
        total_discounts = ledger_stats['total_discounts']
        total_fines = ledger_stats['total_fines']
        
        # Outstanding = (Charges + Fines) - (Payments + Discounts)
        total_outstanding = total_fee_assigned + total_fines - total_collected - total_discounts
        
        collection_rate = Decimal('0')
        if total_fee_assigned > 0:
            collection_rate = (total_collected / total_fee_assigned) * 100
        
        # Invoice counts
        pending_invoices = Invoice.objects.filter(
            school_id=school_id,
            academic_year=academic_year,
            status__in=['UNPAID', 'PARTIAL']
        ).count()
        
        overdue_invoices = Invoice.objects.filter(
            school_id=school_id,
            academic_year=academic_year,
            status__in=['UNPAID', 'PARTIAL'],
            due_date__lt=timezone.now().date()
        ).count()
        
        # Pending discount approvals
        pending_discounts = DiscountRecord.objects.filter(
            school_id=school_id,
            status='PENDING'
        ).count()
        
        # Monthly collection (last 12 months)
        from django.db.models.functions import TruncMonth
        monthly_collection = Transaction.objects.filter(
            school_id=school_id,
            status='COMPLETED',
            transaction_date__gte=timezone.now() - timedelta(days=365)
        ).annotate(
            month=TruncMonth('transaction_date')
        ).values('month').annotate(
            total=Sum('amount')
        ).order_by('month')
        
        # Fees by category (Charges)
        fees_by_category = FeeLedgerEntry.objects.filter(
            ledger__school_id=school_id,
            ledger__academic_year=academic_year,
            entry_type='CHARGE'
        ).values(
            'fee_category__name'
        ).annotate(
            total=Sum('amount')
        ).exclude(
            fee_category__name__isnull=True
        ).order_by('-total')[:10]
        
        # Grade-wise collection
        grade_wise = FeeLedger.objects.filter(
            school_id=school_id,
            academic_year=academic_year
        ).values(
            'student__grade_config__grade_name'
        ).annotate(
            total_charges=Sum('total_charges'),
            total_payments=Sum('total_payments')
        ).order_by('student__grade_config__grade_order')
        
        return Response({
            'total_students': total_students,
            'students_assigned': students_assigned,
            'total_fee_assigned': str(total_fee_assigned),
            'total_collected': str(total_collected),
            'total_outstanding': str(total_outstanding),
            'collection_rate': str(round(collection_rate, 2)),
            'pending_invoices': pending_invoices,
            'overdue_invoices': overdue_invoices,
            'pending_discounts': pending_discounts,
            'monthly_collection': [
                {'month': item['month'].strftime('%Y-%m') if item['month'] else None, 
                 'total': str(item['total'] or 0)}
                for item in monthly_collection
            ],
            'collection_by_category': [
                {'category': item['fee_category__name'], 'total': str(item['total'] or 0)}
                for item in fees_by_category
            ],
            'grade_wise_collection': [
                {
                    'grade': item['student__grade_config__grade_name'],
                    'total_charges': str(item['total_charges'] or 0),
                    'total_payments': str(item['total_payments'] or 0)
                }
                for item in grade_wise
            ]
        })


class FinanceSummaryView(APIView):
    """
    Simple finance summary for dashboard widget
    GET /api/v1/finance/summary/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get school from user context
        school_id = request.query_params.get('school')
        if not school_id and hasattr(user, 'school_id') and user.school_id:
            school_id = user.school_id
        
        # Get current academic year
        academic_year = request.query_params.get('academic_year')
        if not academic_year:
            active_year = AcademicYear.objects.filter(school_id=school_id, status='ACTIVE').first()
            if active_year:
                academic_year = active_year.year_code
            else:
                now = timezone.now()
                if now.month >= 6:
                    academic_year = f"{now.year}-{now.year + 1}"
                else:
                    academic_year = f"{now.year - 1}-{now.year}"
        
        # Base invoice queryset
        invoice_qs = Invoice.objects.all()
        if school_id:
            invoice_qs = invoice_qs.filter(school_id=school_id)
        
        # Calculate totals
        totals = invoice_qs.aggregate(
            total=Coalesce(Sum('total_amount'), Decimal('0')),
            collected=Coalesce(Sum('paid_amount'), Decimal('0'))
        )
        
        total = totals['total']
        collected = totals['collected']
        pending = total - collected
        
        return Response({
            'total': float(total),
            'collected': float(collected),
            'pending': float(pending),
            'collection_rate': round((float(collected) / float(total) * 100), 1) if total > 0 else 0
        })


# ============================================================
# SALARY DEDUCTION VIEWSET
# ============================================================

class SalaryDeductionViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    CRUD API for staff salary deductions.
    Deductions are scoped per school and filtered by teacher/month.
    """
    school_field = 'school'
    from .models import SalaryDeduction
    from .serializers import SalaryDeductionSerializer
    queryset = SalaryDeduction.objects.all()
    serializer_class = None  # set in get_serializer_class
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'finance'
    rbac_resource = 'salary'
    rbac_action_permissions = {
        'list':           'finance.view_salary',
        'retrieve':       'finance.view_salary',
        'create':         'finance.edit_salary',
        'update':         'finance.edit_salary',
        'partial_update': 'finance.edit_salary',
        'destroy':        'finance.edit_salary',
    }

    def get_permissions(self):
        if self.action == 'my_salary':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['my_salary']:
            return
        super().check_permissions(request)

    @action(detail=False, methods=['get'])
    def my_salary(self, request):
        user = request.user
        from apps.teachers.models import Teacher
        from apps.accounts.permission_utils import get_teacher_for_user
        from .models import SalaryDeduction
        from .serializers import SalaryDeductionSerializer
        import datetime

        teacher = get_teacher_for_user(user)
        if not teacher:
            teacher = Teacher.objects.filter(user=user).first()
        if not teacher and hasattr(user, 'email') and user.email:
            teacher = Teacher.objects.filter(user__email__iexact=user.email).first()
        if not teacher and hasattr(user, 'username') and user.username:
            teacher = Teacher.objects.filter(tuid__iexact=user.username).first()

        if not teacher:
            teacher_id = request.query_params.get('teacher_id')
            if teacher_id:
                teacher = Teacher.objects.filter(id=teacher_id).first()

        if not teacher:
            return Response({'error': 'Teacher profile not found.'}, status=404)

        month = request.query_params.get('month')
        if not month:
            month = datetime.date.today().strftime('%Y-%m')

        base_salary = float(teacher.salary or 0.0)

        # All deduction history for this teacher
        all_deductions = SalaryDeduction.objects.filter(teacher=teacher).select_related('teacher__user', 'recorded_by').order_by('-created_at')

        # Filtered deductions for selected month
        month_deductions = [d for d in all_deductions if d.month == month]

        total_month_deduction = sum(float(d.amount or 0.0) for d in month_deductions)
        total_all_time_deduction = sum(float(d.amount or 0.0) for d in all_deductions)

        net_payable_salary = max(0.0, base_salary - total_month_deduction)

        all_serializer = SalaryDeductionSerializer(all_deductions, many=True)
        month_serializer = SalaryDeductionSerializer(month_deductions, many=True)

        teacher_name = ""
        if teacher.user:
            teacher_name = teacher.user.get_full_name().strip()
        if not teacher_name:
            teacher_name = getattr(teacher, 'full_name', '') or teacher.tuid or 'Teacher'

        return Response({
            'teacher_name': teacher_name,
            'tuid': teacher.tuid,
            'month': month,
            'base_salary': base_salary,
            'total_month_deduction': round(total_month_deduction, 2),
            'net_payable_salary': round(net_payable_salary, 2),
            'total_all_time_deduction': round(total_all_time_deduction, 2),
            'month_deductions': month_serializer.data,
            'deduction_history': all_serializer.data
        })

    def get_queryset(self):
        from .models import SalaryDeduction
        qs = SalaryDeduction.objects.all()
        school = getattr(self.request.user, 'school', None)
        if school:
            qs = qs.filter(school=school)
        teacher_id = self.request.query_params.get('teacher')
        month = self.request.query_params.get('month')
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        if month:
            qs = qs.filter(month=month)
        return qs.select_related('teacher__user', 'recorded_by')

    def get_serializer_class(self):
        from .serializers import SalaryDeductionSerializer
        return SalaryDeductionSerializer

    def perform_create(self, serializer):
        school = getattr(self.request.user, 'school', None)
        serializer.save(school=school, recorded_by=self.request.user)