from rest_framework import serializers
from .models import School
from .models_settings import SchoolSettings


class SchoolSettingsSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    school_code = serializers.CharField(source='school.code', read_only=True)
    school_logo = serializers.ImageField(source='school.logo', read_only=True)
    
    current_academic_year = serializers.SerializerMethodField()
    available_academic_years = serializers.SerializerMethodField()

    class Meta:
        model = SchoolSettings
        fields = [
            'id', 'school', 'school_name', 'school_code', 'school_logo',
            'dark_mode', 'primary_color',
            'show_student_stats', 'show_teacher_stats', 'show_attendance_widget',
            'show_finance_widget', 'show_health_widget', 'show_gatepass_widget',
            'show_achievements_widget', 'show_transfers_widget', 'show_alumni_stats',
            'email_notifications', 'sms_notifications', 'push_notifications',
            'academic_year_start_month', 'academic_year_start_day',
            'academic_year_end_month', 'academic_year_end_day',
            'academic_year_format', 'current_academic_year', 'available_academic_years',
            'graduation_point', 'allow_continuation_after_10',
            'show_student_photos', 'show_parent_contact', 'show_financial_data',
            # Gatepass
            'enable_gatepass_print',
            'gatepass_sender_email',
            'gatepass_app_password',
            'gatepass_verification_base_url',
            'gatepass_creation_email_body',
            'gatepass_departure_email_body',
            'default_language', 'timezone', 'date_format',
            # Finance Settings
            'prevent_duplicate_billing', 'require_billing_confirmation',
            'show_student_fee_history_on_invoice', 'auto_generate_installment_invoices',
            'days_before_due_to_generate', 'auto_apply_late_fee',
            'show_fee_breakdown_on_invoice', 'send_payment_reminders',
            'reminder_days_before_due',
            'school_address', 'school_latitude', 'school_longitude',
            'updated_at', 'updated_by'
        ]
        read_only_fields = ['school', 'updated_at', 'updated_by', 'timezone', 'current_academic_year', 'available_academic_years']

    def get_current_academic_year(self, obj):
        return obj.get_academic_year_code_for_date()

    def get_available_academic_years(self, obj):
        return obj.get_available_academic_years()

    
    def update(self, instance, validated_data):
        # Set updated_by to current user
        request = self.context.get('request')
        if request and request.user:
            instance.updated_by = request.user
        
        return super().update(instance, validated_data)
