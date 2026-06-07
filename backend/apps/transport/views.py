from rest_framework import viewsets
from .models import Route, Stop, Vehicle, TransportAssignment
from .serializers import RouteSerializer, StopSerializer, VehicleSerializer, TransportAssignmentSerializer
from apps.core.school_isolation import SchoolIsolationMixin

class RouteViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer

class StopViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    school_field = 'route__school'

from rest_framework.decorators import action
from rest_framework.response import Response
from apps.students.models import Student

class VehicleViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def perform_create(self, serializer):
        # Automatically assign the school of the creator
        school = self.get_user_school()
        serializer.save(school=school)

    def perform_update(self, serializer):
        instance = serializer.save()
        # If route is updated, sync it to all transport assignments
        if 'route' in serializer.validated_data:
            TransportAssignment.objects.filter(vehicle=instance).update(route=instance.route)

    @action(detail=True, methods=['post'])
    def geocode_students(self, request, pk=None):
        """Deprecated geocoding: Now just returns current student coordinates"""
        return Response({'status': 'complete', 'message': 'Coordinates are now managed in Student Profile.'})

    @action(detail=True, methods=['post'])
    def assign_students(self, request, pk=None):
        vehicle = self.get_object()
        student_ids = request.data.get('student_ids', [])
        
        results = {
            'total': len(student_ids),
            'processed': 0
        }
        
        for idx, s_id in enumerate(student_ids):
            student = Student.objects.get(id=s_id)
            
            TransportAssignment.objects.update_or_create(
                student=student,
                defaults={
                    'vehicle': vehicle, 
                    'route': vehicle.route,
                    'order': idx
                }
            )
            results['processed'] += 1
        
        return Response({
            'status': 'students processed',
            'results': results
        })

class TransportAssignmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = TransportAssignment.objects.all()
    serializer_class = TransportAssignmentSerializer
    school_field = 'student__school'
