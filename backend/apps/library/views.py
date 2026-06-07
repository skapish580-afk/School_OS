from rest_framework import viewsets, serializers
import datetime
from .models import Book, IssueReturnLog, LibraryClearance, StockAudit, LibraryVisitorLog, LibraryPolicy
from .serializers import (
    BookSerializer, IssueReturnLogSerializer, LibraryClearanceSerializer, 
    StockAuditSerializer, LibraryVisitorLogSerializer, LibraryPolicySerializer
)
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permission_utils import RBACPermission

class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    rbac_module = 'library'
    rbac_resource = 'book'

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

class LibraryClearanceViewSet(viewsets.ModelViewSet):
    queryset = LibraryClearance.objects.all()
    serializer_class = LibraryClearanceSerializer

class StockAuditViewSet(viewsets.ModelViewSet):
    queryset = StockAudit.objects.all()
    serializer_class = StockAuditSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'library'

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

    def get_queryset(self):
        return LibraryVisitorLog.objects.filter(school=self.request.user.school).order_by('-date', '-entry_time')

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

class LibraryPolicyViewSet(viewsets.ModelViewSet):
    serializer_class = LibraryPolicySerializer
    
    def get_queryset(self):
        return LibraryPolicy.objects.filter(school=self.request.user.school)

    @action(detail=False, methods=['get', 'patch', 'post'])
    def current(self, request):
        policy, created = LibraryPolicy.objects.get_or_create(school=request.user.school)
        if request.method in ['PATCH', 'POST']:
            serializer = self.get_serializer(policy, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        serializer = self.get_serializer(policy)
        return Response(serializer.data)
