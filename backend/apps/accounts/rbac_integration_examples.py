"""
RBAC Integration Examples for School-OS
=========================================

This file contains examples showing how to integrate the RBAC permission
system with existing views. Use these patterns to protect your endpoints.

Example 1: Using the @require_permission decorator
Example 2: Using PermissionRequiredMixin for class-based views
Example 3: Manual permission checking in view methods
Example 4: Combining with school isolation
"""

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

# Import RBAC utilities
from apps.accounts.permission_utils import (
    require_permission,
    require_any_permission,
    PermissionRequiredMixin,
    has_permission,
    get_user_permissions,
)
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school


# =============================================================================
# Example 1: Using @require_permission decorator on individual actions
# =============================================================================

class StudentViewSetWithRBAC(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    Example showing permission decorators on view actions.
    The decorator will automatically check permissions before the action runs.
    """
    
    # ... your existing queryset and serializer setup ...
    
    @require_permission('students.view_student')
    def list(self, request, *args, **kwargs):
        """List students - requires students.view_student permission."""
        return super().list(request, *args, **kwargs)
    
    @require_permission('students.view_student')
    def retrieve(self, request, *args, **kwargs):
        """Get single student - requires students.view_student permission."""
        return super().retrieve(request, *args, **kwargs)
    
    @require_permission('students.create_student')
    def create(self, request, *args, **kwargs):
        """Create student - requires students.create_student permission."""
        return super().create(request, *args, **kwargs)
    
    @require_permission('students.edit_student')
    def update(self, request, *args, **kwargs):
        """Update student - requires students.edit_student permission."""
        return super().update(request, *args, **kwargs)
    
    @require_permission('students.edit_student')
    def partial_update(self, request, *args, **kwargs):
        """Partial update - requires students.edit_student permission."""
        return super().partial_update(request, *args, **kwargs)
    
    @require_permission('students.delete_student')  # Sensitive permission
    def destroy(self, request, *args, **kwargs):
        """Delete student - requires students.delete_student permission (sensitive)."""
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    @require_permission('students.export_students')
    def export_csv(self, request):
        """Export students to CSV - requires students.export_students permission."""
        # ... export logic ...
        return Response({'message': 'Export started'})


# =============================================================================
# Example 2: Using @require_any_permission for flexible access
# =============================================================================

class ReportViewSet(viewsets.ViewSet):
    """
    Example showing how to allow access if user has ANY of multiple permissions.
    """
    
    @require_any_permission(['reports.view_analytics', 'reports.generate_reports'])
    def list(self, request):
        """
        View reports - user needs EITHER:
        - reports.view_analytics OR
        - reports.generate_reports
        """
        return Response({'reports': []})


# =============================================================================
# Example 3: Using PermissionRequiredMixin for entire ViewSet
# =============================================================================

class FinanceViewSet(PermissionRequiredMixin, SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    Example using mixin to enforce permission for entire viewset.
    Uses permission mapping to assign different permissions to different actions.
    """
    
    # Map actions to required permissions
    permission_map = {
        'list': 'finance.view_fees',
        'retrieve': 'finance.view_fees',
        'create': 'finance.collect_fees',
        'update': 'finance.manage_fee_structure',
        'destroy': 'finance.manage_fee_structure',
    }
    
    # ... your existing queryset and serializer setup ...


# =============================================================================
# Example 4: Manual permission checking for complex logic
# =============================================================================

class ExamViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    Example showing manual permission checking for complex business logic.
    """
    
    def publish_results(self, request, pk=None):
        """
        Publish exam results - complex permission checking.
        """
        user = request.user
        school = get_user_school(user)
        
        # Check if user can publish results
        if not has_permission(user, 'academics.publish_results', school):
            return Response(
                {'error': 'You do not have permission to publish results'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Additional check: user must also have view permission
        if not has_permission(user, 'academics.view_marks', school):
            return Response(
                {'error': 'You cannot publish results without viewing them first'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all permissions for audit logging
        user_permissions = get_user_permissions(user, school)
        
        # ... publish logic ...
        
        return Response({
            'message': 'Results published successfully',
            'published_by_permissions': list(user_permissions)
        })


# =============================================================================
# Example 5: Conditional UI elements based on permissions
# =============================================================================

class DashboardViewSet(viewsets.ViewSet):
    """
    Example showing how to return permission-aware data for UI.
    """
    
    def list(self, request):
        """
        Return dashboard data with user's available actions.
        Frontend can use this to show/hide buttons.
        """
        user = request.user
        school = get_user_school(user)
        
        # Build available actions based on permissions
        available_actions = {
            'students': {
                'can_view': has_permission(user, 'students.view_student', school),
                'can_create': has_permission(user, 'students.create_student', school),
                'can_edit': has_permission(user, 'students.edit_student', school),
                'can_delete': has_permission(user, 'students.delete_student', school),
                'can_export': has_permission(user, 'students.export_students', school),
            },
            'attendance': {
                'can_view': has_permission(user, 'attendance.view_attendance', school),
                'can_mark': has_permission(user, 'attendance.mark_attendance', school),
                'can_approve': has_permission(user, 'attendance.approve_attendance', school),
            },
            'finance': {
                'can_view': has_permission(user, 'finance.view_fees', school),
                'can_collect': has_permission(user, 'finance.collect_fees', school),
                'can_manage': has_permission(user, 'finance.manage_fee_structure', school),
            },
        }
        
        return Response({
            'user': {
                'id': str(user.id),
                'email': user.email,
                'user_type': user.user_type,
            },
            'available_actions': available_actions,
        })


# =============================================================================
# Example 6: Integration with DRF's permission classes
# =============================================================================

from rest_framework.permissions import BasePermission


class HasStudentViewPermission(BasePermission):
    """
    Custom DRF permission class that integrates with RBAC.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Map HTTP methods to required permissions
        permission_map = {
            'GET': 'students.view_student',
            'POST': 'students.create_student',
            'PUT': 'students.edit_student',
            'PATCH': 'students.edit_student',
            'DELETE': 'students.delete_student',
        }
        
        required_permission = permission_map.get(request.method)
        if not required_permission:
            return False
        
        return has_permission(request.user, required_permission)


class StudentViewSetWithDRFPermission(viewsets.ModelViewSet):
    """
    Example using custom DRF permission class.
    """
    
    permission_classes = [IsAuthenticated, HasStudentViewPermission]
    
    # ... your viewset implementation ...


# =============================================================================
# Quick Reference: Available Permission Codenames
# =============================================================================
"""
STUDENTS:
- students.view_student
- students.create_student
- students.edit_student
- students.delete_student (sensitive)
- students.view_guardian
- students.manage_guardian
- students.export_students
- students.import_students
- students.view_documents
- students.manage_documents

TEACHERS:
- teachers.view_teacher
- teachers.create_teacher
- teachers.edit_teacher
- teachers.delete_teacher (sensitive)
- teachers.assign_classes
- teachers.view_assignments

ACADEMICS:
- academics.view_grades
- academics.manage_grades
- academics.view_subjects
- academics.manage_subjects
- academics.view_exams
- academics.create_exam
- academics.edit_exam
- academics.delete_exam (sensitive)
- academics.enter_marks
- academics.view_marks
- academics.approve_marks
- academics.publish_results (sensitive)
- academics.view_report_cards
- academics.generate_report_cards
- academics.manage_timetable
- academics.view_timetable

ATTENDANCE:
- attendance.view_attendance
- attendance.mark_attendance
- attendance.edit_attendance
- attendance.approve_attendance
- attendance.view_reports
- attendance.export_attendance

FINANCE:
- finance.view_fees
- finance.manage_fee_structure (sensitive)
- finance.collect_fees
- finance.view_payments
- finance.issue_refund (sensitive)
- finance.view_reports
- finance.manage_discounts
- finance.export_finance
- finance.send_reminders

HEALTH:
- health.view_records
- health.create_record
- health.edit_record
- health.view_medical_history (sensitive)
- health.manage_incidents

DISCIPLINE:
- discipline.view_records
- discipline.create_record
- discipline.edit_record
- discipline.delete_record (sensitive)
- discipline.manage_karma
- discipline.view_karma
- discipline.issue_suspension (sensitive)

GATEPASS:
- gatepass.view_passes
- gatepass.create_pass
- gatepass.approve_pass
- gatepass.checkout_student
- gatepass.checkin_student

ACHIEVEMENTS:
- achievements.view_achievements
- achievements.create_achievement
- achievements.edit_achievement
- achievements.delete_achievement
- achievements.approve_achievement

TRANSFERS:
- transfers.view_transfers
- transfers.initiate_transfer
- transfers.approve_transfer (sensitive)
- transfers.issue_tc (sensitive)

ENROLLMENTS:
- enrollments.view_enrollments
- enrollments.create_enrollment
- enrollments.edit_enrollment
- enrollments.approve_enrollment
- enrollments.promote_students (sensitive)
- enrollments.manage_sections

REPORTS:
- reports.view_analytics
- reports.generate_reports
- reports.export_reports
- reports.view_audit_logs (sensitive)

SETTINGS:
- settings.view_settings
- settings.manage_settings (sensitive)
- settings.manage_academic_config (sensitive)
- settings.manage_grading (sensitive)
- settings.manage_calendar

USERS:
- users.view_users
- users.create_user (sensitive)
- users.edit_user (sensitive)
- users.delete_user (sensitive)
- users.reset_password (sensitive)
- users.manage_permissions (sensitive)

ROLES:
- roles.view_roles
- roles.create_role (sensitive)
- roles.edit_role (sensitive)
- roles.delete_role (sensitive)
- roles.assign_role (sensitive)
"""
