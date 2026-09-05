from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import StudentHealthProfile, ClinicVisit
from .serializers import HealthProfileSerializer, ClinicVisitSerializer
from apps.accounts.permission_utils import RBACPermission
from apps.core.school_isolation import SchoolIsolationMixin

from rest_framework import permissions

class HealthActionPermission(permissions.BasePermission):
    """
    Custom permission for StudentHealthProfile and ClinicVisit:
    - All actions require students.view_health or admin.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        from apps.accounts.permission_utils import has_permission
        return has_permission(user, 'students.view_health')

    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False
        return True



class HealthProfileViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = StudentHealthProfile.objects.all()
    serializer_class = HealthProfileSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    school_field = 'student__school'
    rbac_module = 'health'
    rbac_resource = 'health'
    rbac_action_permissions = {
        'list':           ['health.view_health', 'students.view_health'],
        'retrieve':       ['health.view_health', 'students.view_health'],
        'create':         'health.add_health',
        'update':         'health.add_health',
        'partial_update': 'health.add_health',
        'destroy':        'health.add_health',
    }

    def get_permissions(self):
        if (self.action in ['list', 'retrieve', 'student_health']) and self.request.user and self.request.user.user_type == 'STUDENT':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['student_health'] or (self.action in ['list', 'retrieve'] and request.user and request.user.user_type == 'STUDENT'):
            return
        super().check_permissions(request)


    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        return queryset

    @action(detail=False, methods=['get'])
    def student_health(self, request):
        user = request.user
        from apps.students.models import Student
        from apps.health.models import StudentHealthProfile, ClinicVisit

        student = Student.objects.filter(user=user).first()
        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found.'}, status=404)

        profile = StudentHealthProfile.objects.filter(student=student).first()
        visits = ClinicVisit.objects.filter(student=student).order_by('-visit_date')

        visits_data = []
        for v in visits:
            nurse_name = v.nurse.get_full_name().strip() if v.nurse else "School Nurse"
            visits_data.append({
                'id': str(v.id),
                'visit_date': str(v.visit_date),
                'symptom': v.symptom,
                'treatment_given': v.treatment_given,
                'sent_home': v.sent_home,
                'nurse_name': nurse_name
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
            'blood_group': profile.blood_group if profile else 'Not Recorded',
            'height_cm': profile.height_cm if profile else None,
            'weight_kg': profile.weight_kg if profile else None,
            'allergies': profile.allergies if (profile and profile.allergies) else 'None Reported',
            'chronic_conditions': profile.chronic_conditions if (profile and profile.chronic_conditions) else 'None Reported',
            'emergency_contact_phone': profile.emergency_contact_phone if (profile and profile.emergency_contact_phone) else 'Not Recorded',
            'visits': visits_data
        }, status=status.HTTP_200_OK)


class ClinicVisitViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = ClinicVisit.objects.all()
    serializer_class = ClinicVisitSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    school_field = 'student__school'
    rbac_module = 'health'
    rbac_resource = 'health'
    rbac_action_permissions = {
        'list':           ['health.view_health', 'students.view_health'],
        'retrieve':       ['health.view_health', 'students.view_health'],
        'create':         'health.add_health',
        'update':         'health.add_health',
        'partial_update': 'health.add_health',
        'destroy':        'health.add_health',
        'recent':         ['health.view_health', 'students.view_health'],
        'sent_home_today': ['health.view_health', 'students.view_health'],
    }

    def get_permissions(self):
        if (self.action in ['list', 'retrieve']) and self.request.user and self.request.user.user_type == 'STUDENT':
            return [IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action in ['list', 'retrieve'] and request.user and request.user.user_type == 'STUDENT':
            return
        super().check_permissions(request)


    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        return queryset.order_by('-visit_date')
    
    def perform_create(self, serializer):
        serializer.save(nurse=self.request.user)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        from datetime import timedelta
        from django.utils import timezone
        
        thirty_days_ago = timezone.now() - timedelta(days=30)
        visits = self.get_queryset().filter(visit_date__gte=thirty_days_ago)
        serializer = self.get_serializer(visits, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def sent_home_today(self, request):
        from django.utils import timezone
        today = timezone.now().date()
        visits = self.get_queryset().filter(
            visit_date__date=today,
            sent_home=True
        )
        serializer = self.get_serializer(visits, many=True)
        return Response(serializer.data)