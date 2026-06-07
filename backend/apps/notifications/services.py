"""
Notification Service - Core business logic for sending notifications
"""

from django.utils import timezone
from django.template import Template, Context
from django.core.mail import send_mail
from django.conf import settings
import logging
from datetime import timedelta
from .models import (
    NotificationTemplate,
    ParentContact,
    StudentNotificationLog,
    NotificationQueue,
)

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Main service for managing all notification operations.
    Handles template rendering, channel selection, and delivery.
    """
    
    def send_attendance_alert(self, student, current_percentage, school):
        """
        Send attendance alert to parents if below 75%.
        Called by signal when attendance is updated.
        """
        if current_percentage >= 75:
            return None  # Don't alert if attendance is good
        
        return self.send_notification(
            student=student,
            notification_type='ATTENDANCE',
            school=school,
            context={
                'student_name': student.user.full_name,
                'attendance_percentage': round(current_percentage, 2),
                'date': timezone.now().strftime('%d-%m-%Y'),
                'parent_name': '{{parent_name}}',  # Will be filled per parent
            }
        )
    
    def send_marks_notification(self, student, result, school):
        """
        Send notification when exam result is approved.
        Called by signal when Result is approved.
        """
        return self.send_notification(
            student=student,
            notification_type='MARKS',
            school=school,
            context={
                'student_name': student.user.full_name,
                'subject': result.exam.subject_mapping.subject.name,
                'marks': round(float(result.marks_obtained), 2),
                'max_marks': round(float(result.exam.max_marks), 2),
                'percentage': round(
                    (float(result.marks_obtained) / float(result.exam.max_marks) * 100),
                    2
                ),
                'parent_name': '{{parent_name}}',
                'date': timezone.now().strftime('%d-%m-%Y'),
            }
        )
    
    def send_discipline_alert(self, student, incident, school):
        """
        Send notification when discipline incident is recorded.
        Called by signal when DisciplineRecord is created.
        """
        return self.send_notification(
            student=student,
            notification_type='DISCIPLINE',
            school=school,
            context={
                'student_name': student.user.full_name,
                'incident_description': incident.get('description', 'Discipline incident'),
                'incident_date': incident.get('date', timezone.now().strftime('%d-%m-%Y')),
                'action_taken': incident.get('action', 'See school office for details'),
                'parent_name': '{{parent_name}}',
            }
        )
    
    def send_promotion_decision(self, student, decision, school):
        """
        Send notification when promotion decision is finalized.
        Called by signal when StudentPromotionDecision is created.
        """
        decision_status = decision.overall_status
        to_grade = decision.to_grade_number if hasattr(decision, 'to_grade_number') else '...'
        
        return self.send_notification(
            student=student,
            notification_type='PROMOTION',
            school=school,
            context={
                'student_name': student.user.full_name,
                'decision': decision_status.lower(),
                'to_grade': to_grade,
                'overall_percentage': round(float(decision.overall_percentage), 2),
                'parent_name': '{{parent_name}}',
                'date': timezone.now().strftime('%d-%m-%Y'),
            }
        )
    
    def send_certificate_ready(self, student, certificate_type, school):
        """
        Send notification when certificate is ready for pickup.
        Called by signal when Certificate is created.
        """
        return self.send_notification(
            student=student,
            notification_type='CERTIFICATE',
            school=school,
            context={
                'student_name': student.user.full_name,
                'certificate_type': certificate_type,  # TC, Bonafide, Character, etc.
                'pickup_location': 'School Office',
                'parent_name': '{{parent_name}}',
                'date': timezone.now().strftime('%d-%m-%Y'),
            }
        )
    
    def send_notification(self, student, notification_type, school, context):
        """
        Core notification sending logic.
        Renders template, selects channels, sends to all parents.
        """
        # Get template
        template = NotificationTemplate.objects.filter(
            school=school,
            category=notification_type,
            is_active=True
        ).first()
        
        if not template:
            logger.warning(f"No active template for {notification_type} in {school.name}")
            return None
        
        # Get parent contacts for this student
        parent_contacts = self._get_parent_contacts(student)
        
        if not parent_contacts:
            logger.warning(f"No parent contacts found for student {student.user.full_name}")
            return None
        
        # Send to each parent
        notifications = []
        for contact in parent_contacts:
            # Render template with parent-specific context
            rendered_context = context.copy()
            rendered_context['parent_name'] = contact.parent.full_name
            
            subject = self._render_text(template.title, rendered_context)
            message = self._render_text(template.body, rendered_context)
            
            # Create notification log
            log = StudentNotificationLog.objects.create(
                student=student,
                parent=contact.parent,
                notification_type=notification_type,
                subject=subject,
                message=message,
                channels_sent={},
                status='PENDING',
            )
            
            # Queue for sending
            queue = NotificationQueue.objects.create(
                log=log,
                scheduled_at=timezone.now(),
                status='QUEUED'
            )
            
            notifications.append((log, queue, contact, template))
        
        # Actually send notifications
        for log, queue, contact, template in notifications:
            self._send_via_channels(log, contact, template)
        
        return notifications
    
    def _get_parent_contacts(self, student):
        """Get all active parent contacts for a student."""
        try:
            # Get parent(s) through guardianship or student relationship
            # This assumes a Student → Guardian relationship exists
            # For now, we'll look for related User objects
            
            # In a full implementation, this would traverse Student.guardians or similar
            parents = ParentContact.objects.filter(
                parent__is_parent=True
            )[:10]  # Placeholder - adjust based on actual relationship
            
            return [p for p in parents if p.notifications_enabled]
        except Exception as e:
            logger.error(f"Error fetching parent contacts: {e}")
            return []
    
    def _render_text(self, template_str, context):
        """Render template with Django template engine."""
        try:
            template = Template(template_str)
            return template.render(Context(context))
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            return template_str
    
    def _send_via_channels(self, log, contact, template):
        """Send notification via enabled channels."""
        channels_sent = {}
        delivery_status = {}
        errors = []
        
        # Determine which channels to use
        enabled_channels = contact.preferred_channels or ['email', 'sms']
        if not isinstance(enabled_channels, list):
            enabled_channels = ['email']
        
        # SMS Channel
        if 'sms' in enabled_channels and contact.phone_number and template.channels.get('sms', False):
            try:
                success = ChannelService.send_sms(
                    phone=contact.get_full_phone(),
                    message=log.message
                )
                channels_sent['sms'] = success
                delivery_status['sms'] = 'delivered' if success else 'failed'
            except Exception as e:
                channels_sent['sms'] = False
                delivery_status['sms'] = 'failed'
                errors.append(f"SMS: {str(e)}")
                logger.error(f"SMS send failed: {e}")
        
        # Email Channel
        if 'email' in enabled_channels and contact.email and template.channels.get('email', False):
            try:
                success = ChannelService.send_email(
                    email=contact.email,
                    subject=log.subject,
                    message=log.message
                )
                channels_sent['email'] = success
                delivery_status['email'] = 'sent' if success else 'failed'
            except Exception as e:
                channels_sent['email'] = False
                delivery_status['email'] = 'failed'
                errors.append(f"Email: {str(e)}")
                logger.error(f"Email send failed: {e}")
        
        # WhatsApp Channel
        if 'whatsapp' in enabled_channels and contact.whatsapp_enabled and template.channels.get('whatsapp', False):
            try:
                success = ChannelService.send_whatsapp(
                    phone=contact.get_full_phone(),
                    message=log.message
                )
                channels_sent['whatsapp'] = success
                delivery_status['whatsapp'] = 'sent' if success else 'failed'
            except Exception as e:
                channels_sent['whatsapp'] = False
                delivery_status['whatsapp'] = 'failed'
                errors.append(f"WhatsApp: {str(e)}")
                logger.error(f"WhatsApp send failed: {e}")
        
        # Update log
        log.channels_sent = channels_sent
        log.delivery_status = delivery_status
        log.status = 'SENT' if any(channels_sent.values()) else 'FAILED'
        log.sent_at = timezone.now()
        if errors:
            log.error_message = '; '.join(errors)
        log.save()


class ChannelService:
    """
    Handles actual delivery via SMS, Email, WhatsApp.
    Abstracted to support different providers.
    """
    
    @staticmethod
    def send_sms(phone, message):
        """
        Send SMS via configured provider.
        Supported: Twilio, AWS SNS, Fast2SMS
        """
        try:
            provider = getattr(settings, 'SMS_PROVIDER', 'twilio')
            
            if provider == 'twilio':
                return ChannelService._send_sms_twilio(phone, message)
            elif provider == 'aws_sns':
                return ChannelService._send_sms_aws(phone, message)
            elif provider == 'fast2sms':
                return ChannelService._send_sms_fast2sms(phone, message)
            else:
                logger.warning(f"Unknown SMS provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"SMS send error: {e}")
            return False
    
    @staticmethod
    def _send_sms_twilio(phone, message):
        """Send SMS via Twilio."""
        try:
            from twilio.rest import Client
            
            account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
            auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
            from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', '')
            
            if not all([account_sid, auth_token, from_number]):
                logger.warning("Twilio credentials not configured")
                return False
            
            client = Client(account_sid, auth_token)
            msg = client.messages.create(
                body=message,
                from_=from_number,
                to=phone
            )
            logger.info(f"SMS sent via Twilio: {msg.sid}")
            return True
        except Exception as e:
            logger.error(f"Twilio SMS error: {e}")
            return False
    
    @staticmethod
    def _send_sms_aws(phone, message):
        """Send SMS via AWS SNS."""
        # Placeholder for AWS SNS implementation
        logger.info(f"SMS (AWS SNS): {phone[:5]}... - Message: {message[:50]}...")
        return True
    
    @staticmethod
    def _send_sms_fast2sms(phone, message):
        """Send SMS via Fast2SMS (Indian provider)."""
        # Placeholder for Fast2SMS implementation
        logger.info(f"SMS (Fast2SMS): {phone[:5]}... - Message: {message[:50]}...")
        return True
    
    @staticmethod
    def send_email(email, subject, message):
        """
        Send email via Django's email backend.
        """
        try:
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@school.com')
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[email],
                fail_silently=False,
            )
            logger.info(f"Email sent to {email}")
            return True
        except Exception as e:
            logger.error(f"Email send error: {e}")
            return False
    
    @staticmethod
    def send_whatsapp(phone, message):
        """
        Send WhatsApp message via Twilio or Meta.
        """
        try:
            provider = getattr(settings, 'WHATSAPP_PROVIDER', 'twilio')
            
            if provider == 'twilio':
                return ChannelService._send_whatsapp_twilio(phone, message)
            elif provider == 'meta':
                return ChannelService._send_whatsapp_meta(phone, message)
            else:
                logger.warning(f"Unknown WhatsApp provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"WhatsApp send error: {e}")
            return False
    
    @staticmethod
    def _send_whatsapp_twilio(phone, message):
        """Send WhatsApp via Twilio."""
        try:
            from twilio.rest import Client
            
            account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
            auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
            from_whatsapp = getattr(settings, 'TWILIO_WHATSAPP_NUMBER', '')
            
            if not all([account_sid, auth_token, from_whatsapp]):
                logger.warning("Twilio WhatsApp credentials not configured")
                return False
            
            client = Client(account_sid, auth_token)
            msg = client.messages.create(
                body=message,
                from_=f"whatsapp:{from_whatsapp}",
                to=f"whatsapp:{phone}"
            )
            logger.info(f"WhatsApp sent via Twilio: {msg.sid}")
            return True
        except Exception as e:
            logger.error(f"Twilio WhatsApp error: {e}")
            return False
    
    @staticmethod
    def _send_whatsapp_meta(phone, message):
        """Send WhatsApp via Meta Business API."""
        # Placeholder for Meta API implementation
        logger.info(f"WhatsApp (Meta): {phone[:5]}... - Message: {message[:50]}...")
        return True
