from rest_framework import serializers
from .models import StudentHealthProfile, ClinicVisit

class HealthProfileSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    
    class Meta:
        model = StudentHealthProfile
        fields = '__all__'

class ClinicVisitSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    nurse_name = serializers.CharField(source='nurse.full_name', read_only=True)
    
    class Meta:
        model = ClinicVisit
        fields = '__all__'
        read_only_fields = ['nurse', 'visit_date']