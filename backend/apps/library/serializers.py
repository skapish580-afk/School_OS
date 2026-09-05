from rest_framework import serializers
from .models import Book, IssueReturnLog, LibraryClearance, StockAudit, LibraryVisitorLog, LibraryPolicy
import datetime

class BookSerializer(serializers.ModelSerializer):
    isbn = serializers.CharField(required=True, allow_blank=False, help_text="ISBN number is compulsory")

    class Meta:
        model = Book
        fields = '__all__'
        read_only_fields = ['school', 'available_copies']

    def validate_isbn(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("ISBN number is compulsory when adding a book.")
        return value.strip()

class IssueReturnLogSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name_display')
    teacher_name = serializers.ReadOnlyField(source='teacher.user.full_name')
    book_title = serializers.ReadOnlyField(source='book.title')
    isbn = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = IssueReturnLog
        fields = [
            'id', 'book', 'book_title', 'borrower_type', 'student', 'student_name', 
            'teacher', 'teacher_name', 'issue_date', 'due_date', 'return_date', 
            'fine_amount', 'fine_collected', 'status', 'return_condition', 'isbn', 'calculated_fine'
        ]
        read_only_fields = ['book']

    calculated_fine = serializers.SerializerMethodField()

    def get_calculated_fine(self, obj):
        try:
            policy = LibraryPolicy.objects.get(school=obj.book.school)
        except LibraryPolicy.DoesNotExist:
            return 0.00
            
        total_fine = 0.00
        
        # 1. Condition based fine
        if obj.status == 'RETURNED':
            if obj.return_condition == 'LOST':
                total_fine += float(policy.lost_book_fine)
            elif obj.return_condition == 'DAMAGED':
                total_fine += float(policy.damaged_book_fine)
            elif obj.return_condition == 'WORN':
                total_fine += float(policy.worn_book_fine)
            
        # 2. Late fee
        # If returned, use return_date. If still issued, use today for current overdue fine.
        reference_date = obj.return_date or datetime.date.today()
        if obj.due_date and reference_date > obj.due_date:
            days_late = (reference_date - obj.due_date).days
            total_fine += float(policy.per_day_late_fee) * days_late
            
        return round(total_fine, 2)

    def validate(self, data):
        # Only validate book/isbn on creation
        if not self.instance:
            isbn = data.pop('isbn', None)
            if isbn:
                try:
                    book = Book.objects.get(isbn=isbn, school=self.context['request'].user.school)
                    if book.available_copies <= 0:
                        raise serializers.ValidationError("No copies available for this book.")
                    data['book'] = book
                except Book.DoesNotExist:
                    raise serializers.ValidationError(f"Book with ISBN {isbn} not found.")
            elif not data.get('book'):
                raise serializers.ValidationError("Either book or isbn must be provided.")
        return data

class LibraryClearanceSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name_display')
    
    class Meta:
        model = LibraryClearance
        fields = '__all__'

class StockAuditSerializer(serializers.ModelSerializer):
    book_title = serializers.ReadOnlyField(source='book.title')
    book_isbn = serializers.ReadOnlyField(source='book.isbn')
    total_copies = serializers.ReadOnlyField(source='book.total_copies')
    isbn = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StockAudit
        fields = '__all__'
        read_only_fields = ['book']

    def validate(self, data):
        isbn = data.pop('isbn', None)
        if isbn:
            try:
                book = Book.objects.get(isbn=isbn, school=self.context['request'].user.school)
                data['book'] = book
            except Book.DoesNotExist:
                raise serializers.ValidationError(f"Book with ISBN {isbn} not found.")
        elif not data.get('book'):
            raise serializers.ValidationError("Either book or isbn must be provided.")
        return data

class LibraryVisitorLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibraryVisitorLog
        fields = '__all__'
        read_only_fields = ['school']

class LibraryPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = LibraryPolicy
        fields = '__all__'
        read_only_fields = ['school']
