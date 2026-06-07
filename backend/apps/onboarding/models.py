from django.db import models
import uuid

class SchoolOnboardingRequest(models.Model):
    PLAN_CHOICES = [
        ('BASIC', 'Basic'),
        ('PREMIUM', 'Premium'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # School Info
    school_name = models.CharField(max_length=255)
    school_code = models.CharField(max_length=20, unique=True)
    contact_email = models.EmailField()
    phone_number = models.CharField(max_length=20)
    
    # Admin Info
    admin_first_name = models.CharField(max_length=100)
    admin_last_name = models.CharField(max_length=100)
    admin_email = models.EmailField()
    
    # Plan Info
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Status
    is_paid = models.BooleanField(default=False)
    razorpay_order_id = models.CharField(max_length=100, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Request: {self.school_name} ({self.plan})"
