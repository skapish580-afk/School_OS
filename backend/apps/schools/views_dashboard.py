"""
Dashboard Views for Admin Notes and Broadcast Notifications
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q

from apps.core.school_isolation import SchoolIsolationMixin
from .models_dashboard import AdminNote, BroadcastNotification, BroadcastReadReceipt
from .serializers_dashboard import (
    AdminNoteSerializer, 
    BroadcastNotificationSerializer,
    BroadcastReadReceiptSerializer,
    SendBroadcastSerializer
)


class AdminNoteViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    CRUD for admin notes on dashboard.
    Only shows notes created by the current user.
    """
    serializer_class = AdminNoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        user = self.request.user
        queryset = AdminNote.objects.filter(created_by=user)
        
        # Apply school filter
        if user.school:
            queryset = queryset.filter(school=user.school)
        
        return queryset.order_by('-is_pinned', '-created_at')
    
    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            school=self.request.user.school
        )
    
    @action(detail=True, methods=['post'])
    def toggle_pin(self, request, pk=None):
        """Toggle pinned status of a note"""
        note = self.get_object()
        note.is_pinned = not note.is_pinned
        note.save()
        return Response({'is_pinned': note.is_pinned})
    
    @action(detail=True, methods=['post'])
    def toggle_complete(self, request, pk=None):
        """Toggle completed status of a note"""
        note = self.get_object()
        note.is_completed = not note.is_completed
        note.save()
        return Response({'is_completed': note.is_completed})


class BroadcastNotificationViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    Manage broadcast notifications.
    School admins can send announcements to teachers/students.
    """
    serializer_class = BroadcastNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        user = self.request.user
        queryset = BroadcastNotification.objects.all()
        
        # Filter by school
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            school=self.request.user.school
        )
    
    @action(detail=False, methods=['post'])
    def send(self, request):
        """
        Send a broadcast notification immediately.
        POST /api/v1/schools/broadcasts/send/
        """
        serializer = SendBroadcastSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        user = request.user
        school = user.school
        
        if not school:
            return Response(
                {'error': 'You must be associated with a school to send broadcasts'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Count recipients
        recipients_count = self._count_recipients(school, data['audience'], data.get('target_grades', []))
        
        # Create the broadcast
        broadcast = BroadcastNotification.objects.create(
            school=school,
            created_by=user,
            title=data['title'],
            message=data['message'],
            audience=data['audience'],
            priority=data['priority'],
            target_grades=data.get('target_grades', []),
            scheduled_for=data.get('scheduled_for'),
            status='SENT' if not data.get('scheduled_for') else 'SCHEDULED',
            sent_at=timezone.now() if not data.get('scheduled_for') else None,
            recipients_count=recipients_count
        )
        
        # In a real app, you'd queue notifications here for push/email/SMS delivery
        # For now, we just create the record
        
        return Response({
            'success': True,
            'broadcast_id': str(broadcast.id),
            'recipients_count': recipients_count,
            'status': broadcast.status,
            'message': f'Notification sent to {recipients_count} recipients'
        }, status=status.HTTP_201_CREATED)
    
    def _count_recipients(self, school, audience, target_grades):
        """Count how many users will receive this broadcast"""
        from apps.accounts.models import User
        
        count = 0
        
        if audience in ['TEACHERS', 'BOTH', 'ALL']:
            teachers = User.objects.filter(school=school, user_type='TEACHER')
            count += teachers.count()
        
        if audience in ['STUDENTS', 'BOTH', 'ALL']:
            students = User.objects.filter(school=school, user_type='STUDENT')
            if target_grades:
                # Filter by grades - would need enrollment data
                pass
            count += students.count()
        
        if audience == 'ALL':
            # Include parents too
            parents = User.objects.filter(school=school, user_type='PARENT')
            count += parents.count()
        
        return count
    
    @action(detail=True, methods=['get'])
    def read_receipts(self, request, pk=None):
        """Get read receipts for a broadcast"""
        broadcast = self.get_object()
        receipts = broadcast.read_receipts.all().select_related('user')
        serializer = BroadcastReadReceiptSerializer(receipts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a broadcast as read by current user"""
        broadcast = self.get_object()
        user = request.user
        
        receipt, created = BroadcastReadReceipt.objects.get_or_create(
            broadcast=broadcast,
            user=user
        )
        
        if created:
            # Update read count
            broadcast.read_count = broadcast.read_receipts.count()
            broadcast.save()
        
        return Response({
            'success': True,
            'already_read': not created,
            'read_at': receipt.read_at
        })
    
    @action(detail=False, methods=['get'])
    def my_notifications(self, request):
        """
        Get broadcasts relevant to the current user based on their role.
        For teachers: TEACHERS, BOTH, ALL
        For students: STUDENTS, BOTH, ALL
        For school admins: ALL broadcasts they have access to
        """
        user = request.user
        school = user.school
        
        if not school:
            return Response([])
        
        # Determine which audiences apply to this user
        audiences = ['ALL']
        if user.user_type == 'TEACHER':
            audiences.extend(['TEACHERS', 'BOTH'])
        elif user.user_type == 'STUDENT':
            audiences.extend(['STUDENTS', 'BOTH'])
        elif user.user_type == 'PARENT':
            audiences.extend(['PARENTS', 'ALL'])
        elif user.user_type in ['SCHOOL_ADMIN', 'PLATFORM_ADMIN']:
            # Admins can see all notifications
            audiences = ['TEACHERS', 'STUDENTS', 'BOTH', 'ALL', 'PARENTS']
        
        broadcasts = BroadcastNotification.objects.filter(
            school=school,
            audience__in=audiences,
            status='SENT'
        ).order_by('-sent_at')[:20]
        
        # Add read status for each
        data = []
        for bc in broadcasts:
            bc_data = BroadcastNotificationSerializer(bc).data
            bc_data['is_read'] = BroadcastReadReceipt.objects.filter(
                broadcast=bc, user=user
            ).exists()
            data.append(bc_data)
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications for current user"""
        user = request.user
        school = user.school
        
        if not school:
            return Response({'count': 0})
        
        # Determine audiences
        audiences = ['ALL']
        if user.user_type == 'TEACHER':
            audiences.extend(['TEACHERS', 'BOTH'])
        elif user.user_type == 'STUDENT':
            audiences.extend(['STUDENTS', 'BOTH'])
        elif user.user_type in ['SCHOOL_ADMIN', 'PLATFORM_ADMIN']:
            audiences = ['TEACHERS', 'STUDENTS', 'BOTH', 'ALL', 'PARENTS']
        
        total = BroadcastNotification.objects.filter(
            school=school,
            audience__in=audiences,
            status='SENT'
        ).count()
        
        read = BroadcastReadReceipt.objects.filter(
            broadcast__school=school,
            broadcast__audience__in=audiences,
            broadcast__status='SENT',
            user=user
        ).count()
        
        return Response({'count': total - read})
