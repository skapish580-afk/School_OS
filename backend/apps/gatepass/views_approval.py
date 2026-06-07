from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from .models import GatePass
from .serializers import GatePassSerializer
from apps.teachers.models import Teacher, TeacherAssignment
from apps.schools.models import School


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_gatepass(request, gatepass_id):
    """
    Approve gate pass request
    Only class teachers can approve for their class students
    """
    try:
        user = request.user
        gatepass = GatePass.objects.get(id=gatepass_id)
        
        # Check if approval is enabled
        teacher = Teacher.objects.get(user=user)
        school = teacher.assignments.first().school if teacher.assignments.exists() else None
        
        if school and hasattr(school, 'settings'):
            if not school.settings.enable_class_teacher_gatepass_approval and not user.is_staff:
                return Response(
                    {'error': 'Gate pass approval by teachers is disabled'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check if teacher is class teacher of this student
        student = gatepass.student
        enrollment = student.enrollments.filter(status='ACTIVE').first()
        if not enrollment:
            return Response({'error': 'Student has no active enrollment'}, status=status.HTTP_404_NOT_FOUND)
        
        is_class_teacher = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            grade=enrollment.grade,
            section=enrollment.section,
            is_active=True
        ).exists()
        
        if not is_class_teacher and not user.is_staff:
            return Response(
                {'error': 'Only class teacher can approve gate passes'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already processed
        if gatepass.status != 'PENDING':
            return Response(
                {'error': f'Gate pass already {gatepass.status.lower()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve
        approval_note = request.data.get('note', '')
        
        gatepass.status = 'APPROVED'
        gatepass.approved_by_class_teacher = teacher
        gatepass.approved_at = timezone.now()
        gatepass.approval_note = approval_note
        gatepass.issued_by = user
        gatepass.save()
        
        return Response({
            'message': 'Gate pass approved successfully',
            'gatepass': GatePassSerializer(gatepass).data
        })
    
    except GatePass.DoesNotExist:
        return Response({'error': 'Gate pass not found'}, status=status.HTTP_404_NOT_FOUND)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_gatepass(request, gatepass_id):
    """
    Reject gate pass request
    Only class teachers can reject for their class students
    """
    try:
        user = request.user
        gatepass = GatePass.objects.get(id=gatepass_id)
        reason = request.data.get('reason')
        
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check permissions
        teacher = Teacher.objects.get(user=user)
        student = gatepass.student
        enrollment = student.enrollments.filter(status='ACTIVE').first()
        
        is_class_teacher = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            grade=enrollment.grade,
            section=enrollment.section,
            is_active=True
        ).exists()
        
        if not is_class_teacher and not user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if already processed
        if gatepass.status != 'PENDING':
            return Response(
                {'error': f'Gate pass already {gatepass.status.lower()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reject
        gatepass.status = 'REJECTED'
        gatepass.rejection_reason = reason
        gatepass.approved_by_class_teacher = teacher
        gatepass.save()
        
        return Response({
            'message': 'Gate pass rejected',
            'gatepass': GatePassSerializer(gatepass).data
        })
    
    except GatePass.DoesNotExist:
        return Response({'error': 'Gate pass not found'}, status=status.HTTP_404_NOT_FOUND)
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_gatepasses(request):
    """Get pending gate pass requests for class teacher's class"""
    try:
        teacher = Teacher.objects.get(user=request.user)
        
        # Get class teacher assignment
        class_assignment = TeacherAssignment.objects.filter(
            teacher=teacher,
            role='CLASS_TEACHER',
            is_active=True
        ).first()
        
        if not class_assignment:
            return Response(
                {'error': 'You are not a class teacher'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get pending passes for this class
        pending_passes = GatePass.objects.filter(
            student__enrollments__grade=class_assignment.grade,
            student__enrollments__section=class_assignment.section,
            student__enrollments__status='ACTIVE',
            status='PENDING'
        ).select_related('student', 'student__user').order_by('-requested_at')
        
        serializer = GatePassSerializer(pending_passes, many=True)
        
        return Response({
            'count': pending_passes.count(),
            'gatepasses': serializer.data
        })
    
    except Teacher.DoesNotExist:
        return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
