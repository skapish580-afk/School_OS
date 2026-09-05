from django.db import models
from apps.schools.models import School
from apps.students.models import Student
from apps.teachers.models import Teacher
import uuid

class LibraryVisitorLog(models.Model):
    VISITOR_TYPE_CHOICES = [
        ('STUDENT', 'Student'),
        ('TEACHER', 'Teacher'),
    ]
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='library_visitor_logs')
    visitor_type = models.CharField(max_length=20, choices=VISITOR_TYPE_CHOICES)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, null=True, blank=True)
    visitor_name = models.CharField(max_length=255) # Stored name for quick display
    purpose = models.TextField()
    date = models.DateField()
    entry_time = models.TimeField()
    exit_time = models.TimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.visitor_name} - {self.date}"

class Book(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='library_books')
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    isbn = models.CharField(max_length=20, null=True, blank=True)
    accession_number = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    publisher = models.CharField(max_length=255, null=True, blank=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.title} by {self.author}"

class IssueReturnLog(models.Model):
    BORROWER_TYPE_CHOICES = [
        ('STUDENT', 'Student'),
        ('TEACHER', 'Teacher'),
    ]
    RETURN_CONDITION_CHOICES = [
        ('GOOD', 'Good'),
        ('LOST', 'Lost'),
        ('WORN', 'Worn'),
        ('DAMAGED', 'Damaged'),
    ]
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='issue_logs')
    borrower_type = models.CharField(max_length=20, choices=BORROWER_TYPE_CHOICES, default='STUDENT')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='library_issues', null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='library_issues', null=True, blank=True)
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    fine_amount = models.DecimalField(max_digits=7, decimal_places=2, default=0.00)
    fine_collected = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=[('ISSUED', 'Issued'), ('RETURNED', 'Returned'), ('LOST', 'Lost')], default='ISSUED')
    return_condition = models.CharField(max_length=20, choices=RETURN_CONDITION_CHOICES, null=True, blank=True)

    def __str__(self):
        if self.student:
            borrower = getattr(self.student, 'full_name_display', str(self.student))
        elif self.teacher:
            borrower = getattr(self.teacher, 'full_name', str(self.teacher))
        else:
            borrower = 'Unknown Borrower'
        book_title = self.book.title if self.book else 'Book'
        return f"{book_title} issued to {borrower}"

class LibraryClearance(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='library_clearance')
    cleared = models.BooleanField(default=False)
    cleared_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)

    def __str__(self):
        status = "Cleared" if self.cleared else "Pending"
        return f"{self.student.full_name_display} - {status}"

class StockAudit(models.Model):
    CONDITION_CHOICES = [
        ('GOOD', 'Good'),
        ('WORN', 'Worn'),
        ('DAMAGED', 'Damaged'),
        ('LOST', 'Lost'),
    ]
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='stock_audits')
    audit_date = models.DateField()
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    copies_count = models.PositiveIntegerField()
    is_verified = models.BooleanField(default=False)
    is_processed = models.BooleanField(default=False)  # To prevent double inventory adjustment

    def __str__(self):
        return f"Audit: {self.book.title} ({self.condition} - {self.copies_count})"

class LibraryPolicy(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='library_policy')
    max_books_student = models.PositiveIntegerField(default=2)
    max_books_teacher = models.PositiveIntegerField(default=5)
    max_duration_student = models.PositiveIntegerField(default=14) # days
    max_duration_teacher = models.PositiveIntegerField(default=30) # days
    per_day_late_fee = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    lost_book_fine = models.DecimalField(max_digits=7, decimal_places=2, default=500.00)
    damaged_book_fine = models.DecimalField(max_digits=7, decimal_places=2, default=200.00)
    worn_book_fine = models.DecimalField(max_digits=7, decimal_places=2, default=50.00)

    def __str__(self):
        return f"Library Policy - {self.school.name}"
