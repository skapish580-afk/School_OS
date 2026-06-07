from django.db import models
from apps.enrollments.models import StudentEnrollment
from apps.schools.models import School
import uuid

class TransferRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved by Source School'),
        ('REJECTED', 'Rejected'),
        ('COMPLETED', 'Transfer Complete'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Who is moving?
    student_enrollment = models.ForeignKey(StudentEnrollment, on_delete=models.CASCADE, related_name='transfer_requests')
    
    # Where are they going?
    target_school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='incoming_transfers')
    
    # Why?
    reason = models.TextField()
    
    # Tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    request_date = models.DateField(auto_now_add=True)
    resolution_date = models.DateField(null=True, blank=True)
    
    # Comments from the Principal/Admin
    admin_remarks = models.TextField(blank=True)

    def __str__(self):
        return f"Transfer: {self.student_enrollment.student.user.full_name} -> {self.target_school.name}"