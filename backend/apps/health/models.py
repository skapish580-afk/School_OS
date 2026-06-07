from django.db import models
from apps.students.models import Student
from django.conf import settings

class StudentHealthProfile(models.Model):
    """
    Static medical data: Blood group, allergies, conditions.
    One profile per student.
    """
    BLOOD_GROUPS = [
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-')
    ]

    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='health_profile')
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS, blank=True)
    height_cm = models.IntegerField(null=True, blank=True)
    weight_kg = models.IntegerField(null=True, blank=True)
    
    allergies = models.TextField(blank=True, help_text="Peanuts, Dust, etc.")
    chronic_conditions = models.TextField(blank=True, help_text="Asthma, Diabetes, etc.")
    emergency_contact_phone = models.CharField(max_length=15, blank=True)
    
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Health Profile: {self.student.user.full_name}"

class ClinicVisit(models.Model):
    """
    Log of visits to the Nurse/Infirmary.
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='clinic_visits')
    nurse = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    visit_date = models.DateTimeField(auto_now_add=True)
    symptom = models.CharField(max_length=200, help_text="Headache, Fever, Injury")
    treatment_given = models.TextField(help_text="Given Paracetamol, Bandage applied")
    sent_home = models.BooleanField(default=False, help_text="Did the parent pick them up?")
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.symptom} ({self.visit_date.date()})"