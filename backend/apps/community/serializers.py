from rest_framework import serializers
from .models import ForumPost, ForumComment
from apps.accounts.models import User
from apps.students.models import Student
from apps.schools.models import School

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'display_name', 'legal_name', 'code', 'city']

class AlumniSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    school = SchoolSerializer(read_only=True)

    class Meta:
        model = Student
        fields = ['id', 'suid', 'full_name', 'email', 'phone_number', 'profile_photo', 'school', 'graduation_date']

class ForumCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    
    class Meta:
        model = ForumComment
        fields = ['id', 'author', 'author_name', 'content', 'created_at']
        read_only_fields = ['author']

class ForumPostSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)
    comments = ForumCommentSerializer(many=True, read_only=True)
    
    class Meta:
        model = ForumPost
        fields = [
            'id', 'school', 'author', 'author_name', 'title', 'content', 
            'is_global', 'city_localized', 'created_at', 'updated_at', 'comments_count', 'comments'
        ]
        read_only_fields = ['author', 'school']

