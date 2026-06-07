from rest_framework import serializers
from .models import TransferRequest
from apps.enrollments.serializers import StudentEnrollmentSerializer
from apps.schools.serializers import SchoolSerializer

class TransferRequestSerializer(serializers.ModelSerializer):
    student_details = StudentEnrollmentSerializer(source='student_enrollment', read_only=True)
    target_school_name = serializers.CharField(source='target_school.name', read_only=True)

    class Meta:
        model = TransferRequest
        fields = '__all__'
        read_only_fields = ['status', 'resolution_date']