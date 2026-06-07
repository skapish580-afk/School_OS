from rest_framework import serializers
from .models import GatePass

class GatePassSerializer(serializers.ModelSerializer):
    student = serializers.SlugRelatedField(
        slug_field='suid', 
        queryset=GatePass._meta.get_field('student').related_model.objects.all()
    )
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.full_name', read_only=True)
    scanned_by_name = serializers.CharField(source='scanned_by.full_name', read_only=True)
    is_expired = serializers.SerializerMethodField()
    qr_payload = serializers.SerializerMethodField()

    class Meta:
        model = GatePass
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'requested_by', 
            'issued_by', 'issued_by_name', 'approved_by_class_teacher', 
            'approval_note', 'rejection_reason', 'reason', 'requested_at', 
            'issued_at', 'out_time', 'valid_until', 'status', 'approved_at', 
            'scanned_by', 'scanned_by_name', 'scanned_at', 'qr_signature', 
            'is_expired', 'qr_payload', 'failed_attempts'
        ]
        read_only_fields = [
            'id', 'issued_by', 'issued_at', 'valid_until', 
            'status', 'scanned_by', 'scanned_at', 'failed_attempts'
        ]
    
    def get_is_expired(self, obj):
        from django.utils import timezone
        return timezone.now() > obj.valid_until and obj.status == 'ACTIVE'
        
    def get_qr_payload(self, obj):
        if obj.status == 'ACTIVE':
            return obj.generate_qr_payload()
        return None