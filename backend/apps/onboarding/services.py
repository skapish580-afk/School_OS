import razorpay
from django.conf import settings
from django.db import transaction
from apps.schools.models import School
from apps.schools.models_settings import SchoolSettings
from apps.features.models import SchoolFeatureConfig, Feature
from apps.accounts.models import User
from apps.platform_admin.models import SchoolSubscription, PlatformAuditLog
import os

RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', 'rzp_test_dummy')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', 'rzp_secret_dummy')

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def create_razorpay_order(amount_in_inr, currency='INR'):
    """
    Creates a Razorpay order. Amount should be in INR (e.g. 500.00)
    """
    # MOCK MODE for local testing with dummy keys
    if RAZORPAY_KEY_ID == 'rzp_test_dummy':
        import uuid
        return {
            'id': f'order_mock_{uuid.uuid4().hex[:12]}',
            'amount': int(amount_in_inr * 100),
            'currency': currency,
            'status': 'created'
        }

    data = {
        "amount": int(amount_in_inr * 100), # Razorpay expects paise
        "currency": currency,
        "payment_capture": 1
    }
    order = client.order.create(data=data)
    return order

def verify_payment_signature(order_id, payment_id, signature):
    """
    Verifies the Razorpay payment signature
    """
    # MOCK MODE for local testing
    if order_id.startswith('order_mock_'):
        return True

    params_dict = {
        'razorpay_order_id': order_id,
        'razorpay_payment_id': payment_id,
        'razorpay_signature': signature
    }
    try:
        client.utility.verify_payment_signature(params_dict)
        return True
    except:
        return False

@transaction.atomic
def provision_school(onboarding_request):
    """
    Main logic to create a school and its admin user after payment success
    """
    # 1. Create School
    school = School.objects.create(
        legal_name=onboarding_request.school_name,
        display_name=onboarding_request.school_name,
        code=onboarding_request.school_code,
        contact_email=onboarding_request.contact_email,
        onboarding_status='LIVE',
        onboarding_step=11
    )
    
    # 2. Create School Settings
    SchoolSettings.objects.create(school=school)
    
    # 3. Create Admin User
    admin_user = User.objects.create_user(
        email=onboarding_request.admin_email,
        password="ChangeMe123!", # Should send reset link in real life
        first_name=onboarding_request.admin_first_name,
        last_name=onboarding_request.admin_last_name,
        user_type='SCHOOL_ADMIN',
        school=school
    )
    
    # 4. Create Subscription
    from datetime import date, timedelta
    plan = onboarding_request.plan
    max_students = 1000 if plan == 'PREMIUM' else 200
    
    SchoolSubscription.objects.create(
        school=school,
        plan=plan,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=365),
        max_students=max_students
    )
    
    # 5. Enable Features based on Plan
    enabled_features = ['ATTENDANCE', 'ACADEMICS', 'TEACHERS']
    if plan == 'PREMIUM':
        enabled_features += ['FINANCE', 'HEALTH', 'GATE_PASS', 'LIBRARY', 'TRANSPORT', 'ASSETS']
        
    for feature_code in enabled_features:
        try:
            feature = Feature.objects.get(code=feature_code)
            SchoolFeatureConfig.objects.create(
                school=school,
                feature=feature,
                enabled=True
            )
        except Feature.DoesNotExist:
            continue
            
    # 6. Log Audit
    PlatformAuditLog.objects.create(
        action='SCHOOL_CREATED',
        school=school,
        description=f"School {school.name} provisioned via {plan} plan onboarding."
    )
    
    return school, admin_user
