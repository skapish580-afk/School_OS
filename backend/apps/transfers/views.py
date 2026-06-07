from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import TransferRequest
from .serializers import TransferRequestSerializer
from apps.accounts.permission_utils import RBACPermission

class TransferRequestViewSet(viewsets.ModelViewSet):
    queryset = TransferRequest.objects.all()
    serializer_class = TransferRequestSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'transfers'
    rbac_resource = 'transfer'
    rbac_action_permissions = {
        'approve': 'transfers.approve_transfer',
        'reject': 'transfers.approve_transfer',
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_enrollment__student_id=student_id)
        
        transfer_status = self.request.query_params.get('status')
        if transfer_status:
            queryset = queryset.filter(status=transfer_status)
        
        target_school = self.request.query_params.get('target_school')
        if target_school:
            queryset = queryset.filter(target_school_id=target_school)
        
        return queryset.order_by('-request_date')
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        transfer = self.get_object()
        
        if transfer.status != 'PENDING':
            return Response(
                {'error': f'Cannot approve transfer with status {transfer.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transfer.status = 'APPROVED'
        transfer.resolution_date = timezone.now().date()
        transfer.admin_remarks = request.data.get('remarks', 'Approved by Admin')
        transfer.save()
        
        old_enrollment = transfer.student_enrollment
        old_enrollment.status = 'TRANSFERRED'
        old_enrollment.save()
        
        return Response(TransferRequestSerializer(transfer).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        transfer = self.get_object()
        
        if transfer.status != 'PENDING':
            return Response(
                {'error': f'Cannot reject transfer with status {transfer.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transfer.status = 'REJECTED'
        transfer.resolution_date = timezone.now().date()
        transfer.admin_remarks = request.data.get('remarks', 'Rejected by Admin')
        transfer.save()
        
        return Response(TransferRequestSerializer(transfer).data)