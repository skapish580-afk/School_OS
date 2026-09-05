from rest_framework import viewsets, serializers
from rest_framework.decorators import action
import datetime
from .models import Book, IssueReturnLog, LibraryClearance, StockAudit, LibraryVisitorLog, LibraryPolicy
from .serializers import (
    BookSerializer, IssueReturnLogSerializer, LibraryClearanceSerializer, 
    StockAuditSerializer, LibraryVisitorLogSerializer, LibraryPolicySerializer
)
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permission_utils import RBACPermission
from apps.core.school_isolation import SchoolIsolationMixin


class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'library'
    rbac_resource = 'books'
    rbac_action_permissions = {
        'list': ['library.view_library', 'library.edit_books', 'library.view_books', 'library.manage_books'],
        'retrieve': ['library.view_library', 'library.edit_books', 'library.view_books', 'library.manage_books'],
        'create': ['library.edit_books', 'library.manage_books'],
        'update': ['library.edit_books', 'library.manage_books'],
        'partial_update': ['library.edit_books', 'library.manage_books'],
        'destroy': ['library.edit_books', 'library.manage_books'],
    }

    def get_queryset(self):
        return Book.objects.filter(school=self.request.user.school)

    def perform_create(self, serializer):
        total_copies = serializer.validated_data.get('total_copies', 1)
        serializer.save(
            school=self.request.user.school,
            available_copies=total_copies
        )

    def perform_update(self, serializer):
        old_instance = self.get_object()
        new_total = serializer.validated_data.get('total_copies', old_instance.total_copies)
        diff = new_total - old_instance.total_copies
        
        instance = serializer.save()
        
        if diff != 0:
            instance.available_copies = max(0, instance.available_copies + diff)
            instance.save(update_fields=['available_copies'])

from django.db import transaction
from rest_framework.response import Response
from rest_framework import status

class IssueReturnLogViewSet(viewsets.ModelViewSet):
    queryset = IssueReturnLog.objects.all()
    serializer_class = IssueReturnLogSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'library'
    rbac_resource = 'transactions'
    rbac_action_permissions = {
        'list': ['library.view_circulation_log', 'library.edit_circulation_log', 'library.view_fines_log', 'library.edit_fines_log', 'library.view_transactions', 'library.issue_book'],
        'retrieve': ['library.view_circulation_log', 'library.edit_circulation_log', 'library.view_fines_log', 'library.edit_fines_log', 'library.view_transactions', 'library.issue_book'],
        'create': ['library.edit_circulation_log', 'library.issue_book'],
        'update': ['library.edit_circulation_log', 'library.edit_fines_log', 'library.issue_book'],
        'partial_update': ['library.edit_circulation_log', 'library.edit_fines_log', 'library.issue_book'],
        'destroy': ['library.edit_circulation_log', 'library.issue_book'],
    }

    def get_permissions(self):
        if self.action in ['student_library', 'teacher_library']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['student_library', 'teacher_library']:
            return
        super().check_permissions(request)

    @action(detail=False, methods=['get'])
    def teacher_library(self, request):
        user = request.user
        from apps.teachers.models import Teacher
        from apps.library.models import IssueReturnLog, LibraryVisitorLog, LibraryPolicy
        from apps.accounts.permission_utils import get_teacher_for_user
        from django.db.models import Q
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

        # 1. Borrowed Books & Fines (IssueReturnLogs)
        query = Q(teacher=teacher)
        if teacher.tuid:
            query |= Q(teacher__tuid__iexact=teacher.tuid)

        issues_qs = IssueReturnLog.objects.filter(query).select_related('book', 'book__school').order_by('-issue_date')

        policy_map = {}
        for pol in LibraryPolicy.objects.all():
            policy_map[pol.school_id] = pol

        borrowed_books = []
        fines_list = []
        total_fines = 0.0

        for log in issues_qs:
            book = log.book
            record_fine = float(log.fine_amount or 0.0)
            
            calc_fine = 0.0
            fine_reasons = []
            
            if book and book.school_id in policy_map:
                policy = policy_map[book.school_id]
                cond = log.return_condition or (log.status if log.status == 'LOST' else None)
                if cond == 'LOST':
                    calc_fine += float(policy.lost_book_fine)
                    fine_reasons.append("Lost Book Fine")
                elif cond == 'DAMAGED':
                    calc_fine += float(policy.damaged_book_fine)
                    fine_reasons.append("Damaged Book Fine")
                elif cond == 'WORN':
                    calc_fine += float(policy.worn_book_fine)
                    fine_reasons.append("Worn Book Fine")
                
                ref_date = log.return_date or datetime.date.today()
                if log.due_date and ref_date > log.due_date:
                    days_late = (ref_date - log.due_date).days
                    overdue_fee = float(policy.per_day_late_fee) * days_late
                    calc_fine += overdue_fee
                    fine_reasons.append(f"Overdue ({days_late} days late)")

            final_fine = round(max(record_fine, calc_fine), 2)
            
            borrowed_books.append({
                'id': str(log.id),
                'book_title': book.title if book else 'Unknown Book',
                'author': book.author if book else '-',
                'isbn': book.isbn if (book and book.isbn) else '-',
                'accession_number': book.accession_number if book else '-',
                'category': book.category if (book and book.category) else 'General',
                'issue_date': str(log.issue_date),
                'due_date': str(log.due_date),
                'return_date': str(log.return_date) if log.return_date else None,
                'status': log.status,
                'return_condition': log.return_condition,
                'fine_amount': final_fine,
                'fine_collected': log.fine_collected
            })

            if final_fine > 0:
                total_fines += final_fine
                reason_str = ", ".join(fine_reasons) if fine_reasons else f"Library Fine ({log.return_condition or 'Penalty'})"
                fines_list.append({
                    'id': str(log.id),
                    'book_title': book.title if book else 'Library Book',
                    'fine_amount': final_fine,
                    'fine_collected': log.fine_collected,
                    'status': 'Paid' if log.fine_collected else 'Unpaid / Outstanding',
                    'reason': reason_str,
                    'date': str(log.return_date or log.due_date)
                })

        # 2. Visitor Logs
        visitor_qs = LibraryVisitorLog.objects.filter(
            Q(teacher=teacher) | (Q(teacher__tuid__iexact=teacher.tuid) if teacher.tuid else Q())
        ).order_by('-date', '-entry_time').distinct()

        visitor_logs = []
        for vl in visitor_qs:
            visitor_logs.append({
                'id': str(vl.id),
                'date': str(vl.date),
                'entry_time': str(vl.entry_time),
                'exit_time': str(vl.exit_time) if vl.exit_time else None,
                'purpose': vl.purpose
            })

        teacher_name = ""
        if teacher.user:
            teacher_name = teacher.user.get_full_name().strip()
        if not teacher_name:
            teacher_name = getattr(teacher, 'full_name', '') or teacher.tuid or 'Teacher'

        has_unpaid_fines = any(not f['fine_collected'] for f in fines_list)
        has_issued_books = any(b['status'] == 'ISSUED' for b in borrowed_books)
        is_cleared = not (has_unpaid_fines or has_issued_books)

        return Response({
            'teacher_name': teacher_name,
            'tuid': teacher.tuid,
            'cleared': is_cleared,
            'clearance_remarks': 'Clearance Hold: Overdue books or unpaid fines' if not is_cleared else 'No clearance holds',
            'borrowed_books': borrowed_books,
            'visitor_logs': visitor_logs,
            'fines': fines_list,
            'total_fines': total_fines
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def student_library(self, request):
        user = request.user
        from apps.students.models import Student
        from apps.library.models import IssueReturnLog, LibraryVisitorLog, LibraryClearance, LibraryPolicy
        from django.db.models import Q
        import datetime

        student = Student.objects.filter(user=user).first()
        if not student and hasattr(user, 'email') and user.email:
            student = Student.objects.filter(user__email__iexact=user.email).first()
        if not student and hasattr(user, 'username') and user.username:
            student = Student.objects.filter(suid__iexact=user.username).first()
        if not student and hasattr(user, 'suid') and user.suid:
            student = Student.objects.filter(suid__iexact=user.suid).first()

        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        # 1. Borrowed Books & Fines (IssueReturnLogs)
        query = Q(student=student)
        if student.suid:
            query |= Q(student__suid__iexact=student.suid)

        issues_qs = IssueReturnLog.objects.filter(query).select_related('book', 'book__school').order_by('-issue_date')

        policy_map = {}
        for pol in LibraryPolicy.objects.all():
            policy_map[pol.school_id] = pol

        borrowed_books = []
        fines_list = []
        total_fines = 0.0

        for log in issues_qs:
            book = log.book
            record_fine = float(log.fine_amount or 0.0)
            
            calc_fine = 0.0
            fine_reasons = []
            
            if book and book.school_id in policy_map:
                policy = policy_map[book.school_id]
                cond = log.return_condition or (log.status if log.status == 'LOST' else None)
                if cond == 'LOST':
                    calc_fine += float(policy.lost_book_fine)
                    fine_reasons.append("Lost Book Fine")
                elif cond == 'DAMAGED':
                    calc_fine += float(policy.damaged_book_fine)
                    fine_reasons.append("Damaged Book Fine")
                elif cond == 'WORN':
                    calc_fine += float(policy.worn_book_fine)
                    fine_reasons.append("Worn Book Fine")
                
                ref_date = log.return_date or datetime.date.today()
                if log.due_date and ref_date > log.due_date:
                    days_late = (ref_date - log.due_date).days
                    overdue_fee = float(policy.per_day_late_fee) * days_late
                    calc_fine += overdue_fee
                    fine_reasons.append(f"Overdue ({days_late} days late)")

            final_fine = round(max(record_fine, calc_fine), 2)
            
            borrowed_books.append({
                'id': str(log.id),
                'book_title': book.title if book else 'Unknown Book',
                'author': book.author if book else '-',
                'isbn': book.isbn if (book and book.isbn) else '-',
                'accession_number': book.accession_number if book else '-',
                'category': book.category if (book and book.category) else 'General',
                'issue_date': str(log.issue_date),
                'due_date': str(log.due_date),
                'return_date': str(log.return_date) if log.return_date else None,
                'status': log.status,
                'return_condition': log.return_condition,
                'fine_amount': final_fine,
                'fine_collected': log.fine_collected
            })

            if final_fine > 0:
                total_fines += final_fine
                reason_str = ", ".join(fine_reasons) if fine_reasons else f"Library Fine ({log.return_condition or 'Penalty'})"
                fines_list.append({
                    'id': str(log.id),
                    'book_title': book.title if book else 'Library Book',
                    'fine_amount': final_fine,
                    'fine_collected': log.fine_collected,
                    'status': 'Paid' if log.fine_collected else 'Unpaid / Outstanding',
                    'reason': reason_str,
                    'date': str(log.return_date or log.due_date)
                })

        # 2. Visitor Logs
        visitor_qs = LibraryVisitorLog.objects.filter(
            Q(student=student) | (Q(student__suid__iexact=student.suid) if student.suid else Q())
        ).order_by('-date', '-entry_time').distinct()

        visitor_logs = []
        for vl in visitor_qs:
            visitor_logs.append({
                'id': str(vl.id),
                'date': str(vl.date),
                'entry_time': str(vl.entry_time),
                'exit_time': str(vl.exit_time) if vl.exit_time else None,
                'purpose': vl.purpose
            })

        # 3. Clearance Status
        clearance = LibraryClearance.objects.filter(student=student).first()

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
            'cleared': clearance.cleared if clearance else True,
            'clearance_remarks': clearance.remarks if clearance else 'No clearance holds',
            'borrowed_books': borrowed_books,
            'visitor_logs': visitor_logs,
            'fines': fines_list,
            'total_fines': total_fines
        }, status=status.HTTP_200_OK)


    def get_queryset(self):

        return IssueReturnLog.objects.filter(book__school=self.request.user.school)

    def perform_create(self, serializer):
        with transaction.atomic():
            # Enforce Policy Limits
            borrower_type = serializer.validated_data.get('borrower_type')
            student = serializer.validated_data.get('student')
            teacher = serializer.validated_data.get('teacher')
            school = self.request.user.school
            
            try:
                policy = LibraryPolicy.objects.get(school=school)
            except LibraryPolicy.DoesNotExist:
                # Default policy if none exists
                policy = LibraryPolicy(school=school)
                policy.save()

            active_issues_count = IssueReturnLog.objects.filter(
                status='ISSUED',
                student=student,
                teacher=teacher
            ).count()

            max_allowed = policy.max_books_student if borrower_type == 'STUDENT' else policy.max_books_teacher
            
            if active_issues_count >= max_allowed:
                raise serializers.ValidationError(
                    f"Borrower has reached the maximum limit of {max_allowed} books."
                )

            # Enforce Duration Limits
            issue_date = serializer.validated_data.get('issue_date') or datetime.date.today()
            due_date = serializer.validated_data.get('due_date')
            if due_date:
                max_duration = policy.max_duration_student if borrower_type == 'STUDENT' else policy.max_duration_teacher
                actual_duration = (due_date - issue_date).days
                if actual_duration > max_duration:
                    raise serializers.ValidationError(
                        f"Maximum allowed borrowing duration for {borrower_type.lower()}s is {max_duration} days."
                    )

            instance = serializer.save()
            if instance.status == 'ISSUED':
                book = instance.book
                book.available_copies -= 1
                book.save()

    def perform_update(self, serializer):
        old_instance = self.get_object()
        from django.utils import timezone
        with transaction.atomic():
            instance = serializer.save()
            if old_instance.status == 'ISSUED' and instance.status == 'RETURNED':
                book = instance.book
                
                # 1. Create Stock Audit record automatically
                StockAudit.objects.create(
                    book=book,
                    audit_date=instance.return_date or timezone.now().date(),
                    condition=instance.return_condition or 'GOOD',
                    copies_count=1,
                    is_verified=True,
                    is_processed=True  # Avoid double counting in StockAudit's own logic
                )
                
                # 2. Adjust inventory based on return condition
                if instance.return_condition == 'LOST':
                    # If lost, it's already removed from available_copies on issue.
                    # We now permanently remove it from total_copies.
                    book.total_copies = max(0, book.total_copies - 1)
                else:
                    # If returned (Good/Worn/Damaged), add back to available_copies
                    book.available_copies += 1
                
                book.save()
            
            elif old_instance.status == 'RETURNED' and instance.status == 'ISSUED':
                # Re-issuing a returned book (rare case)
                book = instance.book
                book.available_copies -= 1
                book.save()

class LibraryClearanceViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = LibraryClearance.objects.all()
    serializer_class = LibraryClearanceSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    school_field = 'student__school'
    rbac_module = 'library'
    rbac_resource = 'books'
    rbac_action_permissions = {
        'list': 'library.view_books',
        'retrieve': 'library.view_books',
        'create': 'library.manage_books',
        'update': 'library.manage_books',
        'partial_update': 'library.manage_books',
        'destroy': 'library.manage_books',
    }

class StockAuditViewSet(viewsets.ModelViewSet):
    queryset = StockAudit.objects.all()
    serializer_class = StockAuditSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'library'
    rbac_resource = 'books'
    rbac_action_permissions = {
        'list': ['library.view_stock_log', 'library.edit_stock_log', 'library.view_books', 'library.manage_books'],
        'retrieve': ['library.view_stock_log', 'library.edit_stock_log', 'library.view_books', 'library.manage_books'],
        'create': ['library.edit_stock_log', 'library.manage_books'],
        'update': ['library.edit_stock_log', 'library.manage_books'],
        'partial_update': ['library.edit_stock_log', 'library.manage_books'],
        'destroy': ['library.edit_stock_log', 'library.manage_books'],
    }
    def get_queryset(self):
        return StockAudit.objects.filter(book__school=self.request.user.school).order_by('-audit_date')

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            self._adjust_inventory(instance)

    def perform_update(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            self._adjust_inventory(instance)

    def _adjust_inventory(self, instance):
        if instance.condition == 'LOST' and instance.is_verified and not instance.is_processed:
            book = instance.book
            # Decrease both total and available copies
            book.total_copies = max(0, book.total_copies - instance.copies_count)
            book.available_copies = max(0, book.available_copies - instance.copies_count)
            book.save()
            
            # Mark as processed so we don't adjust again on further edits
            instance.is_processed = True
            instance.save(update_fields=['is_processed'])

from rest_framework.decorators import action

class LibraryVisitorLogViewSet(viewsets.ModelViewSet):
    queryset = LibraryVisitorLog.objects.all()
    serializer_class = LibraryVisitorLogSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'library'
    rbac_resource = 'transactions'
    rbac_action_permissions = {
        'list': ['library.view_visitor_log', 'library.edit_visitor_log', 'library.view_transactions'],
        'retrieve': ['library.view_visitor_log', 'library.edit_visitor_log', 'library.view_transactions'],
        'create': ['library.edit_visitor_log', 'library.view_transactions'],
        'update': ['library.edit_visitor_log', 'library.view_transactions'],
        'partial_update': ['library.edit_visitor_log', 'library.view_transactions'],
        'destroy': ['library.edit_visitor_log', 'library.manage_books'],
    }
    def get_queryset(self):
        return LibraryVisitorLog.objects.filter(school=self.request.user.school).order_by('-date', '-entry_time')

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

class LibraryPolicyViewSet(viewsets.ModelViewSet):
    serializer_class = LibraryPolicySerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'library'
    rbac_resource = 'policy'
    rbac_action_permissions = {
        'current': None,
        'list': ['library.view_library', 'library.update_policy', 'library.manage_fines'],
        'retrieve': ['library.view_library', 'library.update_policy', 'library.manage_fines'],
    }
    
    def get_queryset(self):
        return LibraryPolicy.objects.filter(school=self.request.user.school)

    @action(detail=False, methods=['get', 'patch', 'post'])
    def current(self, request):
        policy, created = LibraryPolicy.objects.get_or_create(school=request.user.school)
        if request.method in ['PATCH', 'POST']:
            user = request.user
            if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
                from apps.accounts.permission_utils import has_permission
                if not (has_permission(user, 'library.update_policy') or has_permission(user, 'library.manage_fines')):
                    return Response({'error': 'You do not have permission to update library policy.'}, status=403)
            serializer = self.get_serializer(policy, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        serializer = self.get_serializer(policy)
        return Response(serializer.data)
