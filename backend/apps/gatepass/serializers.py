from rest_framework import serializers
from .models import GatePass, VisitorPass

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
            'is_expired', 'qr_payload', 'failed_attempts', 'cancellation_reason'
        ]
        read_only_fields = [
            'id', 'issued_by', 'issued_at', 'valid_until', 
            'status', 'scanned_by', 'scanned_at', 'failed_attempts', 'cancellation_reason'
        ]
    
    def get_is_expired(self, obj):
        from django.utils import timezone
        return timezone.now() > obj.valid_until and obj.status == 'ACTIVE'
        
    def get_qr_payload(self, obj):
        if obj.status == 'ACTIVE':
            return obj.generate_qr_payload()
        return None


class VisitorPassSerializer(serializers.ModelSerializer):
    issued_by_name = serializers.CharField(source='issued_by.full_name', read_only=True)
    scanned_by_name = serializers.CharField(source='scanned_by.full_name', read_only=True)
    is_expired = serializers.SerializerMethodField()
    qr_payload = serializers.SerializerMethodField()

    class Meta:
        model = VisitorPass
        fields = [
            'id', 'name', 'address', 'purpose', 'email', 'phone_number',
            'requested_at', 'issued_at', 'valid_until', 'issued_by',
            'issued_by_name', 'status', 'scanned_by', 'scanned_by_name',
            'scanned_at', 'pass_id', 'is_expired', 'qr_payload', 'cancellation_reason'
        ]
        read_only_fields = [
            'id', 'issued_by', 'issued_at', 'valid_until',
            'status', 'scanned_by', 'scanned_at', 'pass_id', 'cancellation_reason'
        ]

    def get_is_expired(self, obj):
        from django.utils import timezone
        return timezone.now() > obj.valid_until and obj.status == 'ACTIVE'

    def get_qr_payload(self, obj):
        import pytz
        try:
            school_tz = pytz.timezone(obj.school.timezone)
            local_dt = obj.valid_until.astimezone(school_tz)
        except Exception:
            try:
                school_tz = pytz.timezone('Asia/Kolkata')
                local_dt = obj.valid_until.astimezone(school_tz)
            except Exception:
                local_dt = obj.valid_until
                
        expiry_str = local_dt.strftime("%d %b %Y, %I:%M %p")
        issuer_name = obj.issued_by.full_name if obj.issued_by else "School Administration"
        return (
            f"MECARD:\n"
            f"N: {obj.name};\n"
            f"ADR: {obj.address};\n"
            f"TEL: {obj.phone_number};\n"
            f"EMAIL: {obj.email};\n"
            f"NOTE:\n"
            f"  - Purpose: {obj.purpose}\n"
            f"  - Issued By: {issuer_name}\n"
            f"  - Expiry: {expiry_str};;"
        )