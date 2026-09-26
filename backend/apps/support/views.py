from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from django.utils import timezone

from .models import SupportTicket, TicketMessage
from .serializers import (
    SupportTicketListSerializer,
    SupportTicketDetailSerializer,
    SupportTicketCreateSerializer,
    TicketMessageSerializer,
    SchoolHierarchySerializer,
    TeacherHierarchySerializer,
    StudentHierarchySerializer
)
from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.students.models import Student


def is_super_admin(user):
    if not user or not user.is_authenticated:
        return False
    return getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False) or getattr(user, 'role', '') in ['SUPER_ADMIN', 'OWNER', 'PLATFORM_ADMIN']


class SupportTicketViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create']:
            return SupportTicketCreateSerializer
        elif self.action in ['retrieve']:
            return SupportTicketDetailSerializer
        return SupportTicketListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = SupportTicket.objects.select_related('school', 'user', 'assigned_admin').prefetch_related('messages')
        
        if is_super_admin(user):
            # Super admins see all tickets with rich filtering
            school_id = self.request.query_params.get('school_id')
            status_param = self.request.query_params.get('status')
            severity = self.request.query_params.get('severity')
            user_role = self.request.query_params.get('user_role')
            search = self.request.query_params.get('search')

            if school_id:
                qs = qs.filter(school_id=school_id)
            if status_param:
                qs = qs.filter(status=status_param)
            if severity:
                qs = qs.filter(severity=severity)
            if user_role:
                qs = qs.filter(user_role=user_role)
            if search:
                qs = qs.filter(
                    Q(ticket_number__icontains=search) |
                    Q(title__icontains=search) |
                    Q(description__icontains=search) |
                    Q(user_name__icontains=search) |
                    Q(user_email__icontains=search)
                )
            return qs
        else:
            # Regular users only see their own tickets
            return qs.filter(user=user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        
        # Mark messages as read based on viewer role
        if is_super_admin(user):
            instance.messages.filter(is_admin_reply=False, is_read_by_admin=False).update(is_read_by_admin=True)
        else:
            instance.messages.filter(is_admin_reply=True, is_read_by_user=False).update(is_read_by_user=True)
            
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_message(self, request, pk=None):
        ticket = self.get_object()
        user = request.user
        is_admin = is_super_admin(user)

        # Check access permission
        if not is_admin and ticket.user != user:
            return Response({'error': 'You do not have access to this ticket'}, status=status.HTTP_403_FORBIDDEN)

        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'error': 'Message content cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

        sender_name = user.get_full_name() or user.username or user.email
        sender_role = 'Support Team' if is_admin else (getattr(user, 'role', '') or 'User')

        msg = TicketMessage.objects.create(
            ticket=ticket,
            sender=user,
            sender_name=sender_name,
            sender_role=sender_role,
            is_admin_reply=is_admin,
            message=message_text,
            is_read_by_admin=is_admin,
            is_read_by_user=(not is_admin)
        )

        # If admin replied and ticket was OPEN, switch to INVESTIGATING
        if is_admin and ticket.status == 'OPEN':
            ticket.status = 'INVESTIGATING'
            ticket.save(update_fields=['status', 'updated_at'])

        serializer = TicketMessageSerializer(msg)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        if not is_super_admin(request.user):
            return Response({'error': 'Only system administrators can update ticket status'}, status=status.HTTP_403_FORBIDDEN)

        ticket = self.get_object()
        new_status = request.data.get('status')
        new_severity = request.data.get('severity')
        admin_notes = request.data.get('admin_notes')

        if new_status and new_status in dict(SupportTicket.STATUS_CHOICES):
            ticket.status = new_status
            if new_status in ['RESOLVED', 'CLOSED'] and not ticket.resolved_at:
                ticket.resolved_at = timezone.now()
            elif new_status in ['OPEN', 'INVESTIGATING']:
                ticket.resolved_at = None

        if new_severity and new_severity in dict(SupportTicket.SEVERITY_CHOICES):
            ticket.severity = new_severity

        if admin_notes is not None:
            ticket.admin_notes = admin_notes

        ticket.save()
        serializer = SupportTicketDetailSerializer(ticket, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'unread_count': 0})

        if is_super_admin(user):
            count = TicketMessage.objects.filter(is_admin_reply=False, is_read_by_admin=False).count()
        else:
            count = TicketMessage.objects.filter(ticket__user=user, is_admin_reply=True, is_read_by_user=False).count()

        return Response({'unread_count': count})

    @action(detail=False, methods=['get'])
    def platform_stats(self, request):
        if not is_super_admin(request.user):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        total_schools = School.objects.count()
        total_teachers = Teacher.objects.filter(user__is_active=True).count() if Teacher.objects.exists() else 0
        total_students = Student.objects.filter(status='ACTIVE').count() if Student.objects.exists() else 0

        open_tickets = SupportTicket.objects.filter(status='OPEN').count()
        investigating_tickets = SupportTicket.objects.filter(status='INVESTIGATING').count()
        resolved_tickets = SupportTicket.objects.filter(status__in=['RESOLVED', 'CLOSED']).count()
        critical_tickets = SupportTicket.objects.filter(severity='CRITICAL', status__in=['OPEN', 'INVESTIGATING']).count()

        # Category breakdown
        category_counts = SupportTicket.objects.values('category').annotate(count=Count('id')).order_by('-count')

        return Response({
            'total_schools': total_schools,
            'total_teachers': total_teachers,
            'total_students': total_students,
            'tickets': {
                'open': open_tickets,
                'investigating': investigating_tickets,
                'resolved': resolved_tickets,
                'critical': critical_tickets,
                'total': open_tickets + investigating_tickets + resolved_tickets
            },
            'category_breakdown': category_counts
        })


class SupportHierarchyViewSet(viewsets.ViewSet):
    """
    Super Admin hierarchy explorer:
    1. List all schools
    2. List all teachers of a school
    3. List all students of a school
    """
    permission_classes = [permissions.IsAuthenticated]

    def check_admin(self, request):
        if not is_super_admin(request.user):
            return False
        return True

    @action(detail=False, methods=['get'])
    def schools(self, request):
        if not self.check_admin(request):
            return Response({'error': 'SuperAdmin permissions required'}, status=status.HTTP_403_FORBIDDEN)
        
        search = request.query_params.get('search', '').strip()
        qs = School.objects.all().order_by('display_name', 'legal_name')
        if search:
            qs = qs.filter(Q(display_name__icontains=search) | Q(legal_name__icontains=search) | Q(code__icontains=search))
        
        serializer = SchoolHierarchySerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def teachers(self, request, pk=None):
        if not self.check_admin(request):
            return Response({'error': 'SuperAdmin permissions required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            school = School.objects.get(pk=pk)
        except School.DoesNotExist:
            return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)

        search = request.query_params.get('search', '').strip()
        from apps.teachers.models import TeacherSchoolAssociation
        teacher_ids = TeacherSchoolAssociation.objects.filter(school=school).values_list('teacher_id', flat=True)
        teachers = Teacher.objects.filter(Q(id__in=teacher_ids) | Q(user__school=school)).select_related('user').order_by('user__first_name')
        if search:
            teachers = teachers.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__email__icontains=search) |
                Q(tuid__icontains=search)
            )

        serializer = TeacherHierarchySerializer(teachers, many=True)
        return Response({
            'school_id': school.id,
            'school_name': school.name,
            'school_code': school.code,
            'teachers': serializer.data
        })

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        if not self.check_admin(request):
            return Response({'error': 'SuperAdmin permissions required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            school = School.objects.get(pk=pk)
        except School.DoesNotExist:
            return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)

        search = request.query_params.get('search', '').strip()
        students = Student.objects.filter(school=school).select_related('user').order_by('user__first_name')
        if search:
            students = students.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__email__icontains=search) |
                Q(admission_number__icontains=search) |
                Q(suid__icontains=search)
            )

        serializer = StudentHierarchySerializer(students, many=True)
        return Response({
            'school_id': school.id,
            'school_name': school.name,
            'school_code': school.code,
            'students': serializer.data
        })
