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
from .models import GatePass, VisitorPass
from .serializers import GatePassSerializer, VisitorPassSerializer
from email.mime.image import MIMEImage
from apps.accounts.permission_utils import RBACPermission
from apps.core.school_isolation import SchoolIsolationMixin
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

from rest_framework import permissions

class GatePassActionPermission(permissions.BasePermission):
    """
    Custom permission for GatePass and VisitorPass ViewSets:
    - Safe methods (GET, HEAD, OPTIONS) or active view actions: requires students.view_student_only, view_profile, view_journey or admin
    - Write/Manage methods (POST, PUT, PATCH, DELETE, scan, terminate, etc.): requires students.issue_pass or admin
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        from apps.accounts.permission_utils import has_permission
        
        # Check action or method
        if request.method in permissions.SAFE_METHODS or view.action == 'active':
            return (
                has_permission(user, 'students.view_student_only') or
                has_permission(user, 'students.view_profile') or
                has_permission(user, 'students.view_journey')
            )
        else:
            return has_permission(user, 'students.issue_pass')

    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False
        return True



class GatePassViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = GatePass.objects.all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    school_field = 'student__school'
    
    rbac_module = 'gatepass'
    rbac_resource = 'student_gate_pass'
    rbac_action_permissions = {
        'list':            ['gatepass.view_student_gatepass', 'students.view_student_only', 'students.view_profile', 'students.view_journey'],
        'retrieve':        ['gatepass.view_student_gatepass', 'students.view_student_only', 'students.view_profile', 'students.view_journey'],
        'active':          ['gatepass.view_student_gatepass', 'students.view_student_only', 'students.view_profile', 'students.view_journey'],
        'create':          ['gatepass.edit_student_gatepass', 'students.issue_pass'],
        'update':          ['gatepass.edit_student_gatepass', 'students.issue_pass'],
        'partial_update':  ['gatepass.edit_student_gatepass', 'students.issue_pass'],
        'destroy':         ['gatepass.edit_student_gatepass', 'students.issue_pass'],
        'scan':            ['gatepass.edit_student_gatepass', 'students.issue_pass'],
        'terminate':       ['gatepass.edit_student_gatepass', 'students.issue_pass'],
        'validate_qr':     ['gatepass.edit_student_gatepass', 'students.issue_pass'],
    }

    def get_permissions(self):
        if self.action == 'student_passes':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['student_passes']:
            return
        super().check_permissions(request)

    @action(detail=False, methods=['get'])
    def student_passes(self, request):
        user = request.user
        from apps.students.models import Student
        from apps.gatepass.models import GatePass
        from django.db.models import Q

        student = Student.objects.filter(user=user).first()
        if not student and hasattr(user, 'email') and user.email:
            student = Student.objects.filter(user__email__iexact=user.email).first()
        if not student and hasattr(user, 'username') and user.username:
            student = Student.objects.filter(suid__iexact=user.username).first()
        if not student and hasattr(user, 'suid') and user.suid:
            student = Student.objects.filter(suid__iexact=user.suid).first()

        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        query = Q(student=student)
        if student.suid:
            query |= Q(student__suid__iexact=student.suid)
        if user.is_authenticated:
            query |= Q(requested_by=user)

        passes_qs = GatePass.objects.filter(query).distinct().order_by('-requested_at')

        passes_data = []
        for gp in passes_qs:
            passes_data.append({
                'id': str(gp.id),
                'pass_id': gp.pass_id,
                'secret_key': gp.secret_key or 'N/A',
                'reason': gp.reason,
                'status': gp.status,
                'requested_at': str(gp.requested_at) if gp.requested_at else None,
                'issued_at': str(gp.issued_at) if gp.issued_at else None,
                'out_time': str(gp.out_time) if gp.out_time else None,
                'valid_until': str(gp.valid_until) if gp.valid_until else None,
                'scanned_at': str(gp.scanned_at) if gp.scanned_at else None,
                'approval_note': gp.approval_note,
                'cancellation_reason': gp.cancellation_reason
            })



        student_name = ""
        if student.user:
            student_name = student.user.get_full_name().strip()
        if not student_name:
            student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        if not student_name:
            student_name = getattr(student, 'full_name_display', '') or student.suid or 'Student'

        return Response({
            'student_name': student_name,
            'suid': student.suid,
            'passes': passes_data
        }, status=status.HTTP_200_OK)


    def get_queryset(self):

        # Auto-expire passes that are past valid_until and send notification emails
        from django.utils import timezone
        import pytz
        
        expired_passes = GatePass.objects.filter(
            status='ACTIVE',
            valid_until__lt=timezone.now()
        )
        
        for pass_obj in expired_passes:
            pass_obj.status = 'EXPIRED'
            pass_obj.save()
            
            try:
                student = pass_obj.student
                receiver_email = student.user.email
                if receiver_email:
                    school_settings = student.school.settings
                    sender_email = school_settings.gatepass_sender_email
                    password = school_settings.gatepass_app_password
                    
                    if sender_email and password:
                        subject = "Student Gate Pass Expired"
                        
                        # Convert valid_until to school local timezone
                        try:
                            school_tz = pytz.timezone(student.school.timezone)
                            local_dt = pass_obj.valid_until.astimezone(school_tz)
                        except Exception:
                            try:
                                school_tz = pytz.timezone('Asia/Kolkata')
                                local_dt = pass_obj.valid_until.astimezone(school_tz)
                            except Exception:
                                local_dt = pass_obj.valid_until
                                
                        expiry_time_str = local_dt.strftime("%d %b %Y, %I:%M %p")
                        
                        body = (
                            f"Dear Parent/Guardian,\n\n"
                            f"This is to notify you that the Gate Pass issued for your child, {student.full_name_display}, has expired.\n"
                            f"The pass (ID: {pass_obj.id}) expired at {expiry_time_str}.\n\n"
                            f"Since this pass has expired, it is no longer valid for exit or entry. Please contact school administration if you need assistance.\n\n"
                            f"Regards,\nSchool Administration"
                        )
                        send_gatepass_email(sender_email, password, receiver_email, subject, body)
            except Exception as e:
                print(f"[GATEPASS] Error sending student pass expiration email: {e}")

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
        
        valid_until_param = self.request.data.get('valid_until')
        expiry_time_param = self.request.data.get('expiry_time')
        expiry_hours_param = self.request.data.get('expiry_hours')

        now = timezone.now()
        valid_until_dt = None

        if valid_until_param:
            try:
                from django.utils.dateparse import parse_datetime
                valid_until_dt = parse_datetime(str(valid_until_param))
            except Exception:
                pass

        if not valid_until_dt and expiry_time_param:
            try:
                parts = [int(p) for p in str(expiry_time_param).split(':')]
                if len(parts) >= 2:
                    import datetime, pytz
                    student_school = getattr(self.request.user, 'school', None)
                    tz_str = getattr(student_school, 'timezone', 'Asia/Kolkata') if student_school else 'Asia/Kolkata'
                    try:
                        school_tz = pytz.timezone(tz_str)
                    except Exception:
                        school_tz = pytz.timezone('Asia/Kolkata')
                    
                    loc_now = now.astimezone(school_tz)
                    target_dt = loc_now.replace(hour=parts[0], minute=parts[1], second=0, microsecond=0)
                    if target_dt <= loc_now:
                        target_dt += datetime.timedelta(days=1)
                    valid_until_dt = target_dt
            except Exception:
                pass

        if not valid_until_dt and expiry_hours_param is not None:
            try:
                eh = float(expiry_hours_param)
                if eh > 0:
                    valid_until_dt = now + timedelta(hours=eh)
            except (ValueError, TypeError):
                pass

        if not valid_until_dt:
            valid_until_dt = now + timedelta(hours=2.0)

            
        expiry_hours = round((valid_until_dt - now).total_seconds() / 3600.0, 2)


            
        instance = serializer.save(
            issued_by=self.request.user,
            issued_at=now,
            valid_until=valid_until_dt,
            status='ACTIVE',
            secret_key=secret_key
        )

        
        # Send Email to Student's registered email
        student = instance.student
        receiver_email = student.user.email
        print(f"\n[GATEPASS] Pass created for student: {student.full_name_display} ({student.suid})")
        print(f"[GATEPASS] Expiry hours: {expiry_hours}")
        print(f"[GATEPASS] Secret Key: {secret_key}")
        print(f"[GATEPASS] Receiver email: {receiver_email}")

        if not receiver_email:
            print(f"[GATEPASS] WARNING: No email address found for student {student.suid}")
        else:
            try:
                school_settings = student.school.settings
                if not getattr(school_settings, 'email_notifications', True):
                    print(f"[GATEPASS] Skipping email send because email notifications are globally disabled for this school")
                else:
                    sender_email = school_settings.gatepass_sender_email
                    password = school_settings.gatepass_app_password

                    if not sender_email:
                        print(f"[GATEPASS] WARNING: No gatepass_sender_email configured in school settings")
                    elif not password:
                        print(f"[GATEPASS] WARNING: No gatepass_app_password configured in school settings")
                    else:
                        print(f"[GATEPASS] Sending email from {sender_email} to {receiver_email}...")
                        subject = f"Gate Pass Issued: {student.full_name_display}"
                        custom_body = getattr(school_settings, 'gatepass_creation_email_body', '')
                        
                        # Convert UTC valid_until to the school's local timezone
                        import pytz
                        try:
                            school_tz = pytz.timezone(student.school.timezone)
                            local_dt = instance.valid_until.astimezone(school_tz)
                        except Exception:
                            try:
                                school_tz = pytz.timezone('Asia/Kolkata')
                                local_dt = instance.valid_until.astimezone(school_tz)
                            except Exception:
                                local_dt = instance.valid_until
                        
                        # Format expiry time in a user-friendly format (e.g. 04 Jul 2026, 05:28 PM)
                        expiry_time_str = local_dt.strftime("%d %b %Y, %I:%M %p")
                        
                        if custom_body:
                            custom_body = custom_body.replace("{student_name}", student.full_name_display).replace("{student}", student.full_name_display)
                            secret_key_line = f"Secret Key: {secret_key}"
                            if secret_key_line not in custom_body:
                                custom_body = f"{custom_body.strip()}\n\n{secret_key_line}"
                            body = custom_body
                        else:
                            body = (
                                f"Dear Parent/Guardian,\n\n"
                                f"A Gate Pass has been issued for {student.full_name_display}.\n\n"
                                f"Reason: {instance.reason}\n"
                                f"Expiry Time: {expiry_time_str}\n"
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
        
        if gate_pass.status != 'ACTIVE':
            return Response({'error': f'Pass is not active (Status: {gate_pass.status})'}, status=status.HTTP_400_BAD_REQUEST)
        
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
        
        reason = request.data.get('reason', '').strip() or 'No reason specified'
        gate_pass.cancellation_reason = reason
        gate_pass.status = 'CANCELLED'
        gate_pass.save()
        
        # Send cancellation email to parent
        try:
            student = gate_pass.student
            receiver_email = student.user.email
            if receiver_email:
                school_settings = student.school.settings
                sender_email = school_settings.gatepass_sender_email
                password = school_settings.gatepass_app_password
                
                if sender_email and password:
                    subject = "Student Gate Pass Cancelled"
                    body = (
                        f"Dear Parent/Guardian,\n\n"
                        f"This is to notify you that the Gate Pass issued for your child, {student.full_name_display}, has been cancelled.\n\n"
                        f"Pass ID: {gate_pass.pass_id if hasattr(gate_pass, 'pass_id') else gate_pass.id}\n"
                        f"Reason for Cancellation: {reason}\n\n"
                        f"This pass is no longer valid. If you believe this is an error, please contact the school administration.\n\n"
                        f"Regards,\nSchool Administration"
                    )
                    send_gatepass_email(sender_email, password, receiver_email, subject, body)
        except Exception as e:
            print(f"[GATEPASS] Error sending cancellation email: {e}")
        
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
                if not getattr(school_settings, 'email_notifications', True):
                    print(f"[GATEPASS] Skipping email send because email notifications are globally disabled for this school")
                else:
                    sender_email = school_settings.gatepass_sender_email
                    password = school_settings.gatepass_app_password
                    if sender_email and password:
                        subject = 'Student Left School'
                        custom_body = getattr(school_settings, 'gatepass_departure_email_body', '')
                        if custom_body:
                            body = custom_body.replace("{student_name}", student.full_name_display).replace("{student}", student.full_name_display)
                        else:
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
                    if not getattr(school_settings, 'email_notifications', True):
                        print(f"[GATEPASS] Skipping email send because email notifications are globally disabled for this school")
                    else:
                        sender_email = school_settings.gatepass_sender_email
                        password = school_settings.gatepass_app_password
                        if sender_email and password:
                            subject = 'Your Child Has Left School'
                            custom_body = getattr(school_settings, 'gatepass_departure_email_body', '')
                            if custom_body:
                                body = custom_body.replace("{student_name}", student.full_name_display).replace("{student}", student.full_name_display)
                            else:
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


def send_visitor_pass_email(sender_email, password, receiver_email, subject, body_html, qr_image_bytes):
    message = MIMEMultipart('related')
    message['From'] = sender_email
    message['To'] = receiver_email
    message['Subject'] = subject

    # Alternative container for HTML
    msg_alternative = MIMEMultipart('alternative')
    message.attach(msg_alternative)
    
    msg_html = MIMEText(body_html, 'html')
    msg_alternative.attach(msg_html)

    # Attach image inline
    msg_img = MIMEImage(qr_image_bytes)
    msg_img.add_header('Content-ID', '<qrcode_image>')
    msg_img.add_header('Content-Disposition', 'inline', filename='visitor_pass_qr.png')
    message.attach(msg_img)

    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, password)
        server.send_message(message)
        return True
    except Exception as e:
        print(f"SMTP Error for Visitor email: {e}")
        return False
    finally:
        try:
            server.quit()
        except:
            pass


class VisitorPassViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = VisitorPass.objects.all()
    serializer_class = VisitorPassSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    school_field = 'school'
    
    rbac_module = 'gatepass'
    rbac_resource = 'visitor_pass'
    rbac_action_permissions = {
        'list':            ['gatepass.view_visitor_pass', 'students.view_student_only', 'students.view_profile', 'students.view_journey'],
        'retrieve':        ['gatepass.view_visitor_pass', 'students.view_student_only', 'students.view_profile', 'students.view_journey'],
        'create':          ['gatepass.edit_visitor_pass', 'students.issue_pass'],
        'update':          ['gatepass.edit_visitor_pass', 'students.issue_pass'],
        'partial_update':  ['gatepass.edit_visitor_pass', 'students.issue_pass'],
        'destroy':         ['gatepass.edit_visitor_pass', 'students.issue_pass'],
        'scan':            ['gatepass.edit_visitor_pass', 'students.issue_pass'],
        'terminate':       ['gatepass.edit_visitor_pass', 'students.issue_pass'],
    }

    def get_queryset(self):
        from django.utils import timezone
        import pytz
        
        # 1. Find ACTIVE visitor passes that have expired
        expired_visitors = VisitorPass.objects.filter(
            status='ACTIVE',
            valid_until__lt=timezone.now()
        )
        
        # 2. Transition each to EXPIRED and send expiration warning email on-the-spot
        for vp in expired_visitors:
            vp.status = 'EXPIRED'
            vp.save()
            
            try:
                school_settings = vp.school.settings
                sender_email = school_settings.gatepass_sender_email
                password = school_settings.gatepass_app_password
                if sender_email and password and vp.email:
                    subject = "Your Visitor Pass Has Expired"
                    try:
                        school_tz = pytz.timezone(vp.school.timezone)
                        local_dt = vp.valid_until.astimezone(school_tz)
                    except Exception:
                        try:
                            school_tz = pytz.timezone('Asia/Kolkata')
                            local_dt = vp.valid_until.astimezone(school_tz)
                        except Exception:
                            local_dt = vp.valid_until
                    
                    expiry_time_str = local_dt.strftime("%d %b %Y, %I:%M %p")
                    body = (
                        f"Dear {vp.name},\n\n"
                        f"This is to notify you that your time as a visitor has passed by.\n"
                        f"Your Visitor Pass (ID: {vp.pass_id}) expired at {expiry_time_str}.\n\n"
                        f"Please prepare to leave the school campus immediately. Thank you for your cooperation.\n\n"
                        f"Regards,\nSchool Administration"
                    )
                    send_gatepass_email(sender_email, password, vp.email, subject, body)
            except Exception as e:
                print(f"[VISITOR] Error sending expiration email: {e}")

        queryset = super().get_queryset()
        
        # Filtering by status if provided in query params
        pass_status = self.request.query_params.get('status')
        if pass_status:
            queryset = queryset.filter(status=pass_status)
            
        return queryset.order_by('-requested_at')

    def perform_create(self, serializer):
        valid_until_param = self.request.data.get('valid_until')
        expiry_time_param = self.request.data.get('expiry_time')
        expiry_hours_param = self.request.data.get('expiry_hours')

        now = timezone.now()
        valid_until_dt = None

        if valid_until_param:
            try:
                from django.utils.dateparse import parse_datetime
                valid_until_dt = parse_datetime(str(valid_until_param))
            except Exception:
                pass

        if not valid_until_dt and expiry_time_param:
            try:
                parts = [int(p) for p in str(expiry_time_param).split(':')]
                if len(parts) >= 2:
                    import datetime, pytz
                    visitor_school = self.request.user.school
                    tz_str = getattr(visitor_school, 'timezone', 'Asia/Kolkata') if visitor_school else 'Asia/Kolkata'
                    try:
                        school_tz = pytz.timezone(tz_str)
                    except Exception:
                        school_tz = pytz.timezone('Asia/Kolkata')
                    
                    loc_now = now.astimezone(school_tz)
                    target_dt = loc_now.replace(hour=parts[0], minute=parts[1], second=0, microsecond=0)
                    if target_dt <= loc_now:
                        target_dt += datetime.timedelta(days=1)
                    valid_until_dt = target_dt
            except Exception:
                pass

        if not valid_until_dt and expiry_hours_param is not None:
            try:
                eh = float(expiry_hours_param)
                if eh > 0:
                    valid_until_dt = now + timedelta(hours=eh)
            except (ValueError, TypeError):
                pass

        if not valid_until_dt:
            valid_until_dt = now + timedelta(hours=2.0)


        expiry_hours = round((valid_until_dt - now).total_seconds() / 3600.0, 2)



        school = self.request.user.school
        if not school:
            from apps.schools.models import School
            school = School.objects.first()

        instance = serializer.save(
            issued_by=self.request.user,
            valid_until=valid_until_dt,
            school=school,
            status='ACTIVE'
        )

        
        # Generate MeCard payload
        # format: MECARD:N:Name;ADR:Address;NOTE:Purpose;EMAIL:email;TEL:phone;
        import pytz
        try:
            school_tz = pytz.timezone(school.timezone)
            local_dt = instance.valid_until.astimezone(school_tz)
        except Exception:
            try:
                school_tz = pytz.timezone('Asia/Kolkata')
                local_dt = instance.valid_until.astimezone(school_tz)
            except Exception:
                local_dt = instance.valid_until
                
        expiry_str = local_dt.strftime("%d %b %Y, %I:%M %p")
        issuer_name = self.request.user.full_name if self.request.user else "School Administration"
        mecard_payload = (
            f"MECARD:\n"
            f"N: {instance.name};\n"
            f"ADR: {instance.address};\n"
            f"TEL: {instance.phone_number};\n"
            f"EMAIL: {instance.email};\n"
            f"NOTE:\n"
            f"  - Purpose: {instance.purpose}\n"
            f"  - Issued By: {issuer_name}\n"
            f"  - Expiry: {expiry_str};;"
        )
        
        # Generate MeCard QR image in memory
        import qrcode
        import io
        
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(mecard_payload)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        img_byte_arr = io.BytesIO()
        qr_img.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Send Email with inline attachment
        try:
            school_settings = school.settings
            sender_email = school_settings.gatepass_sender_email
            password = school_settings.gatepass_app_password
            
            if sender_email and password and instance.email:
                subject = f"Visitor Pass Issued: {instance.name}"
                
                body_html = f"""
                <html>
                  <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <h2>Visitor Pass Generated</h2>
                    <p>Dear {instance.name},</p>
                    <p>A visitor pass has been recorded for you.</p>
                    <p style="background-color: #f3f4f6; padding: 12px; border-radius: 8px;">
                      <strong>Visitor ID (Pass ID):</strong> {instance.pass_id}<br/>
                      <strong>Purpose:</strong> {instance.purpose}<br/>
                      <strong>Expiry:</strong> {expiry_str}
                    </p>
                    <p style="color: #4b5563; font-weight: bold;">
                      This is the visitor ID issued to you. Please show this email / QR code to anyone in the campus who questions "who are you?".
                    </p>
                    <div style="margin-top: 20px;">
                      <img src="cid:qrcode_image" alt="Visitor Pass QR Code" style="border: 1px solid #e5e7eb; border-radius: 8px;"/>
                    </div>
                    <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                      Issued by: {issuer_name}
                    </p>
                  </body>
                </html>
                """
                
                send_visitor_pass_email(sender_email, password, instance.email, subject, body_html, img_byte_arr)
        except Exception as e:
            print(f"[VISITOR] Error generating/sending visitor pass email: {e}")

    @action(detail=True, methods=['post'])
    def scan(self, request, pk=None):
        gate_pass = self.get_object()
        
        if gate_pass.status != 'ACTIVE':
            return Response({'error': f'Pass is not active (Status: {gate_pass.status})'}, status=status.HTTP_400_BAD_REQUEST)
        
        if timezone.now() > gate_pass.valid_until:
            gate_pass.status = 'EXPIRED'
            gate_pass.save()
            return Response({'error': 'Pass expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        gate_pass.status = 'USED'
        gate_pass.scanned_by = request.user
        gate_pass.scanned_at = timezone.now()
        gate_pass.save()
        
        return Response(VisitorPassSerializer(gate_pass).data)
        
    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        gate_pass = self.get_object()
        
        if gate_pass.status in ['USED', 'EXPIRED', 'CANCELLED']:
            return Response({'error': f'Pass is already {gate_pass.status}'}, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason', '').strip() or 'No reason specified'
        gate_pass.cancellation_reason = reason
        gate_pass.status = 'CANCELLED'
        gate_pass.save()
        
        # Send cancellation email to visitor
        try:
            receiver_email = gate_pass.email
            if receiver_email:
                school_settings = gate_pass.school.settings
                sender_email = school_settings.gatepass_sender_email
                password = school_settings.gatepass_app_password
                
                if sender_email and password:
                    subject = "Your Visitor Pass Has Been Cancelled"
                    body = (
                        f"Dear {gate_pass.name},\n\n"
                        f"This is to notify you that your Visitor Pass (ID: {gate_pass.pass_id}) has been cancelled.\n\n"
                        f"Reason for Cancellation: {reason}\n\n"
                        f"This pass is no longer valid for entry or exit. Please contact the school gate administration if you have questions.\n\n"
                        f"Regards,\nSchool Administration"
                    )
                    send_gatepass_email(sender_email, password, receiver_email, subject, body)
        except Exception as e:
            print(f"[VISITOR] Error sending cancellation email: {e}")
        
        return Response(VisitorPassSerializer(gate_pass).data)

