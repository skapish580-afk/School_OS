from rest_framework import serializers

class MergedHistorySerializer(serializers.Serializer):
    student_id = serializers.UUIDField(source='student.id', read_only=True)
    student_name = serializers.CharField(source='student.full_name_display', read_only=True)
    previous_grade = serializers.CharField(source='grade_name', read_only=True)
    previous_section = serializers.CharField(source='section_name', read_only=True)
    current_grade = serializers.SerializerMethodField()
    current_section = serializers.SerializerMethodField()
    promoted_at = serializers.DateTimeField(source='created_at', read_only=True)
    
    def get_current_grade(self, obj):
        # We need to find where they went. 
        # Since this serializer is for StudentHistory, we look at the NEXT year's enrollment or current status?
        # A simpler way for the History Tab is used by PromotionRecord.
        return "N/A" 
        
    def get_current_section(self, obj):
        return "N/A"
