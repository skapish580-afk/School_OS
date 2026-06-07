"""
Notification API Views
"""

from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q

from .models import NotificationTemplate, ParentContact, StudentNotificationLog
from .serializers import (
    NotificationTemplateSerializer, 
    ParentContactSerializer,
    StudentNotificationLogSerializer,
    SendTestNotificationSerializer
)
from .services import NotificationService
from apps.students.models import Student

import logging
logger = logging.getLogger(__name__)


class NotificationTemplateListView(generics.ListCreateAPIView):
    """
    GET: List all notification templates for the user's school.
    POST: Create a new notification template.
    """
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Filter by school if user has one
        if hasattr(user, 'school') and user.school:
            return NotificationTemplate.objects.filter(
                Q(school=user.school) | Q(school__isnull=True)
            ).order_by('category')
        return NotificationTemplate.objects.filter(school__isnull=True).order_by('category')
    
    def perform_create(self, serializer):
        # Auto-assign school if user has one
        user = self.request.user
        if hasattr(user, 'school') and user.school:
            serializer.save(school=user.school)
        else:
            serializer.save()


class NotificationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Retrieve a notification template.
    PUT/PATCH: Update a notification template.
    DELETE: Delete a notification template.
    """
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'school') and user.school:
            return NotificationTemplate.objects.filter(
                Q(school=user.school) | Q(school__isnull=True)
            )
        return NotificationTemplate.objects.filter(school__isnull=True)


class NotificationLogListView(generics.ListAPIView):
    """
    GET: List all notification logs (paginated).
    """
    serializer_class = StudentNotificationLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = StudentNotificationLog.objects.all()
        
        # Filter by school if user has one
        if hasattr(user, 'school') and user.school:
            queryset = queryset.filter(student__school=user.school)
        
        # Filter by notification type
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')[:100]


class StudentNotificationLogView(generics.ListAPIView):
    """
    GET: List all notifications sent for a specific student.
    """
    serializer_class = StudentNotificationLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        student_id = self.kwargs.get('student_id')
        return StudentNotificationLog.objects.filter(
            student_id=student_id
        ).order_by('-created_at')[:50]


class ParentPreferencesView(APIView):
    """
    GET: Get current user's notification preferences (if parent).
    PUT: Update notification preferences.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        try:
            contact = ParentContact.objects.get(parent=user)
            serializer = ParentContactSerializer(contact)
            return Response(serializer.data)
        except ParentContact.DoesNotExist:
            return Response(
                {'detail': 'No notification preferences found. You may not be registered as a parent.'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def put(self, request):
        user = request.user
        try:
            contact = ParentContact.objects.get(parent=user)
        except ParentContact.DoesNotExist:
            return Response(
                {'detail': 'No notification preferences found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = ParentContactSerializer(contact, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SendTestNotificationView(APIView):
    """
    POST: Send a test notification to a student's parents.
    For admin/staff testing purposes.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = SendTestNotificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        student_id = serializer.validated_data['student_id']
        notification_type = serializer.validated_data['notification_type']
        custom_message = serializer.validated_data.get('message', '')
        
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response(
                {'detail': f'Student with ID {student_id} not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        service = NotificationService()
        
        # Build test context based on type
        context = {
            'student_name': student.user.full_name if hasattr(student.user, 'full_name') else str(student.user),
            'school_name': student.school.name if student.school else 'Test School',
            'test_message': custom_message or 'This is a test notification.',
        }
        
        try:
            # Send test notification
            log = service.send_notification(
                student=student,
                notification_type=notification_type,
                context=context,
                school=student.school
            )
            
            if log:
                return Response({
                    'success': True,
                    'message': f'Test notification sent successfully.',
                    'log_id': log.id,
                    'channels_sent': log.channels_sent,
                    'status': log.status
                })
            else:
                return Response({
                    'success': False,
                    'message': 'No parent contacts found or notification service returned no log.'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error sending test notification: {e}")
            return Response({
                'success': False,
                'message': f'Error sending notification: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
