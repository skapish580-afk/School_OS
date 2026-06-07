from rest_framework import serializers
from .models import Asset, AssetAssignment, AssetSchedule, AssetSale

class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = '__all__'
        read_only_fields = ('school', 'asset_code')

class AssetAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name_display')
    teacher_name = serializers.ReadOnlyField(source='teacher.user.full_name')
    asset_name = serializers.ReadOnlyField(source='asset.name')
    
    class Meta:
        model = AssetAssignment
        fields = '__all__'

class AssetScheduleSerializer(serializers.ModelSerializer):
    asset_name = serializers.ReadOnlyField(source='asset.name')
    asset_category = serializers.ReadOnlyField(source='asset.category')
    
    class Meta:
        model = AssetSchedule
        fields = '__all__'
        read_only_fields = ('school',)

class AssetSaleSerializer(serializers.ModelSerializer):
    asset_name = serializers.ReadOnlyField(source='asset.name')
    asset_category = serializers.ReadOnlyField(source='asset.category')
    original_cost = serializers.ReadOnlyField(source='asset.cost')
    profit_loss = serializers.SerializerMethodField()

    class Meta:
        model = AssetSale
        fields = '__all__'
        read_only_fields = ('school',)

    def get_profit_loss(self, obj):
        if obj.asset.cost:
            return float(obj.sale_price) - float(obj.asset.cost)
        return 0.0
