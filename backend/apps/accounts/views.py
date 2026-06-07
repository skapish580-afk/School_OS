from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Count, Avg
from django.contrib.auth import get_user_model
from .serializers import UserRegistrationSerializer, UserSerializer
from .password_reset import (
    PasswordResetToken, 
    send_password_reset_email, 
    get_client_ip
)
from .uid_validation import validate_uid, UIDGenerator

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """
    Aggregated dashboard metrics for school principal/admin.
    School admins see only their school's data.
    Platform admins see all data.
    """
    from apps.students.models import Student
    from apps.enrollments.models import StudentEnrollment
    from apps.discipline.models import DisciplineRecord, KarmaActivity
    from apps.gatepass.models import GatePass
    from apps.attendance.models import AttendanceSession, StudentAttendance
    from apps.finance.models import FeeLedger, Invoice
    from apps.core.school_isolation import get_user_school, is_platform_admin
    from django.db.models import Q, Count
    from datetime import datetime, timedelta
    
    # Get user's school for filtering
    user = request.user
    user_school = get_user_school(user)
    platform_admin = is_platform_admin(user)
    
    # Build school filter - use school_id for FK comparisons
    def apply_school_filter(queryset, school_field='school'):
        if platform_admin:
            return queryset
        if user_school:
            return queryset.filter(**{school_field: user_school.id})
        return queryset.none()
    
    # Basic counts - Student model (Student -> User -> School)
    # Basic counts - Use Student model directly for more reliable counting
    if platform_admin:
        students_qs = Student.objects.all()
    elif user_school:
        # Check both Student.school and Student.user.school for legacy compatibility
        students_qs = Student.objects.filter(Q(school_id=user_school.id) | Q(user__school_id=user_school.id)).distinct()
    else:
        students_qs = Student.objects.none()
    total_students = students_qs.count()
    
    # Active enrollments count
    enrollments_qs = apply_school_filter(StudentEnrollment.objects.filter(status='ACTIVE'), 'school_id')
    active_enrollments = enrollments_qs.count()
    
    # Calculate average attendance from actual data
    if platform_admin:
        attendance_qs = StudentAttendance.objects.all()
    elif user_school:
        attendance_qs = StudentAttendance.objects.filter(student__school_id=user_school.id)
    else:
        attendance_qs = StudentAttendance.objects.none()
    
    total_attendance_records = attendance_qs.count()
    if total_attendance_records > 0:
        present_count = attendance_qs.filter(status='PRESENT').count()
        avg_attendance = round((present_count / total_attendance_records) * 100, 1)
    else:
        avg_attendance = 0
    
    # Behavior incidents
    if platform_admin:
        incidents_qs = DisciplineRecord.objects.all()
    elif user_school:
        incidents_qs = DisciplineRecord.objects.filter(student__school_id=user_school.id)
    else:
        incidents_qs = DisciplineRecord.objects.none()
    total_incidents = incidents_qs.count()
    
    # Active gate passes
    if platform_admin:
        passes_qs = GatePass.objects.filter(status='ACTIVE')
    elif user_school:
        passes_qs = GatePass.objects.filter(status='ACTIVE', student__school_id=user_school.id)
    else:
        passes_qs = GatePass.objects.none()
    active_passes = passes_qs.count()
    
    # Monthly enrollment data - Enrollment counts per month based on Student model
    from django.db.models.functions import TruncMonth, Coalesce, Cast
    from django.db.models import DateField
    from django.utils import timezone
    from dateutil.relativedelta import relativedelta
    
    # Get current date and 6 months ago (start of that month)
    now = timezone.now()
    start_date = (now - relativedelta(months=5)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_date_date = start_date.date()
    
    # Define effective enrollment date: admission_date OR created_at.date()
    eff_date_expr = Coalesce('admission_date', Cast('created_at', DateField()))
    
    # 2. Get students admitted within the last 6 months window
    monthly_stats = students_qs.annotate(
        eff_date=eff_date_expr
    ).filter(eff_date__gte=start_date_date).annotate(
        month=TruncMonth('eff_date')
    ).values('month').annotate(count=Count('id')).order_by('month')
    
    # Map raw data to dictionary (Safe date conversion)
    window_data = {}
    for s in monthly_stats:
        m = s['month']
        if m:
            actual_m = m.date() if hasattr(m, 'date') else m
            window_data[actual_m] = s['count']
    
    # 3. Generate the 6-month sequence
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    monthly_enrollment = []
    
    for i in range(6):
        month_dt = (start_date + relativedelta(months=i)).date()
        month_count = window_data.get(month_dt, 0)
        
        monthly_enrollment.append({
            'month': month_names[month_dt.month - 1],
            'students': month_count
        })
    
    # Fallback if no data at all
    if not monthly_enrollment:
        monthly_enrollment = [{'month': month_names[now.month-1], 'students': total_students}]
    
    # Recent karma awards
    if platform_admin:
        karma_qs = KarmaActivity.objects.select_related('student', 'student__user')
    elif user_school:
        karma_qs = KarmaActivity.objects.select_related('student', 'student__user').filter(student__user__school_id=user_school.id)
    else:
        karma_qs = KarmaActivity.objects.none()
    
    recent_karma_records = karma_qs.order_by('-date')[:5]
    recent_karma = [
        {
            'student_name': f"{record.student.user.first_name} {record.student.user.last_name}",
            'reason': record.title,
            'points': record.points
        }
        for record in recent_karma_records
    ]
    
    if not recent_karma:
        recent_karma = [{'student_name': 'No recent karma', 'reason': 'No activities yet', 'points': 0}]
    
    # Upcoming Events (Holidays + SchoolEvents)
    from apps.schools.models_calendar import Holiday, SchoolEvent
    from apps.academics.models import Exam
    from apps.teachers.models import Teacher
    
    today = datetime.now().date()
    
    holidays_qs = apply_school_filter(Holiday.objects.filter(date__gte=today))
    school_events_qs = apply_school_filter(SchoolEvent.objects.filter(event_date__gte=today))
    upcoming_events = holidays_qs.count() + school_events_qs.count()
    
    # Upcoming Exams
    exams_qs = apply_school_filter(Exam.objects.filter(exam_date__gte=today))
    upcoming_exams = exams_qs.count()
    
    teachers_qs = Teacher.objects.filter(user__is_active=True)
    if not platform_admin and user_school:
        teachers_qs = teachers_qs.filter(user__school_id=user_school.id)
    active_teachers = teachers_qs.count()
    
    # Finance Stats - Pending Dues
    from apps.enrollments.models_promotion import AcademicYear
    active_year = None
    if user_school:
        active_year = AcademicYear.objects.filter(school_id=user_school.id, status='ACTIVE').first()
    
    finance_qs = FeeLedger.objects.all()
    if not platform_admin and user_school:
        finance_qs = finance_qs.filter(school_id=user_school.id)
    if active_year:
        finance_qs = finance_qs.filter(academic_year=active_year.year_code)
    
    from django.db.models import Sum
    from django.db.models.functions import Coalesce
    from decimal import Decimal
    
    finance_stats = finance_qs.aggregate(
        pending_dues=Coalesce(Sum('current_balance'), Decimal('0'))
    )
    pending_dues = float(finance_stats['pending_dues'])

    # Pending Invoices count (Non-paid, non-cancelled)
    pending_invoices_qs = Invoice.objects.exclude(status__in=['PAID', 'CANCELLED'])
    if not platform_admin and user_school:
        pending_invoices_qs = pending_invoices_qs.filter(school_id=user_school.id)
    elif not platform_admin:
        pending_invoices_qs = pending_invoices_qs.none()
    
    pending_invoices_count = pending_invoices_qs.count()
    
    # Alumni / Graduated students
    alumni_qs = students_qs.filter(status__in=['ALUMNI', 'GRADUATED', 'PENDING_ALUMNI'])
    alumni_count = alumni_qs.count()

    # Transfers
    from apps.transfers.models import TransferRequest
    from apps.enrollments.models import StudentEnrollment
    transfers_qs = TransferRequest.objects.all()
    if not platform_admin and user_school:
        # Outgoing transfers (enrollment's school is our school)
        transfers_qs = transfers_qs.filter(
            student_enrollment__school_id=user_school.id
        )
    elif not platform_admin:
        transfers_qs = transfers_qs.none()
    completed_transfers = transfers_qs.filter(status='COMPLETED').count()
    pending_transfers = transfers_qs.filter(status='PENDING').count()

    # Health / Clinic Visit monthly stats (last 6 months)
    from apps.health.models import ClinicVisit
    if platform_admin:
        clinic_qs = ClinicVisit.objects.all()
    elif user_school:
        clinic_qs = ClinicVisit.objects.filter(student__school_id=user_school.id)
    else:
        clinic_qs = ClinicVisit.objects.none()

    from django.db.models.functions import TruncMonth as TruncMonthHealth
    clinic_monthly = (
        clinic_qs
        .filter(visit_date__gte=start_date)
        .annotate(month=TruncMonthHealth('visit_date'))
        .values('month')
        .annotate(
            total_visits=Count('id'),
            sent_home_count=Count('id', filter=Q(sent_home=True)),
        )
        .order_by('month')
    )

    clinic_window = {}
    for row in clinic_monthly:
        m = row['month']
        if m:
            actual_m = m.date() if hasattr(m, 'date') else m
            clinic_window[actual_m] = {
                'total_visits': row['total_visits'],
                'sent_home': row['sent_home_count'],
            }

    medical_monthly = []
    for i in range(6):
        month_dt = (start_date + relativedelta(months=i)).date()
        clinic_data = clinic_window.get(month_dt, {'total_visits': 0, 'sent_home': 0})
        medical_monthly.append({
            'month': month_names[month_dt.month - 1],
            'total_visits': clinic_data['total_visits'],
            'sent_home': clinic_data['sent_home'],
        })

    # Add school info to response
    response_data = {
        'total_students': total_students,
        'active_teachers': active_teachers,
        'avg_attendance': avg_attendance,
        'total_incidents': total_incidents,
        'active_passes': active_passes,
        'upcoming_exams': upcoming_exams,
        'upcoming_events': upcoming_events,
        'monthly_enrollment': monthly_enrollment,
        'recent_karma': recent_karma,
        'pending_dues': pending_dues,
        'pending_invoices_count': pending_invoices_count,
        'dues_trend': 'Calculated',
        # New widgets
        'alumni_count': alumni_count,
        'completed_transfers': completed_transfers,
        'pending_transfers': pending_transfers,
        'medical_monthly': medical_monthly,
    }
    
    # Add user context
    if user_school:
        response_data['school_name'] = user_school.name
        response_data['school_id'] = str(user_school.id)
    elif platform_admin:
        response_data['school_name'] = 'All Schools (Platform Admin)'
        response_data['is_platform_admin'] = True
    
    return Response(response_data)


# ============================================
# PASSWORD RESET VIEWS
# ============================================

class RequestPasswordResetView(APIView):
    """
    Request a password reset link via email.
    
    POST /auth/password-reset/request/
    {
        "email": "admin@school.com"
    }
    
    Security:
    - Only for SCHOOL_ADMIN and ADMIN users initially
    - Rate limited (3 requests per hour)
    - Doesn't reveal if email exists (returns same message)
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Always return success message to prevent email enumeration
        success_message = {
            'message': 'If an account exists with this email, you will receive a password reset link shortly.',
            'email_sent': True
        }
        
        try:
            user = User.objects.get(email=email)
            
            # Only allow school admins for now
            if user.user_type not in ['SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN']:
                # Silently ignore non-admin users (security)
                return Response(success_message)
            
            # Check rate limiting
            if not PasswordResetToken.can_request_reset(user):
                return Response(
                    {'error': 'Too many reset requests. Please try again later.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )
            
            # Get request metadata
            ip_address = get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            # Create token
            token_instance, plain_token = PasswordResetToken.create_for_user(
                user=user,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            # Send email
            email_sent = send_password_reset_email(user, plain_token, request)
            
            if not email_sent:
                # Log error but don't expose to user
                print(f"Failed to send reset email to {email}")
            
        except User.DoesNotExist:
            # Don't reveal that user doesn't exist
            pass
        
        return Response(success_message)


class VerifyResetTokenView(APIView):
    """
    Verify if a password reset token is valid.
    
    POST /auth/password-reset/verify/
    {
        "token": "abcdef123456..."
    }
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        token = request.data.get('token', '')
        
        if not token:
            return Response(
                {'valid': False, 'error': 'Token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user, token_instance = PasswordResetToken.verify_token(token)
        
        if user:
            return Response({
                'valid': True,
                'email': user.email,
                'user_name': user.first_name or user.email.split('@')[0]
            })
        else:
            return Response({
                'valid': False,
                'error': 'Invalid or expired token'
            }, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    """
    Reset password using a valid token.
    
    POST /auth/password-reset/confirm/
    {
        "token": "abcdef123456...",
        "new_password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!"
    }
    
    Password Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')
        
        # Validate input
        if not token:
            return Response(
                {'error': 'Token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not new_password or not confirm_password:
            return Response(
                {'error': 'Password fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_password != confirm_password:
            return Response(
                {'error': 'Passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate password strength
        password_errors = self._validate_password(new_password)
        if password_errors:
            return Response(
                {'error': password_errors[0], 'errors': password_errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify token
        user, token_instance = PasswordResetToken.verify_token(token)
        
        if not user:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        # Mark token as used
        token_instance.mark_used()
        
        return Response({
            'success': True,
            'message': 'Password has been reset successfully. You can now login with your new password.'
        })
    
    def _validate_password(self, password):
        """Validate password strength."""
        errors = []
        
        if len(password) < 8:
            errors.append('Password must be at least 8 characters long')
        
        if not any(c.isupper() for c in password):
            errors.append('Password must contain at least one uppercase letter')
        
        if not any(c.islower() for c in password):
            errors.append('Password must contain at least one lowercase letter')
        
        if not any(c.isdigit() for c in password):
            errors.append('Password must contain at least one digit')
        
        special_chars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
        if not any(c in special_chars for c in password):
            errors.append('Password must contain at least one special character (!@#$%^&*...)')
        
        return errors


# ============================================
# UID VALIDATION VIEWS
# ============================================

class ValidateUIDView(APIView):
    """
    Validate a SUID or TUID.
    
    POST /auth/validate-uid/
    {
        "uid": "S-DPS-2026-A3F9B2-7"
    }
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        uid = request.data.get('uid', '').strip().upper()
        
        if not uid:
            return Response(
                {'valid': False, 'error': 'UID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_valid, uid_type, message = validate_uid(uid)
        
        return Response({
            'valid': is_valid,
            'uid_type': uid_type,
            'message': message,
            'uid': uid
        })