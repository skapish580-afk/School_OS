from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permission_utils import RBACPermission
from .models import Asset, AssetAssignment, AssetSchedule, AssetSale
from .serializers import AssetSerializer, AssetAssignmentSerializer, AssetScheduleSerializer, AssetSaleSerializer

class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'assets'
    rbac_resource = 'assets'
    rbac_action_permissions = {
        'list': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.manage_assets'],
        'retrieve': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.manage_assets'],
        'create': ['assets.edit_assets', 'assets.manage_assets'],
        'update': ['assets.edit_assets', 'assets.manage_assets'],
        'partial_update': ['assets.edit_assets', 'assets.manage_assets'],
        'destroy': ['assets.edit_assets', 'assets.manage_assets'],
    }

    def get_queryset(self):
        return Asset.objects.filter(school=self.request.user.school).order_by('-purchase_date')

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

class AssetAssignmentViewSet(viewsets.ModelViewSet):
    queryset = AssetAssignment.objects.all()
    serializer_class = AssetAssignmentSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'assets'
    rbac_resource = 'assets'
    rbac_action_permissions = {
        'list': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.manage_assets'],
        'retrieve': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.manage_assets'],
        'create': ['assets.edit_assets', 'assets.manage_assets'],
        'update': ['assets.edit_assets', 'assets.manage_assets'],
        'partial_update': ['assets.edit_assets', 'assets.manage_assets'],
        'destroy': ['assets.edit_assets', 'assets.manage_assets'],
    }

    def get_queryset(self):
        return AssetAssignment.objects.filter(asset__school=self.request.user.school)

class AssetScheduleViewSet(viewsets.ModelViewSet):
    queryset = AssetSchedule.objects.all()
    serializer_class = AssetScheduleSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'assets'
    rbac_resource = 'assets'
    rbac_action_permissions = {
        'list': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.track_maintenance', 'assets.manage_assets'],
        'retrieve': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.track_maintenance', 'assets.manage_assets'],
        'create': ['assets.schedule_maintenance', 'assets.track_maintenance', 'assets.manage_assets'],
        'update': ['assets.schedule_maintenance', 'assets.track_maintenance', 'assets.manage_assets'],
        'partial_update': ['assets.schedule_maintenance', 'assets.track_maintenance', 'assets.manage_assets'],
        'destroy': ['assets.schedule_maintenance', 'assets.track_maintenance', 'assets.manage_assets'],
    }

    def get_queryset(self):
        return AssetSchedule.objects.filter(school=self.request.user.school).order_by('scheduled_date')

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

class AssetSaleViewSet(viewsets.ModelViewSet):
    queryset = AssetSale.objects.all()
    serializer_class = AssetSaleSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    rbac_module = 'assets'
    rbac_resource = 'assets'
    rbac_action_permissions = {
        'list': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.manage_assets'],
        'retrieve': ['assets.view_assets', 'assets.edit_assets', 'assets.schedule_maintenance', 'assets.manage_assets'],
        'create': ['assets.edit_assets', 'assets.manage_assets'],
        'update': ['assets.edit_assets', 'assets.manage_assets'],
        'partial_update': ['assets.edit_assets', 'assets.manage_assets'],
        'destroy': ['assets.edit_assets', 'assets.manage_assets'],
    }

    def get_queryset(self):
        return AssetSale.objects.filter(school=self.request.user.school).order_by('-sale_date')

    def perform_create(self, serializer):
        sale = serializer.save(school=self.request.user.school)
        # Update asset status to DISPOSED
        asset = sale.asset
        asset.status = 'DISPOSED'
        asset.save()

