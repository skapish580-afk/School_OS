import uuid
from django.db import models
from apps.students.models import Student
from django.conf import settings
import random
import string

def generate_pass_id():
    """Generates a unique 8-character alphanumeric ID for parents."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

class GatePass(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('ACTIVE', 'Active (Ready to Scan)'),
        ('USED', 'Used (Student Left)'),
        ('EXPIRED', 'Expired (Not Used)'),
        ('CANCELLED', 'Cancelled (Terminated)'),
    ]

    # A unique generic ID (UUID) that is hard to guess
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='gate_passes')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='requested_gatepasses',
        help_text="Who requested the gate pass (student/parent/admin)"
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        blank=True,
        related_name='issued_gatepasses',
        help_text="Who approved and issued the pass"
    )
    
    # Approval flow
    approved_by_class_teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_gatepasses'
    )
    approval_note = models.TextField(blank=True, help_text="Note from approver")
    rejection_reason = models.TextField(blank=True)
    
    reason = models.TextField(help_text="e.g. Medical Emergency, Family Function")
    requested_at = models.DateTimeField(auto_now_add=True)
    issued_at = models.DateTimeField(null=True, blank=True, help_text="When the pass was issued")
    out_time = models.TimeField(null=True, blank=True, help_text="Expected time to leave school")
    valid_until = models.DateTimeField(help_text="Pass expires after this time")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Audit log
    approved_at = models.DateTimeField(null=True, blank=True)
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        related_name='scanned_passes', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    scanned_at = models.DateTimeField(null=True, blank=True)
    qr_signature = models.CharField(max_length=255, blank=True, null=True)
    
    # New fields for secure verification
    pass_id = models.CharField(
        max_length=8, 
        unique=True, 
        default=generate_pass_id
    )
    secret_key = models.CharField(max_length=6, blank=True, null=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    cancellation_reason = models.TextField(blank=True, default='')

    def generate_qr_payload(self):
        """
        Generates a verification URL for the QR code.
        Points to the Next.js verification page.
        """
        from django.conf import settings as django_settings
        
        # If in debug mode (development), use localhost.
        # Otherwise (production), dynamically use the domain name linked to the school.
        if django_settings.DEBUG:
            base_url = "http://localhost:3000"
        else:
            school = self.student.school
            if school.website:
                base_url = school.website.rstrip('/')
            elif school.subdomain:
                sub = school.subdomain
                if '.' in sub:
                    base_url = f"https://{sub}"
                else:
                    base_url = f"https://{sub}.schoolos.in"
            else:
                base_url = "https://schoolos.in"
                
        return f"{base_url}/verify-pass/?pass_id={self.id}"


    def __str__(self):
        return f"PASS: {self.student.user.full_name} ({self.status})"


class VisitorPass(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active (Ready to Scan)'),
        ('USED', 'Used (Left)'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='visitor_passes', null=True)
    
    name = models.CharField(max_length=150)
    address = models.TextField()
    purpose = models.TextField()
    email = models.EmailField()
    phone_number = models.CharField(max_length=20)
    
    requested_at = models.DateTimeField(auto_now_add=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField()
    
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        blank=True,
        related_name='issued_visitor_passes'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    # Audit log
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        related_name='scanned_visitor_passes', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    pass_id = models.CharField(
        max_length=8, 
        unique=True, 
        default=generate_pass_id
    )
    cancellation_reason = models.TextField(blank=True, default='')

    def __str__(self):
        return f"VISITOR: {self.name} ({self.status})"