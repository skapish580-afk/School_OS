from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from datetime import timedelta
from django.shortcuts import render
from django.views import View
from django.http import HttpResponse, JsonResponse
from .models import GatePass
from .serializers import GatePassSerializer
from apps.accounts.permission_utils import RBACPermission
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_gatepass_email(sender_email, password, receiver_email, subject, body):
    message = MIMEMultipart()
    message['From'] = sender_email
    message['To'] = receiver_email
    message['Subject'] = subject
    message.attach(MIMEText(body, 'plain'))

    try:
        # Use 465 for SSL
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, password)
        server.send_message(message)
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False
    finally:
        try:
            server.quit()
        except:
            pass

class GatePassViewSet(viewsets.ModelViewSet):
    queryset = GatePass.objects.all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'gatepass'
    rbac_resource = 'gatepass'
    rbac_action_permissions = {
        'scan': 'gatepass.scan_gatepass',
        'active': 'gatepass.view_gatepass',
        'terminate': 'gatepass.edit_gatepass',
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        pass_status = self.request.query_params.get('status')
        if pass_status:
            queryset = queryset.filter(status=pass_status)
            
        # `issued_at` was renamed to `requested_at` in migrations; order by the actual field
        return queryset.order_by('-requested_at')
    
    def perform_create(self, serializer):
        # Generate 6-digit secret key
        secret_key = ''.join(random.choices(string.digits, k=6))
        
        instance = serializer.save(
            issued_by=self.request.user,
            issued_at=timezone.now(),
            valid_until=timezone.now() + timedelta(hours=2),
            status='ACTIVE',
            secret_key=secret_key
        )
        
        # Send Email to Student's registered email
        student = instance.student
        receiver_email = student.user.email
        print(f"\n[GATEPASS] Pass created for student: {student.full_name_display} ({student.suid})")
        print(f"[GATEPASS] Secret Key: {secret_key}")
        print(f"[GATEPASS] Receiver email: {receiver_email}")

        if not receiver_email:
            print(f"[GATEPASS] WARNING: No email address found for student {student.suid}")
        else:
            try:
                school_settings = student.school.settings
                sender_email = school_settings.gatepass_sender_email
                password = school_settings.gatepass_app_password

                if not sender_email:
                    print(f"[GATEPASS] WARNING: No gatepass_sender_email configured in school settings")
                elif not password:
                    print(f"[GATEPASS] WARNING: No gatepass_app_password configured in school settings")
                else:
                    print(f"[GATEPASS] Sending email from {sender_email} to {receiver_email}...")
                    subject = f"Gate Pass Issued: {student.full_name_display}"
                    body = (
                        f"Dear Parent/Guardian,\n\n"
                        f"A Gate Pass has been issued for {student.full_name_display}.\n\n"
                        f"Reason: {instance.reason}\n"
                        f"Secret Key: {secret_key}\n\n"
                        f"Please provide this Secret Key to the security officer at the school gate.\n\n"
                        f"Regards,\nSchool Administration"
                    )
                    result = send_gatepass_email(sender_email, password, receiver_email, subject, body)
                    if result:
                        print(f"[GATEPASS] Email sent successfully to {receiver_email}!")
                    else:
                        print(f"[GATEPASS] ERROR: Email sending failed (check SMTP credentials)")
            except Exception as e:
                print(f"[GATEPASS] EXCEPTION during email send: {e}")
    
    @action(detail=True, methods=['post'])
    def scan(self, request, pk=None):
        gate_pass = self.get_object()
        
        if gate_pass.status == 'USED':
            return Response({'error': 'Pass already used'}, status=status.HTTP_400_BAD_REQUEST)
        
        if timezone.now() > gate_pass.valid_until:
            gate_pass.status = 'EXPIRED'
            gate_pass.save()
            return Response({'error': 'Pass expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        gate_pass.status = 'USED'
        gate_pass.scanned_by = request.user
        gate_pass.scanned_at = timezone.now()
        gate_pass.save()
        
        return Response(GatePassSerializer(gate_pass).data)
    
    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        gate_pass = self.get_object()
        
        if gate_pass.status in ['USED', 'EXPIRED', 'CANCELLED']:
            return Response({'error': f'Pass is already {gate_pass.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        gate_pass.status = 'CANCELLED'
        gate_pass.save()
        
        return Response(GatePassSerializer(gate_pass).data)
    
    @action(detail=False, methods=['post'])
    def validate_qr(self, request):
        """
        Validates a signed QR payload from a security officer's device.
        """
        payload = request.data.get('payload')
        if not payload or '|' not in payload:
            return Response({'error': 'Invalid QR payload'}, status=status.HTTP_400_BAD_REQUEST)
        
        pass_id, signature = payload.split('|')
        
        try:
            from django.db.models import Q
            gate_pass = GatePass.objects.get(Q(id=pass_id) | Q(pass_id=pass_id))
        except (GatePass.DoesNotExist, ValueError):
            return Response({'error': 'Pass not found'}, status=status.HTTP_404_NOT_FOUND)
            
        # Verify signature
        import hmac
        import hashlib
        
        secret = gate_pass.student.school.settings.gatepass_secret_key
        expected_signature = hmac.new(
            secret.encode(),
            pass_id.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
             return Response({'error': 'Invalid signature. Security alert triggered.'}, status=status.HTTP_403_FORBIDDEN)
             
        # Check status
        if gate_pass.status != 'ACTIVE':
            return Response({'error': f'Pass is {gate_pass.status}'}, status=status.HTTP_400_BAD_REQUEST)
            
        if timezone.now() > gate_pass.valid_until:
             gate_pass.status = 'EXPIRED'
             gate_pass.save()
             return Response({'error': 'Pass expired'}, status=status.HTTP_400_BAD_REQUEST)
             
        # Success
        gate_pass.status = 'USED'
        gate_pass.scanned_by = request.user
        gate_pass.scanned_at = timezone.now()
        gate_pass.save()
        
        return Response({
            'message': 'Access Granted',
            'student': gate_pass.student.full_name_display,
            'photo': gate_pass.student.profile_photo.url if gate_pass.student.profile_photo else None,
            'pass_details': GatePassSerializer(gate_pass).data
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        active_passes = self.get_queryset().filter(status='ACTIVE')
        serializer = self.get_serializer(active_passes, many=True)
        return Response(serializer.data)

class GatePassVerificationView(View):
    def get(self, request):
        pass_id = request.GET.get('pass_id', '')
        return render(request, 'gatepass/verify.html', {'pass_id': pass_id})

    def post(self, request):
        pass_id = request.POST.get('pass_id', '')
        secret_key = request.POST.get('secret_key', '').strip()

        try:
            if pass_id:
                from django.db.models import Q
                # Support lookup by internal UUID (id) or the generated pass_id
                gate_pass = GatePass.objects.get(Q(id=pass_id) | Q(pass_id=pass_id))
            else:
                # Fallback to lookup by Secret Key ONLY if no ID is present
                # We filter by ACTIVE to find the current valid pass
                gate_pass = GatePass.objects.get(
                    secret_key=secret_key,
                    status='ACTIVE'
                )
        except (GatePass.DoesNotExist, ValueError):
            return render(request, 'gatepass/verify.html', {
                'error': 'Invalid Secret Key. No active pass found.',
                'pass_id': pass_id
            })
        except GatePass.MultipleObjectsReturned:
            return render(request, 'gatepass/verify.html', {
                'error': 'Multiple active passes found for this key. Please use the QR code scan.',
                'pass_id': pass_id
            })

        if gate_pass.status != 'ACTIVE':
             return render(request, 'gatepass/verify.html', {
                'error': f'This pass is no longer active (Status: {gate_pass.status}).',
                'pass_id': pass_id
            })

        if timezone.now() > gate_pass.valid_until:
            gate_pass.status = 'EXPIRED'
            gate_pass.save()
            return render(request, 'gatepass/verify.html', {
                'error': 'This pass has expired.',
                'pass_id': pass_id
            })

        if gate_pass.secret_key == secret_key:
            gate_pass.status = 'USED'
            gate_pass.scanned_at = timezone.now()
            gate_pass.save()

            student = gate_pass.student
            guardian = student.guardians.filter(is_primary=True).first()
            if guardian and guardian.email:
                school_settings = student.school.settings
                sender_email = school_settings.gatepass_sender_email
                password = school_settings.gatepass_app_password
                if sender_email and password:
                    subject = 'Student Left School'
                    body = f'Your child, {student.full_name_display}, has successfully used the Gate Pass and has been sent home.'
                    send_gatepass_email(sender_email, password, guardian.email, subject, body)

            return render(request, 'gatepass/verify.html', {
                'success': True,
                'student_name': student.full_name_display
            })
        else:
            gate_pass.failed_attempts += 1
            gate_pass.save()
            return render(request, 'gatepass/verify.html', {
                'error': 'Incorrect Secret Key. Please try again.',
                'pass_id': pass_id
            })


class GatePassVerifyAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        pass_id = request.data.get('pass_id')
        secret_key = request.data.get('secret_key', '').strip()

        if not pass_id and not secret_key:
            return Response({'error': 'Secret Key is required.',}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if pass_id:
                from django.db.models import Q
                gate_pass = GatePass.objects.get(Q(id=pass_id) | Q(pass_id=pass_id))
            else:
                gate_pass = GatePass.objects.get(
                    secret_key=secret_key,
                    status='ACTIVE'
                )
        except (GatePass.DoesNotExist, ValueError):
            return Response({'error': 'No active pass found for this key.',}, status=status.HTTP_404_NOT_FOUND)
        except GatePass.MultipleObjectsReturned:
             return Response({'error': 'Multiple active passes found. Please scan the QR code.',}, status=status.HTTP_400_BAD_REQUEST)

        if gate_pass.status != 'ACTIVE':
            return Response({'error': f'Pass is {gate_pass.status}.',}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.now() > gate_pass.valid_until:
            gate_pass.status = 'EXPIRED'
            gate_pass.save()
            return Response({'error': 'Pass has expired.',}, status=status.HTTP_400_BAD_REQUEST)

        if gate_pass.secret_key == secret_key:
            gate_pass.status = 'USED'
            gate_pass.scanned_at = timezone.now()
            gate_pass.save()

            student = gate_pass.student
            receiver_email = student.user.email
            if receiver_email:
                try:
                    school_settings = student.school.settings
                    sender_email = school_settings.gatepass_sender_email
                    password = school_settings.gatepass_app_password
                    if sender_email and password:
                        subject = 'Your Child Has Left School'
                        body = (
                            f"Dear Parent/Guardian,\n\n"
                            f"Your child, {student.full_name_display}, has successfully used their Gate Pass "
                            f"and has been sent home.\n\n"
                            f"Regards,\nSchool Administration"
                        )
                        send_gatepass_email(sender_email, password, receiver_email, subject, body)
                except Exception as e:
                    print(f"[GATEPASS] Error sending success email: {e}")

            return Response({'message': 'Verification Successful', 'student_name': student.full_name_display})
        else:
            gate_pass.failed_attempts += 1
            gate_pass.save()
            return Response({'error': 'Incorrect Secret Key.',}, status=status.HTTP_400_BAD_REQUEST)

