"""
Secure Password Reset System for School-OS

Security Features:
1. Cryptographically secure tokens (32 bytes)
2. Time-limited tokens (1 hour expiry)
3. Single-use tokens (deleted after use)
4. Rate limiting (max 3 requests per hour per email)
5. IP logging for audit trail
6. School admin only (extendable to others)
"""

from django.db import models
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
import secrets
import hashlib
from datetime import timedelta


class PasswordResetToken(models.Model):
    """
    Secure password reset token storage.
    Tokens are hashed before storage for security.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    
    # Store hashed token, not plain text
    token_hash = models.CharField(max_length=64, unique=True)
    
    # Security metadata
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    
    # Status
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token_hash']),
            models.Index(fields=['user', 'created_at']),
        ]

    @classmethod
    def generate_token(cls):
        """Generate a cryptographically secure token."""
        return secrets.token_urlsafe(32)
    
    @classmethod
    def hash_token(cls, token):
        """Hash token for secure storage."""
        return hashlib.sha256(token.encode()).hexdigest()
    
    @classmethod
    def create_for_user(cls, user, ip_address=None, user_agent=''):
        """
        Create a new password reset token for a user.
        Returns (token_instance, plain_token) tuple.
        """
        # Generate plain token (this is what we send in email)
        plain_token = cls.generate_token()
        
        # Hash it for storage
        token_hash = cls.hash_token(plain_token)
        
        # Set expiry (1 hour)
        expires_at = timezone.now() + timedelta(hours=1)
        
        # Invalidate any existing tokens for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        
        # Create new token
        token_instance = cls.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else ''
        )
        
        return token_instance, plain_token
    
    @classmethod
    def verify_token(cls, plain_token):
        """
        Verify a token and return the associated user if valid.
        Returns (user, token_instance) or (None, None).
        """
        token_hash = cls.hash_token(plain_token)
        
        try:
            token = cls.objects.get(
                token_hash=token_hash,
                is_used=False,
                expires_at__gt=timezone.now()
            )
            return token.user, token
        except cls.DoesNotExist:
            return None, None
    
    @classmethod
    def can_request_reset(cls, user):
        """
        Check if user can request another reset (rate limiting).
        Max 3 requests per hour.
        """
        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_count = cls.objects.filter(
            user=user,
            created_at__gte=one_hour_ago
        ).count()
        return recent_count < 3
    
    def mark_used(self):
        """Mark token as used after successful password reset."""
        self.is_used = True
        self.used_at = timezone.now()
        self.save(update_fields=['is_used', 'used_at'])


def send_password_reset_email(user, reset_token, request=None):
    """
    Send password reset email to user.
    """
    from django.conf import settings as django_settings
    
    # Build reset URL
    frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:3000')
    reset_url = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Get user's school name if available
    school_name = "School-OS"
    if hasattr(user, 'school') and user.school:
        school_name = user.school.name
    
    # Email context
    context = {
        'user_name': user.first_name or user.email.split('@')[0],
        'reset_url': reset_url,
        'school_name': school_name,
        'expiry_hours': 1,
        'support_email': getattr(django_settings, 'SUPPORT_EMAIL', 'support@school-os.com'),
    }
    
    # Render HTML email
    html_message = render_to_string('emails/password_reset.html', context)
    plain_message = strip_tags(html_message)
    
    # Send email
    try:
        send_mail(
            subject=f'🔐 Password Reset Request - {school_name}',
            message=plain_message,
            from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@school-os.com'),
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Failed to send password reset email: {e}")
        return False


def get_client_ip(request):
    """Extract client IP from request, handling proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
