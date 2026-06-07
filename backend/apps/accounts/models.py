from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
import uuid

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('user_type', 'ADMIN')  # Default superuser to Admin
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    """
    The CORE IDENTITY model.
    One Human = One User Account (Lifetime).
    """
    
    # We use UUIDs for primary keys to prevent enumeration attacks
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Login via Email, not Username (Modern standard)
    username = None 
    email = models.EmailField(unique=True)
    
    # Basic Demographics (Global)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    
    # Using 'first_name' and 'last_name' from AbstractUser is better for Django defaults,
    # but we can keep a helper property for full name.
    
    # --- ROLE MANAGEMENT (THE FIX) ---
    USER_TYPE_CHOICES = (
        ('PLATFORM_ADMIN', 'Platform Admin'),  # Owner - sees everything
        ('SCHOOL_ADMIN', 'School Admin'),      # School principal/admin - sees their school only
        ('ADMIN', 'Admin'),                    # Legacy - treat as school admin
        ('TEACHER', 'Teacher'),
        ('STUDENT', 'Student'),
        ('PARENT', 'Parent'),
    )
    # This single field replaces is_student, is_teacher, etc.
    user_type = models.CharField(
        max_length=20, 
        choices=USER_TYPE_CHOICES, 
        default='STUDENT'
    )
    
    # School assignment for school admins/teachers
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        help_text='School this user belongs to (for school admins, teachers)'
    )
    # ---------------------------------
    
    # System Flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False) # For Django Admin
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = [] # Email & Password are required by default

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return f"{self.email} ({self.user_type})"

    class Meta:
        verbose_name = 'User Identity'
        verbose_name_plural = 'User Identities'