from rest_framework import serializers
from .models import SupportTicket, TicketMessage
from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.students.models import Student


class TicketMessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.CharField(source='sender.email', read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = [
            'id', 'ticket', 'sender', 'sender_name', 'sender_role',
            'sender_email', 'sender_avatar', 'is_admin_reply',
            'message', 'attachment', 'is_read_by_user', 'is_read_by_admin',
            'created_at'
        ]
        read_only_fields = ['id', 'ticket', 'sender', 'sender_name', 'sender_role', 'is_admin_reply', 'created_at']

    def get_sender_avatar(self, obj):
        return None


class SupportTicketListSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True, default='')
    school_code = serializers.CharField(source='school.code', read_only=True, default='')
    unread_messages_count = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'school', 'school_name', 'school_code',
            'user', 'user_role', 'user_name', 'user_email',
            'title', 'category', 'status', 'severity', 'current_route',
            'created_at', 'updated_at', 'resolved_at',
            'unread_messages_count', 'message_count'
        ]

    def get_unread_messages_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        is_admin = getattr(request.user, 'is_staff', False) or getattr(request.user, 'role', '') in ['SUPER_ADMIN', 'OWNER']
        if is_admin:
            return obj.messages.filter(is_admin_reply=False, is_read_by_admin=False).count()
        return obj.messages.filter(is_admin_reply=True, is_read_by_user=False).count()

    def get_message_count(self, obj):
        return obj.messages.count()


class SupportTicketDetailSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True, default='')
    school_code = serializers.CharField(source='school.code', read_only=True, default='')
    messages = TicketMessageSerializer(many=True, read_only=True)
    assigned_admin_name = serializers.CharField(source='assigned_admin.get_full_name', read_only=True, default='')

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'school', 'school_name', 'school_code',
            'user', 'user_role', 'user_name', 'user_email',
            'title', 'category', 'description', 'screenshot', 'current_route',
            'status', 'severity', 'diagnostic_data',
            'assigned_admin', 'assigned_admin_name', 'admin_notes',
            'created_at', 'updated_at', 'resolved_at',
            'messages'
        ]
        read_only_fields = ['id', 'ticket_number', 'user', 'created_at', 'updated_at']


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = [
            'title', 'category', 'description', 'screenshot',
            'current_route', 'severity', 'diagnostic_data'
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        
        # Extract user context & school safely
        user_name = user.get_full_name() or user.username or user.email
        user_role = getattr(user, 'role', '') or ('SUPER_ADMIN' if user.is_superuser else 'USER')
        user_email = user.email or ''
        school = getattr(user, 'school', None)
        
        # If school not attached directly to user, try user's profile
        if not school:
            if hasattr(user, 'teacher_profile') and getattr(user.teacher_profile, 'school', None):
                school = user.teacher_profile.school
            elif hasattr(user, 'student_profile') and getattr(user.student_profile, 'school', None):
                school = user.student_profile.school

        ticket = SupportTicket.objects.create(
            user=user,
            user_name=user_name,
            user_role=user_role,
            user_email=user_email,
            school=school,
            **validated_data
        )
        return ticket


# Hierarchy Serializers for SuperAdmin Inspection
class SchoolHierarchySerializer(serializers.ModelSerializer):
    teachers_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    open_tickets_count = serializers.SerializerMethodField()
    subscription_plan = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'id', 'name', 'display_name', 'legal_name', 'code', 'board',
            'country', 'state', 'city', 'onboarding_status', 'created_at',
            'teachers_count', 'students_count', 'open_tickets_count', 'subscription_plan'
        ]

    def get_teachers_count(self, obj):
        try:
            from apps.teachers.models import TeacherSchoolAssociation, Teacher
            count = TeacherSchoolAssociation.objects.filter(school=obj, status='ACTIVE').count()
            if count == 0:
                count = Teacher.objects.filter(user__school=obj).count()
            return count
        except Exception:
            return 0

    def get_students_count(self, obj):
        try:
            from apps.students.models import Student
            return Student.objects.filter(school=obj, status='ACTIVE').count()
        except Exception:
            return 0

    def get_open_tickets_count(self, obj):
        return obj.support_tickets.filter(status__in=['OPEN', 'INVESTIGATING']).count()

    def get_subscription_plan(self, obj):
        if hasattr(obj, 'subscription'):
            return obj.subscription.plan
        return 'FREE'


class TeacherHierarchySerializer(serializers.ModelSerializer):
    email = serializers.CharField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='full_name_display', read_only=True)
    teacher_id = serializers.CharField(source='tuid', read_only=True)
    phone = serializers.CharField(source='emergency_contact_phone', read_only=True)
    qualification = serializers.CharField(source='qualifications', read_only=True)
    designation = serializers.CharField(source='teacher_type', read_only=True)
    is_active = serializers.SerializerMethodField()
    joining_date = serializers.DateField(source='date_of_joining', read_only=True)
    assigned_classes = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            'id', 'teacher_id', 'full_name', 'email', 'phone',
            'qualification', 'designation', 'is_active', 'joining_date',
            'assigned_classes'
        ]

    def get_is_active(self, obj):
        return getattr(obj.user, 'is_active', True)

    def get_assigned_classes(self, obj):
        if hasattr(obj, 'class_sections') and obj.class_sections.exists():
            return [str(cs) for cs in obj.class_sections.all()]
        return []


class StudentHierarchySerializer(serializers.ModelSerializer):
    email = serializers.CharField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    current_class_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'admission_number', 'full_name', 'email',
            'gender', 'blood_group', 'is_active',
            'current_class_name', 'created_at'
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() if obj.user else f"Student #{obj.admission_number or obj.suid}"

    def get_is_active(self, obj):
        return obj.status == 'ACTIVE'

    def get_current_class_name(self, obj):
        if hasattr(obj, 'current_section') and obj.current_section:
            return str(obj.current_section)
        return 'Not Assigned'
