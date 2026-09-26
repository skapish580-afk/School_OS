from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()
    object_type = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username or obj.actor.email
        return 'System / Automated'

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else ''

    def get_actor_role(self, obj):
        return getattr(obj.actor, 'role', '') if obj.actor else ''