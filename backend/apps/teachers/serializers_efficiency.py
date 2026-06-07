from rest_framework import serializers
from .models import TeacherEfficiency

class TeacherEfficiencySerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherEfficiency
        fields = '__all__'
