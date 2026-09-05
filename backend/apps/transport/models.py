from django.db import models
from apps.schools.models import School
from apps.students.models import Student
from django.conf import settings

class Route(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='transport_routes')
    name = models.CharField(max_length=100, help_text="e.g. Route 1 - North Mumbai")
    origin = models.CharField(max_length=200, blank=True, null=True)
    destination = models.CharField(max_length=200, blank=True, null=True)
    waypoints = models.JSONField(null=True, blank=True, help_text="List of [lat, lng] coordinates defining custom route")
    
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
    current_status = models.CharField(max_length=50, null=True, blank=True, help_text="e.g. REACHED_SCHOOL, LEFT_SCHOOL, IN_TRANSIT")
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
        route_str = self.route.name if self.route else (f"Vehicle {self.vehicle.registration_number}" if self.vehicle else "Unassigned")
        student_str = getattr(self.student, 'full_name_display', str(self.student)) if self.student else "Unknown Student"
        return f"{student_str} - {route_str}"


class TransportAttendance(models.Model):
    JOURNEY_CHOICES = [
        ('MORNING', 'Morning (To School)'),
        ('AFTERNOON', 'Afternoon (From School)'),
    ]
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
    ]

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='attendance_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transport_attendance_records')
    date = models.DateField()
    journey = models.CharField(max_length=20, choices=JOURNEY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ABSENT')
    remarks = models.CharField(max_length=255, blank=True, null=True)
    
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    marked_at = models.DateTimeField(auto_now=True)
    arrived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('vehicle', 'student', 'date', 'journey')
        ordering = ['student__user__first_name']

    def __str__(self):
        return f"{self.student.full_name_display} - {self.journey} - {self.status} on {self.date}"


class VehicleDailyStatus(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='daily_statuses')
    date = models.DateField()
    reached_school = models.BooleanField(default=False)
    reached_school_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('vehicle', 'date')
        verbose_name_plural = "Vehicle Daily Statuses"

    def __str__(self):
        return f"{self.vehicle.registration_number} - {self.date} (Reached: {self.reached_school})"


from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.accounts.rbac_models import Permission

@receiver(post_save, sender=Vehicle)
def create_vehicle_permission(sender, instance, created, **kwargs):
    codename = f"transport.mark_attendance_{instance.id}"
    name = f"Mark Attendance: {instance.school_bus_number or instance.registration_number}"
    
    Permission.objects.update_or_create(
        codename=codename,
        defaults={
            'name': name,
            'description': f"Gives permission to mark attendance for bus {instance.school_bus_number or instance.registration_number}",
            'module': 'transport',
            'action': 'edit',
            'resource': 'mark_attendance',
            'requires_school_context': True,
            'display_order': 200
        }
    )

@receiver(post_delete, sender=Vehicle)
def delete_vehicle_permission(sender, instance, **kwargs):
    codename = f"transport.mark_attendance_{instance.id}"
    Permission.objects.filter(codename=codename).delete()

