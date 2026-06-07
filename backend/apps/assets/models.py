from django.db import models
from apps.schools.models import School
from apps.students.models import Student
from apps.teachers.models import Teacher
import uuid

class Asset(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='school_assets')
    name = models.CharField(max_length=255)
    asset_code = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=100, help_text="e.g. IT, Sports, Lab")
    purchased_for = models.CharField(max_length=255, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[('AVAILABLE', 'Available'), ('ASSIGNED', 'Assigned'), ('REPAIR', 'Under Repair'), ('DISPOSED', 'Disposed')], default='AVAILABLE')

    def save(self, *args, **kwargs):
        if not self.asset_code:
            self.asset_code = f"AST-{uuid.uuid4().hex[:8].upper()}"
        
        if not self.purchase_date:
            from django.utils import timezone
            self.purchase_date = timezone.now().date()
        
        # If purchased_for is provided and status is still AVAILABLE, mark as ASSIGNED
        if self.purchased_for and self.status == 'AVAILABLE':
            self.status = 'ASSIGNED'
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.asset_code})"

class AssetAssignment(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='assignments')
    # Can be assigned to student or teacher
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_assets')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_assets')
    
    assigned_date = models.DateField(auto_now_add=True)
    return_due_date = models.DateField(null=True, blank=True)
    actual_return_date = models.DateField(null=True, blank=True)
    condition_on_return = models.TextField(null=True, blank=True)

    def __str__(self):
        assignee = self.student.full_name_display if self.student else self.teacher.user.full_name if self.teacher else "Unknown"
        return f"{self.asset.name} assigned to {assignee}"

class AssetSchedule(models.Model):
    TYPES = [('AUDIT', 'Audit'), ('MAINTENANCE', 'Maintenance')]
    STATUSES = [('SCHEDULED', 'Scheduled'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')]
    
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='schedules')
    type = models.CharField(max_length=20, choices=TYPES)
    scheduled_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUSES, default='SCHEDULED')
    notes = models.TextField(null=True, blank=True)
    report = models.FileField(upload_to='asset_reports/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} for {self.asset.name} on {self.scheduled_date}"

class AssetSale(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    asset = models.OneToOneField(Asset, on_delete=models.CASCADE, related_name='sale')
    sale_price = models.DecimalField(max_digits=10, decimal_places=2)
    sale_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sale of {self.asset.name} for {self.sale_price}"
