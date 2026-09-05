from rest_framework import serializers
from .models import Route, Stop, Vehicle, TransportAssignment

class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = '__all__'

class RouteSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    
    class Meta:
        model = Route
        fields = '__all__'
        read_only_fields = ['school']

class VehicleSerializer(serializers.ModelSerializer):
    route_name = serializers.ReadOnlyField(source='route.name')
    route_waypoints = serializers.SerializerMethodField()
    assigned_students_count = serializers.SerializerMethodField()
    assigned_student_ids = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = '__all__'
        read_only_fields = ['school']

    def get_route_waypoints(self, obj):
        if obj.route and obj.route.waypoints:
            return obj.route.waypoints
        return None
    
    def get_assigned_students_count(self, obj):
        return obj.transportassignment_set.filter(student__status__in=['ACTIVE', 'TEMPORARY']).count()

    def get_assigned_student_ids(self, obj):
        return list(obj.transportassignment_set.filter(student__status__in=['ACTIVE', 'TEMPORARY']).values_list('student_id', flat=True))

class TransportAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name_display')
    route_name = serializers.ReadOnlyField(source='route.name')
    stop_name = serializers.ReadOnlyField(source='stop.name')
    
    class Meta:
        model = TransportAssignment
        fields = '__all__'
