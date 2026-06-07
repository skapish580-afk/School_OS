from rest_framework import serializers
from .models_calendar import Holiday, SchoolEvent


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'school', 'name', 'date', 'description', 'is_recurring', 'created_at']
        read_only_fields = ['id', 'school', 'created_at']

class SchoolEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = SchoolEvent
        fields = [
            'id', 'school', 'title', 'event_date', 'start_time', 'end_time',
            'event_type', 'event_type_display', 'description', 'location',
            'is_all_day', 'created_at'
        ]
        read_only_fields = ['id', 'school', 'created_at']
