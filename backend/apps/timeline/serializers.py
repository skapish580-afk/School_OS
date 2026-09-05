from rest_framework import serializers
from .models import TimelineMark, TimelineRemark, TimelineHealth, StudentEnrollmentArchive

class TimelineMarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineMark
        fields = '__all__'

class TimelineRemarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineRemark
        fields = '__all__'

class TimelineHealthSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineHealth
        fields = '__all__'

class StudentEnrollmentArchiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentEnrollmentArchive
        fields = '__all__'
