from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.schools.models import School
from apps.schools.models_settings import SchoolSettings
from apps.students.models import Student
from apps.finance.models import FeeSchedule, FeeStructure, StudentFeeAssignment, FeeInstallment, Invoice
from apps.finance.serializers import InvoiceSerializer
from apps.finance.views import StudentFeeAssignmentViewSet
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory, force_authenticate
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class DuplicateBillingTestCase(TestCase):
    """Test case for preventing duplicate billing based on global settings."""

    def setUp(self):
        # Setup school and settings
        self.school = School.objects.create(legal_name='Test School', code='TEST-01')
        self.school_settings, _ = SchoolSettings.objects.get_or_create(school=self.school)
        
        # Setup student
        self.student_user = User.objects.create_user(
            email='student@test.com',
            password='test123'
        )
        self.student = Student.objects.create(
            user=self.student_user,
            school=self.school,
            suid='S12345'
        )
        
        # Setup fee structure and schedule
        self.fee_schedule = FeeSchedule.objects.create(
            school=self.school,
            name='Quarterly Schedule',
            schedule_type='QUARTERLY',
            installments_per_year=4
        )
        self.fee_structure = FeeStructure.objects.create(
            school=self.school,
            name='Grade 10 Fees',
            academic_year='2025-2026'
        )
        
        # Setup student fee assignment
        self.assignment = StudentFeeAssignment.objects.create(
            student=self.student,
            school=self.school,
            fee_structure=self.fee_structure,
            fee_schedule=self.fee_schedule,
            academic_year='2025-2026'
        )
        
        # Setup installment
        self.installment = FeeInstallment.objects.create(
            fee_assignment=self.assignment,
            installment_number=1,
            installment_name='Q1',
            amount_due=10000,
            due_date=timezone.now().date()
        )

        # Setup admin user
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            password='test123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )

    def test_prevent_duplicate_billing_serializer_validation(self):
        """Test that serializer validation blocks duplicate invoices if prevent_duplicate_billing is True."""
        self.school_settings.prevent_duplicate_billing = True
        self.school_settings.save()

        # Create first invoice
        Invoice.objects.create(
            student=self.student,
            school=self.school,
            fee_assignment=self.assignment,
            installment=self.installment,
            academic_year='2025-2026',
            total_amount=10000,
            due_date=timezone.now().date()
        )

        # Try to validate serializer for second invoice (duplicate)
        serializer = InvoiceSerializer(data={
            'student': self.student.id,
            'school': self.school.id,
            'fee_assignment': self.assignment.id,
            'installment': self.installment.id,
            'academic_year': '2025-2026',
            'total_amount': 10000,
            'due_date': timezone.now().date()
        })

        with self.assertRaises(ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        
        self.assertIn("An invoice already exists for this installment.", str(ctx.exception))

    def test_prevent_duplicate_billing_disabled_serializer(self):
        """Test that serializer validation allows duplicate invoices if prevent_duplicate_billing is False."""
        self.school_settings.prevent_duplicate_billing = False
        self.school_settings.save()

        # Create first invoice
        Invoice.objects.create(
            student=self.student,
            school=self.school,
            fee_assignment=self.assignment,
            installment=self.installment,
            academic_year='2025-2026',
            total_amount=10000,
            due_date=timezone.now().date()
        )

        # Try to validate serializer for second invoice (duplicate)
        serializer = InvoiceSerializer(data={
            'student': self.student.id,
            'school': self.school.id,
            'fee_assignment': self.assignment.id,
            'installment': self.installment.id,
            'academic_year': '2025-2026',
            'total_amount': 10000,
            'due_date': timezone.now().date()
        })

        self.assertTrue(serializer.is_valid())

    def test_generate_invoice_action_respects_duplicate_billing_enabled(self):
        """Test that the generate_invoice ViewSet action blocks duplicate invoices if enabled."""
        self.school_settings.prevent_duplicate_billing = True
        self.school_settings.save()

        # Create first invoice
        Invoice.objects.create(
            student=self.student,
            school=self.school,
            fee_assignment=self.assignment,
            installment=self.installment,
            academic_year='2025-2026',
            total_amount=10000,
            due_date=timezone.now().date()
        )

        # Call generate_invoice action
        factory = APIRequestFactory()
        request = factory.post(f'/api/v1/finance/fee-assignments/{self.assignment.id}/generate_invoice/', {
            'installment_id': self.installment.id
        })
        force_authenticate(request, user=self.admin_user)

        view = StudentFeeAssignmentViewSet.as_view({'post': 'generate_invoice'})
        response = view(request, pk=self.assignment.id)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'An invoice already exists for this installment.')

    def test_generate_invoice_action_respects_duplicate_billing_disabled(self):
        """Test that the generate_invoice ViewSet action allows duplicate invoices if disabled."""
        self.school_settings.prevent_duplicate_billing = False
        self.school_settings.save()

        # Create first invoice
        Invoice.objects.create(
            student=self.student,
            school=self.school,
            fee_assignment=self.assignment,
            installment=self.installment,
            academic_year='2025-2026',
            total_amount=10000,
            due_date=timezone.now().date()
        )

        # Call generate_invoice action
        factory = APIRequestFactory()
        request = factory.post(f'/api/v1/finance/fee-assignments/{self.assignment.id}/generate_invoice/', {
            'installment_id': self.installment.id
        })
        force_authenticate(request, user=self.admin_user)

        view = StudentFeeAssignmentViewSet.as_view({'post': 'generate_invoice'})
        response = view(request, pk=self.assignment.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Invoice generated')


from apps.schools.models_programs import GradeConfiguration
from apps.finance.views import InvoiceViewSet

class ApplyGradeLateFeeTestCase(TestCase):
    """Test case for applying grade-wide late fees to strictly overdue invoices."""

    def setUp(self):
        # Setup school
        self.school = School.objects.create(legal_name='Test School', code='TEST-01')
        
        # Setup academic program
        from apps.schools.models_programs import AcademicProgram
        self.program = AcademicProgram.objects.create(
            school=self.school,
            name='Primary Program',
            code='PRIM',
            board='CBSE'
        )
        
        # Setup grade configurations
        self.grade_10 = GradeConfiguration.objects.create(
            program=self.program,
            grade_name='Grade 10',
            grade_order=10
        )
        self.grade_11 = GradeConfiguration.objects.create(
            program=self.program,
            grade_name='Grade 11',
            grade_order=11
        )

        # Setup students
        self.student_1_user = User.objects.create_user(email='s1@test.com', password='pwd')
        self.student_1 = Student.objects.create(
            user=self.student_1_user,
            school=self.school,
            suid='S001',
            grade_config=self.grade_10
        )

        self.student_2_user = User.objects.create_user(email='s2@test.com', password='pwd')
        self.student_2 = Student.objects.create(
            user=self.student_2_user,
            school=self.school,
            suid='S002',
            grade_config=self.grade_10
        )

        self.student_other_user = User.objects.create_user(email='sother@test.com', password='pwd')
        self.student_other = Student.objects.create(
            user=self.student_other_user,
            school=self.school,
            suid='S003',
            grade_config=self.grade_11
        )

        # Setup admin user for requests
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            password='test123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )

        # Setup invoices for Grade 10 student 1 (Overdue and Unpaid/Partial)
        self.invoice_overdue = Invoice.objects.create(
            student=self.student_1,
            school=self.school,
            academic_year='2025-2026',
            total_amount=10000,
            subtotal=10000,
            due_date=timezone.now().date() - timedelta(days=5),
            status='OVERDUE'
        )
        
        self.invoice_unpaid = Invoice.objects.create(
            student=self.student_1,
            school=self.school,
            academic_year='2025-2026',
            total_amount=10000,
            subtotal=10000,
            due_date=timezone.now().date() + timedelta(days=5),
            status='UNPAID' # not strictly overdue status
        )

        # Setup invoice for Grade 10 student 2 (Overdue)
        self.invoice_overdue_2 = Invoice.objects.create(
            student=self.student_2,
            school=self.school,
            academic_year='2025-2026',
            total_amount=5000,
            subtotal=5000,
            due_date=timezone.now().date() - timedelta(days=2),
            status='OVERDUE'
        )

        # Setup invoice for Grade 11 student (Overdue, but different grade)
        self.invoice_other_grade = Invoice.objects.create(
            student=self.student_other,
            school=self.school,
            academic_year='2025-2026',
            total_amount=8000,
            subtotal=8000,
            due_date=timezone.now().date() - timedelta(days=3),
            status='OVERDUE'
        )

        from apps.finance.models import InvoiceItem
        InvoiceItem.objects.create(invoice=self.invoice_overdue, description='Fee', unit_price=10000)
        InvoiceItem.objects.create(invoice=self.invoice_unpaid, description='Fee', unit_price=10000)
        InvoiceItem.objects.create(invoice=self.invoice_overdue_2, description='Fee', unit_price=5000)
        InvoiceItem.objects.create(invoice=self.invoice_other_grade, description='Fee', unit_price=8000)

        # Trigger save to calculate total_amount properly in model save()
        self.invoice_overdue.save()
        self.invoice_unpaid.save()
        self.invoice_overdue_2.save()
        self.invoice_other_grade.save()

    def test_apply_grade_late_fee_success(self):
        """Test successfully applying late fee to strictly overdue invoices of selected grade."""
        factory = APIRequestFactory()
        request = factory.post('/api/v1/finance/invoices/apply_grade_late_fee/', {
            'grade_id': self.grade_10.id,
            'late_fee_amount': 500
        }, format='json')
        force_authenticate(request, user=self.admin_user)

        view = InvoiceViewSet.as_view({'post': 'apply_grade_late_fee'})
        response = view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['updated_count'], 2) # invoice_overdue and invoice_overdue_2
        
        # Verify invoice_overdue was updated
        self.invoice_overdue.refresh_from_db()
        self.assertEqual(self.invoice_overdue.late_fee, 500)
        # Verify subtotal-discount+late_fee recalculation (10000 + 500)
        self.assertEqual(self.invoice_overdue.total_amount, 10500)

        # Verify invoice_overdue_2 was updated
        self.invoice_overdue_2.refresh_from_db()
        self.assertEqual(self.invoice_overdue_2.late_fee, 500)
        self.assertEqual(self.invoice_overdue_2.total_amount, 5500)

        # Verify invoice_unpaid was NOT updated
        self.invoice_unpaid.refresh_from_db()
        self.assertEqual(self.invoice_unpaid.late_fee, 0)
        self.assertEqual(self.invoice_unpaid.total_amount, 10000)

        # Verify invoice_other_grade was NOT updated
        self.invoice_other_grade.refresh_from_db()
        self.assertEqual(self.invoice_other_grade.late_fee, 0)
        self.assertEqual(self.invoice_other_grade.total_amount, 8000)

    def test_apply_grade_late_fee_unpaid_db_status_and_section_grade(self):
        """Test applying late fee to past due invoices stored as UNPAID in DB and linked via section."""
        from apps.academics.models import Section
        section = Section.objects.create(
            school=self.school,
            grade_config=self.grade_10,
            section_letter='A'
        )
        student_sec = Student.objects.create(
            school=self.school,
            user=User.objects.create_user(email='sec_student@test.com', password='p', first_name='Sec', last_name='Student', user_type='STUDENT'),
            suid='SEC100',
            current_section=section
        )
        inv_sec = Invoice.objects.create(
            student=student_sec,
            school=self.school,
            academic_year='2025-2026',
            total_amount=4000,
            subtotal=4000,
            due_date=timezone.now().date() - timedelta(days=3),
            status='UNPAID'  # DB status still UNPAID
        )

        factory = APIRequestFactory()
        request = factory.post('/api/v1/finance/invoices/apply_grade_late_fee/', {
            'grade_id': self.grade_10.id,
            'late_fee_amount': 250
        }, format='json')
        force_authenticate(request, user=self.admin_user)

        view = InvoiceViewSet.as_view({'post': 'apply_grade_late_fee'})
        response = view(request)

        self.assertEqual(response.status_code, 200)
        # Should update invoice_overdue, invoice_overdue_2, and inv_sec (total 3)
        self.assertEqual(response.data['updated_count'], 3)

        inv_sec.refresh_from_db()
        self.assertEqual(inv_sec.late_fee, 250)
        self.assertEqual(inv_sec.status, 'OVERDUE') # Auto-updated to OVERDUE on save!

    def test_apply_grade_late_fee_validation(self):
        """Test input validation for applying grade-wide late fees."""
        factory = APIRequestFactory()
        
        # Missing grade_id
        request = factory.post('/api/v1/finance/invoices/apply_grade_late_fee/', {
            'late_fee_amount': 500
        }, format='json')
        force_authenticate(request, user=self.admin_user)
        view = InvoiceViewSet.as_view({'post': 'apply_grade_late_fee'})
        response = view(request)
        self.assertEqual(response.status_code, 400)
        self.assertIn('grade_id is required', response.data['error'])

        # Negative amount
        request = factory.post('/api/v1/finance/invoices/apply_grade_late_fee/', {
            'grade_id': self.grade_10.id,
            'late_fee_amount': -100
        }, format='json')
        force_authenticate(request, user=self.admin_user)
        response = view(request)
        self.assertEqual(response.status_code, 400)
        self.assertIn('must be positive', response.data['error'])

    def test_record_payment_with_existing_late_fee_and_notes(self):
        """Test recording payment when invoice has both CHARGE and FINE ledger entries (prevent MultipleObjectsReturned)."""
        from decimal import Decimal
        # Apply late fee first so invoice has FINE entry alongside CHARGE entry
        self.invoice_overdue.late_fee = Decimal('500')
        self.invoice_overdue.save()

        # Now record payment on invoice_overdue
        factory = APIRequestFactory()
        request = factory.post(f'/api/v1/finance/invoices/{self.invoice_overdue.id}/record_payment/', {
            'amount': 11000,
            'mode': 'CASH',
            'reference': 'REF-EXTRA-1',
            'notes': 'Record of extra amount collected:\n- Particulars: ID Card Fee, Amount: ₹500'
        }, format='json')
        force_authenticate(request, user=self.admin_user)

        view = InvoiceViewSet.as_view({'post': 'record_payment'})
        response = view(request, pk=str(self.invoice_overdue.id))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Payment Recorded Successfully')



from unittest.mock import patch
from django.core.management import call_command
from apps.students.models import Guardian

class PaymentRemindersCommandTestCase(TestCase):
    """Test case for sending automated payment reminders via check_invoices command."""

    def setUp(self):
        self.school = School.objects.create(legal_name='Test School', code='TEST-01')
        self.school_settings, _ = SchoolSettings.objects.get_or_create(school=self.school)
        self.school_settings.send_payment_reminders = True
        self.school_settings.email_notifications = True
        self.school_settings.sms_notifications = True
        self.school_settings.save()

        # Student & User setup
        self.student_user = User.objects.create_user(email='s1@test.com', password='pwd')
        self.student = Student.objects.create(
            user=self.student_user,
            school=self.school,
            suid='S001'
        )

        # Guardian setup
        self.guardian = Guardian.objects.create(
            student=self.student,
            name='Parent Name',
            relationship='FATHER',
            phone='9876543210',
            email='parent@test.com',
            is_primary=True
        )

        # 1. Invoice due in exactly 7 days (Upcoming)
        self.invoice_upcoming = Invoice.objects.create(
            student=self.student,
            school=self.school,
            academic_year='2025-2026',
            total_amount=10000,
            due_date=timezone.now().date() + timedelta(days=7),
            status='UNPAID'
        )

        # 2. Invoice overdue by exactly 7 days (Overdue)
        self.invoice_overdue_7 = Invoice.objects.create(
            student=self.student,
            school=self.school,
            academic_year='2025-2026',
            total_amount=5000,
            due_date=timezone.now().date() - timedelta(days=7),
            status='OVERDUE'
        )

        # 3. Invoice overdue by 3 days (Overdue, but not a week)
        self.invoice_overdue_3 = Invoice.objects.create(
            student=self.student,
            school=self.school,
            academic_year='2025-2026',
            total_amount=8000,
            due_date=timezone.now().date() - timedelta(days=3),
            status='OVERDUE'
        )

        # 4. Invoice due in 5 days (Upcoming, but not 7 days)
        self.invoice_upcoming_5 = Invoice.objects.create(
            student=self.student,
            school=self.school,
            academic_year='2025-2026',
            total_amount=6000,
            due_date=timezone.now().date() + timedelta(days=5),
            status='UNPAID'
        )

    @patch('apps.notifications.services.ChannelService.send_email')
    @patch('apps.notifications.services.ChannelService.send_sms')
    def test_payment_reminders_sent(self, mock_send_sms, mock_send_email):
        """Test that correct reminders are dispatched based on due date and status."""
        mock_send_email.return_value = True
        mock_send_sms.return_value = True

        call_command('check_invoices')

        # Since both email and SMS notifications are True, priority is email.
        # Expecting email to be called and SMS to not be called.
        self.assertEqual(mock_send_email.call_count, 2) # 1 for upcoming (due in 7 days) and 1 for overdue (7 days past due)
        self.assertEqual(mock_send_sms.call_count, 0)

        # Verify email recipients
        calls = mock_send_email.call_args_list
        emails_sent_to = [c.kwargs['email'] for c in calls]
        self.assertIn('parent@test.com', emails_sent_to)

    @patch('apps.notifications.services.ChannelService.send_email')
    @patch('apps.notifications.services.ChannelService.send_sms')
    def test_payment_reminders_sms_only(self, mock_send_sms, mock_send_email):
        """Test SMS reminders are sent when only SMS notifications are enabled."""
        mock_send_email.return_value = True
        mock_send_sms.return_value = True

        self.school_settings.email_notifications = False
        self.school_settings.sms_notifications = True
        self.school_settings.save()

        call_command('check_invoices')

        self.assertEqual(mock_send_email.call_count, 0)
        self.assertEqual(mock_send_sms.call_count, 2)


class FinanceReportExportTestCase(TestCase):
    """Test case for exporting financial reports with fee breakdowns."""

    def setUp(self):
        self.school = School.objects.create(legal_name='Test School', code='TEST-01')
        self.school_settings, _ = SchoolSettings.objects.get_or_create(school=self.school)
        self.school_settings.show_fee_breakdown_on_invoice = True
        self.school_settings.save()

        # Admin user to bypass authentication
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            password='test123',
            user_type='SCHOOL_ADMIN',
            school=self.school
        )

        # Student & Invoice setup
        self.student_user = User.objects.create_user(email='s1@test.com', password='pwd')
        self.student = Student.objects.create(
            user=self.student_user,
            school=self.school,
            suid='S001'
        )

        self.invoice = Invoice.objects.create(
            student=self.student,
            school=self.school,
            academic_year='2025-2026',
            total_amount=15000,
            subtotal=15000,
            due_date=timezone.now().date(),
            status='UNPAID'
        )

        from apps.finance.models import InvoiceItem
        self.item_tuition = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Tuition Fee',
            unit_price=10000
        )
        self.item_lab = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Lab Fee',
            unit_price=5000
        )
        self.invoice.save()

    def test_export_finance_with_breakdown_json(self):
        """Test JSON export contains itemized breakdown when setting is True."""
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.admin_user)

        # Request report
        from django.test import Client
        client = Client()
        
        today_str = timezone.now().date().isoformat()
        response = client.get(
            '/api/v1/reports/finance/',
            {'start_date': today_str, 'end_date': today_str, 'format': 'json'},
            HTTP_AUTHORIZATION=f'Bearer {token}'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertIn('fee_breakdown', data[0])
        self.assertIn('Tuition Fee: Rs.10000.00', data[0]['fee_breakdown'])
        self.assertIn('Lab Fee: Rs.5000.00', data[0]['fee_breakdown'])

    def test_export_finance_without_breakdown_json(self):
        """Test JSON export does not contain breakdown when setting is False."""
        self.school_settings.show_fee_breakdown_on_invoice = False
        self.school_settings.save()

        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.admin_user)

        from django.test import Client
        client = Client()
        
        today_str = timezone.now().date().isoformat()
        response = client.get(
            '/api/v1/reports/finance/',
            {'start_date': today_str, 'end_date': today_str, 'format': 'json'},
            HTTP_AUTHORIZATION=f'Bearer {token}'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertNotIn('fee_breakdown', data[0])

    def test_export_finance_with_categories_json(self):
        """Test JSON export contains categories when items and assignment are missing."""
        self.invoice.items.all().delete()
        
        from apps.finance.models import FeeCategory
        cat1 = FeeCategory.objects.create(school=self.school, name='Field Trip', amount=100)
        cat2 = FeeCategory.objects.create(school=self.school, name='Picnic', amount=1200)
        self.invoice.categories.add(cat1, cat2)
        
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.admin_user)

        from django.test import Client
        client = Client()
        
        today_str = timezone.now().date().isoformat()
        response = client.get(
            '/api/v1/reports/finance/',
            {'start_date': today_str, 'end_date': today_str, 'format': 'json'},
            HTTP_AUTHORIZATION=f'Bearer {token}'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertIn('fee_breakdown', data[0])
        self.assertIn('Field Trip: Rs.100.00', data[0]['fee_breakdown'])
        self.assertIn('Picnic: Rs.1200.00', data[0]['fee_breakdown'])


class RoleUserPaymentLedgerTestCase(TestCase):
    def setUp(self):
        from django.core.management import call_command
        call_command('sync_permissions')
        
        self.school = School.objects.create(legal_name='Role Test School', code='ROLE-TEST')
        
        # Setup student
        self.student_user = User.objects.create_user(
            email='student_role@test.com',
            password='test123'
        )
        self.student = Student.objects.create(
            user=self.student_user,
            school=self.school,
            suid='S98765'
        )
        
        # Setup role user
        self.role_user = User.objects.create_user(
            email='role_user@test.com',
            password='test123',
            user_type='ROLE',
            school=self.school
        )
        
        # Setup role
        from apps.accounts.rbac_models import Role, UserRole, Permission
        self.role = Role.objects.create(
            school=self.school,
            name='Accountant',
            role_type='ACCOUNTANT',
            associated_user=self.role_user
        )
        
        # Assign collect_fee and view_invoice permissions to role
        collect_perm = Permission.objects.get(codename='finance.collect_fee')
        view_perm = Permission.objects.get(codename='finance.view_invoice')
        self.role.permissions.add(collect_perm, view_perm)
        
        UserRole.objects.create(
            user=self.role_user,
            role=self.role,
            school=self.school,
            is_active=True,
            is_primary=True
        )

        # Setup ad-hoc invoice
        self.invoice = Invoice.objects.create(
            student=self.student,
            school=self.school,
            total_amount=1500,
            academic_year='2026-2027',
            due_date=timezone.now().date() + timedelta(days=30)
        )

    def test_role_user_collects_payment_syncs_ledger(self):
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.role_user)
        
        from django.test import Client
        client = Client()
        
        # Before recording payment, ledger should be updated with invoice charge
        from apps.finance.models import FeeLedger, FeeLedgerEntry, Transaction
        ledger = FeeLedger.objects.filter(student=self.student, academic_year='2026-2027').first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.total_charges, 1500)
        self.assertEqual(ledger.total_payments, 0)
        self.assertEqual(ledger.current_balance, 1500)
        
        # Record payment against invoice
        response = client.post(
            f'/api/v1/finance/invoices/{self.invoice.id}/record_payment/',
            {'amount': 1500, 'mode': 'CASH', 'reference': 'REF123'},
            HTTP_AUTHORIZATION=f'Bearer {token}',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        # Verify ledger updated
        ledger.refresh_from_db()
        self.assertEqual(ledger.total_charges, 1500)
        self.assertEqual(ledger.total_payments, 1500)
        self.assertEqual(ledger.current_balance, 0)
        
        # Verify ledger entry PAYMENT was created
        payment_entry = FeeLedgerEntry.objects.filter(ledger=ledger, entry_type='PAYMENT').first()
        self.assertIsNotNone(payment_entry)
        self.assertEqual(payment_entry.amount, 1500)
        self.assertEqual(payment_entry.created_by, self.role_user)

    def test_role_user_records_reimbursement(self):
        from apps.accounts.rbac_models import Permission
        view_ledger_perm = Permission.objects.get(codename='finance.view_ledger')
        edit_ledger_perm = Permission.objects.get(codename='finance.edit_ledger')
        self.role.permissions.add(view_ledger_perm, edit_ledger_perm)
        
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.role_user)
        
        from django.test import Client
        client = Client()
        
        # Call record_reimbursement
        response = client.post(
            '/api/v1/finance/assignments/record_reimbursement/',
            {
                'student_id': str(self.student.id),
                'amount': 500,
                'date_received': timezone.now().date().isoformat(),
                'mode_of_payment': 'BANK_TRANSFER',
                'transaction_id': 'TXN_RTE_123'
            },
            HTTP_AUTHORIZATION=f'Bearer {token}',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

    def test_ledger_recalculate_computes_running_balance_after(self):
        """Test that FeeLedger.recalculate computes chronological balance_after values for all entries."""
        from apps.finance.models import FeeLedger, FeeLedgerEntry
        from datetime import date
        from decimal import Decimal
        
        ledger, _ = FeeLedger.objects.get_or_create(
            student=self.student,
            school=self.school,
            academic_year='2026-2027',
            defaults={'opening_balance': Decimal('0')}
        )

        # Clear existing entries for predictable test
        FeeLedgerEntry.objects.filter(ledger=ledger).delete()

        # Create entries out of chronological order
        e1 = FeeLedgerEntry.objects.create(
            ledger=ledger, entry_type='CHARGE', date=date(2026, 4, 1), description='Tuition Fee', amount=Decimal('10000')
        )
        e2 = FeeLedgerEntry.objects.create(
            ledger=ledger, entry_type='PAYMENT', date=date(2026, 4, 10), description='Payment 1', amount=Decimal('4000')
        )
        e3 = FeeLedgerEntry.objects.create(
            ledger=ledger, entry_type='FINE', date=date(2026, 5, 1), description='Late Fee', amount=Decimal('500')
        )
        e4 = FeeLedgerEntry.objects.create(
            ledger=ledger, entry_type='PAYMENT', date=date(2026, 5, 15), description='Payment 2', amount=Decimal('6500')
        )

        ledger.recalculate()

        e1.refresh_from_db()
        e2.refresh_from_db()
        e3.refresh_from_db()
        e4.refresh_from_db()

        self.assertEqual(e1.balance_after, Decimal('10000.00'))
        self.assertEqual(e2.balance_after, Decimal('6000.00'))
        self.assertEqual(e3.balance_after, Decimal('6500.00'))
        self.assertEqual(e4.balance_after, Decimal('0.00'))




