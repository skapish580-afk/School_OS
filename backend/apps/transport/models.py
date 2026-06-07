from django.db import models
from apps.schools.models import School
from apps.students.models import Student

class Route(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='transport_routes')
    name = models.CharField(max_length=100, help_text="e.g. Route 1 - North Mumbai")
    origin = models.CharField(max_length=200)
    destination = models.CharField(max_length=200)
    
    def __str__(self):
        return f"{self.name} ({self.school.name})"

class Stop(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='stops')
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField()
    pickup_time = models.TimeField()
    drop_time = models.TimeField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} - {self.route.name}"

class Vehicle(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vehicles')
    registration_number = models.CharField(max_length=20, unique=True)
    school_bus_number = models.CharField(max_length=50, null=True, blank=True, help_text="Internal school bus number")
    vehicle_type = models.CharField(max_length=50, help_text="e.g. Bus, Van")
    capacity = models.PositiveIntegerField()
    driver_name = models.CharField(max_length=100, null=True, blank=True)
    driver_phone = models.CharField(max_length=20, null=True, blank=True)
    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles')
    
    # GPS Integration
    gps_device_identifier = models.CharField(max_length=100, unique=True, null=True, blank=True)
    current_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    current_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_ping = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.registration_number} ({self.vehicle_type})"

class TransportAssignment(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='transport_assignment')
    route = models.ForeignKey(Route, on_delete=models.SET_NULL, null=True, blank=True)
    stop = models.ForeignKey(Stop, on_delete=models.SET_NULL, null=True, blank=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    order = models.PositiveIntegerField(default=0, blank=True, null=True)
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return f"{self.student.full_name_display} - {self.route.name}"
