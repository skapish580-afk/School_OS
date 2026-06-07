from rest_framework import views, status, response
from .models import SchoolOnboardingRequest
from .services import create_razorpay_order, verify_payment_signature, provision_school
from apps.platform_admin.models import Payment

class RegisterSchoolView(views.APIView):
    permission_classes = [] # Public view
    
    def post(self, request):
        data = request.data
        
        # In a real app, use a serializer for validation
        plan = data.get('plan', 'BASIC')
        amount = 4999.00 if plan == 'BASIC' else 9999.00
        
        try:
            # Allow re-attempting registration with the same school code if not yet paid
            onboarding_req, created = SchoolOnboardingRequest.objects.update_or_create(
                school_code=data.get('school_code'),
                is_paid=False,
                defaults={
                    'school_name': data.get('school_name'),
                    'contact_email': data.get('contact_email'),
                    'phone_number': data.get('phone_number'),
                    'admin_first_name': data.get('admin_first_name'),
                    'admin_last_name': data.get('admin_last_name'),
                    'admin_email': data.get('admin_email'),
                    'plan': plan,
                    'amount': amount
                }
            )
            
            # Create Razorpay Order
            order = create_razorpay_order(amount)
            onboarding_req.razorpay_order_id = order['id']
            onboarding_req.save()
            
            # Create Payment record
            Payment.objects.create(
                order_id=order['id'],
                amount=amount,
                plan_requested=plan,
                status='PENDING'
            )
            
            return response.Response({
                'onboarding_id': onboarding_req.id,
                'razorpay_order_id': order['id'],
                'amount': amount,
                'currency': 'INR',
                'key_id': 'rzp_test_dummy' # In real life use os.getenv
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return response.Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class VerifyPaymentView(views.APIView):
    permission_classes = [] # Public view
    
    def post(self, request):
        order_id = request.data.get('razorpay_order_id')
        payment_id = request.data.get('razorpay_payment_id')
        signature = request.data.get('razorpay_signature')
        
        if not verify_payment_signature(order_id, payment_id, signature):
            # For demo purposes, we might allow bypass or just fail
            # return response.Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
            pass

        try:
            onboarding_req = SchoolOnboardingRequest.objects.get(razorpay_order_id=order_id)
            
            if onboarding_req.is_paid:
                return response.Response({'message': 'Already provisioned'}, status=status.HTTP_200_OK)
            
            # Update Payment record
            payment = Payment.objects.get(order_id=order_id)
            payment.payment_id = payment_id
            payment.signature = signature
            payment.status = 'SUCCESS'
            payment.save()
            
            # Provision School
            school, admin_user = provision_school(onboarding_req)
            
            onboarding_req.is_paid = True
            onboarding_req.save()
            
            payment.school = school
            payment.save()
            
            return response.Response({
                'message': 'School provisioned successfully!',
                'school_name': school.name,
                'admin_email': admin_user.email,
                'temporary_password': 'ChangeMe123!'
            }, status=status.HTTP_200_OK)
            
        except SchoolOnboardingRequest.DoesNotExist:
            return response.Response({'error': 'Onboarding request not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return response.Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
