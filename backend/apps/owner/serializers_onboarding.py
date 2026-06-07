from rest_framework import serializers
from apps.schools.models import School
from apps.schools.models_programs import Campus, AcademicProgram, GradeConfiguration
from apps.owner.models_onboarding import OnboardingChecklist
from apps.owner.models import SchoolSubscription, FeatureToggle
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction

User = get_user_model()


class Step1SchoolIdentitySerializer(serializers.Serializer):
    """
    STEP 1: School Identity
    Creates the basic school record with identity information
    """
    legal_name = serializers.CharField(max_length=255)
    display_name = serializers.CharField(max_length=255, required=False)
    code = serializers.CharField(max_length=20)
    country = serializers.CharField(max_length=100, default='India')
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    timezone = serializers.CharField(max_length=50, default='Asia/Kolkata')
    default_currency = serializers.CharField(max_length=10, default='INR')
    academic_year_start_month = serializers.IntegerField(default=4, min_value=1, max_value=12)
    primary_language = serializers.CharField(max_length=50, default='English')
    website = serializers.URLField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    
    def create(self, validated_data):
        # Set display_name to legal_name if not provided
        if not validated_data.get('display_name'):
            validated_data['display_name'] = validated_data['legal_name']
        
        # Create school
        school = School.objects.create(
            **validated_data,
            onboarding_status='ONBOARDING',
            onboarding_step=1
        )
        
        # Create subscription (default FREE plan)
        SchoolSubscription.objects.create(
            school=school,
            plan='FREE',
            status='ACTIVE',
            max_students=50,
            max_teachers=10,
            created_by=self.context.get('request').user if self.context.get('request') else None
        )
        
        # Create onboarding checklist
        checklist = OnboardingChecklist.objects.create(school=school)
        checklist.step_1_school_identity = True
        checklist.save()
        
        return school


class Step2OwnerAdminSerializer(serializers.Serializer):
    """
    STEP 2: Owner & Super Admin
    Creates the school's super admin user
    """
    school_id = serializers.UUIDField()
    owner_name = serializers.CharField(max_length=255)
    owner_email = serializers.EmailField()
    mobile_number = serializers.CharField(max_length=20, required=False)
    password = serializers.CharField(write_only=True, required=False)
    send_invite = serializers.BooleanField(default=False)
    
    def validate_school_id(self, value):
        if not School.objects.filter(id=value).exists():
            raise serializers.ValidationError("School not found")
        return value
    
    def validate_owner_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value
    
    def create(self, validated_data):
        school = School.objects.get(id=validated_data['school_id'])
        
        # Split name
        name_parts = validated_data['owner_name'].split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        # Create user
        password = validated_data.get('password', User.objects.make_random_password())
        user = User.objects.create_user(
            email=validated_data['owner_email'],
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone_number=validated_data.get('mobile_number', ''),
            user_type='SCHOOL_ADMIN',
            school=school,
            is_staff=True,
            is_active=True
        )
        
        # Update school onboarding
        school.onboarding_step = 2
        school.save()
        
        # Update checklist
        checklist = school.onboarding_checklist
        checklist.step_2_owner_admin = True
        checklist.admin_created = True
        checklist.save()
        
        # TODO: Send invite email if send_invite=True
        
        return {'user': user, 'school': school, 'password': password if not validated_data.get('send_invite') else None}


class CampusSerializer(serializers.ModelSerializer):
    """Serializer for Campus model"""
    class Meta:
        model = Campus
        fields = ['id', 'school', 'name', 'code', 'address', 'is_primary', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class Step3CampusSerializer(serializers.Serializer):
    """
    STEP 3: Campus Setup
    Creates campus for the school
    """
    school_id = serializers.UUIDField()
    name = serializers.CharField(max_length=255, default='Main Campus')
    code = serializers.CharField(max_length=50, default='MAIN')
    address = serializers.CharField()
    is_primary = serializers.BooleanField(default=True)
    
    def validate_school_id(self, value):
        if not School.objects.filter(id=value).exists():
            raise serializers.ValidationError("School not found")
        return value
    
    def create(self, validated_data):
        school = School.objects.get(id=validated_data.pop('school_id'))
        
        campus = Campus.objects.create(school=school, **validated_data)
        
        # Update school onboarding
        school.onboarding_step = 3
        school.save()
        
        # Update checklist
        checklist = school.onboarding_checklist
        checklist.step_3_campus = True
        checklist.save()
        
        return campus


class AcademicProgramSerializer(serializers.ModelSerializer):
    """Serializer for Academic Program"""
    class Meta:
        model = AcademicProgram
        fields = ['id', 'school', 'campus', 'name', 'code', 'board', 'education_level',
                 'medium_of_instruction', 'evaluation_system', 'academic_pattern', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class Step4AProgramSerializer(serializers.Serializer):
    """
    STEP 4A: Create Academic Program
    """
    school_id = serializers.UUIDField()
    campus_id = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(max_length=255)
    code = serializers.CharField(max_length=50)
    board = serializers.ChoiceField(choices=AcademicProgram.BOARD_CHOICES)
    education_level = serializers.ChoiceField(choices=AcademicProgram.EDUCATION_LEVEL_CHOICES, required=False, allow_null=True)
    medium_of_instruction = serializers.CharField(max_length=100, default='English')
    evaluation_system = serializers.ChoiceField(choices=AcademicProgram.EVALUATION_SYSTEM_CHOICES, default='MARKS')
    academic_pattern = serializers.ChoiceField(choices=AcademicProgram.ACADEMIC_PATTERN_CHOICES, default='ANNUAL')
    
    def validate_school_id(self, value):
        if not School.objects.filter(id=value).exists():
            raise serializers.ValidationError("School not found")
        return value
    
    def validate_campus_id(self, value):
        if value and not Campus.objects.filter(id=value).exists():
            raise serializers.ValidationError("Campus not found")
        return value
    
    def create(self, validated_data):
        school = School.objects.get(id=validated_data.pop('school_id'))
        campus_id = validated_data.pop('campus_id', None)
        campus = Campus.objects.get(id=campus_id) if campus_id else None
        
        program = AcademicProgram.objects.create(
            school=school,
            campus=campus,
            **validated_data
        )
        
        # Update school onboarding
        school.onboarding_step = 4
        school.save()
        
        # Update checklist
        checklist = school.onboarding_checklist
        checklist.step_4_programs = True
        checklist.programs_created = True
        checklist.save()
        
        return program


class GradeConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for Grade Configuration"""
    class Meta:
        model = GradeConfiguration
        fields = ['id', 'program', 'grade_name', 'grade_order', 'max_sections',
                 'default_section_names', 'section_capacity', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class Step4BGradeSerializer(serializers.Serializer):
    """
    STEP 4B: Add Grades to Program
    """
    program_id = serializers.UUIDField()
    grades = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of grade configurations'
    )
    
    def validate_program_id(self, value):
        if not AcademicProgram.objects.filter(id=value).exists():
            raise serializers.ValidationError("Program not found")
        return value
    
    def validate_grades(self, value):
        if not value:
            raise serializers.ValidationError("At least one grade is required")
        
        # Validate each grade
        for grade in value:
            if 'grade_name' not in grade or 'grade_order' not in grade:
                raise serializers.ValidationError("Each grade must have grade_name and grade_order")
        
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        program = AcademicProgram.objects.get(id=validated_data['program_id'])
        grades_data = validated_data['grades']
        
        created_grades = []
        for grade_data in grades_data:
            grade = GradeConfiguration.objects.create(
                program=program,
                grade_name=grade_data['grade_name'],
                grade_order=grade_data['grade_order'],
                max_sections=grade_data.get('max_sections', 1),
                default_section_names=grade_data.get('default_section_names', []),
                section_capacity=grade_data.get('section_capacity')
            )
            created_grades.append(grade)
        
        # Update checklist
        checklist = program.school.onboarding_checklist
        checklist.grades_added = True
        checklist.save()
        
        return created_grades


class Step6FeatureSerializer(serializers.Serializer):
    """
    STEP 6: Enable Features
    """
    school_id = serializers.UUIDField()
    features = serializers.ListField(
        child=serializers.CharField(),
        help_text='List of feature codes to enable'
    )
    
    def validate_school_id(self, value):
        if not School.objects.filter(id=value).exists():
            raise serializers.ValidationError("School not found")
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        school = School.objects.get(id=validated_data['school_id'])
        features = validated_data['features']
        
        # Get valid feature codes
        valid_features = [choice[0] for choice in FeatureToggle.FEATURE_CHOICES]
        
        created_toggles = []
        for feature_code in features:
            if feature_code in valid_features:
                toggle, created = FeatureToggle.objects.get_or_create(
                    school=school,
                    feature=feature_code,
                    defaults={
                        'is_enabled': True,
                        'enabled_by': self.context.get('request').user if self.context.get('request') else None
                    }
                )
                if not created:
                    toggle.is_enabled = True
                    toggle.save()
                created_toggles.append(toggle)
        
        # Update school onboarding
        school.onboarding_step = 6
        school.save()
        
        # Update checklist
        checklist = school.onboarding_checklist
        checklist.step_6_features = True
        checklist.save()
        
        return created_toggles


class Step10LegalSerializer(serializers.Serializer):
    """
    STEP 10: Legal & Compliance
    """
    school_id = serializers.UUIDField()
    registration_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    gst_number = serializers.CharField(max_length=15, required=False, allow_blank=True)
    agreement_accepted = serializers.BooleanField(default=True)
    
    def validate_school_id(self, value):
        if not School.objects.filter(id=value).exists():
            raise serializers.ValidationError("School not found")
        return value
    
    def create(self, validated_data):
        school = School.objects.get(id=validated_data['school_id'])
        
        school.registration_number = validated_data.get('registration_number', '')
        school.gst_number = validated_data.get('gst_number', '')
        school.agreement_accepted = validated_data['agreement_accepted']
        school.agreement_accepted_at = timezone.now() if validated_data['agreement_accepted'] else None
        school.onboarding_step = 10
        school.save()
        
        # Update checklist
        checklist = school.onboarding_checklist
        checklist.step_10_legal = True
        checklist.save()
        
        return school


class OnboardingChecklistSerializer(serializers.ModelSerializer):
    """Serializer for Onboarding Checklist"""
    completion_percentage = serializers.ReadOnlyField()
    mandatory_steps_complete = serializers.ReadOnlyField()
    school_name = serializers.CharField(source='school.display_name', read_only=True)
    
    class Meta:
        model = OnboardingChecklist
        fields = '__all__'
        read_only_fields = ['id', 'school', 'created_at', 'updated_at', 'completed_at', 'completed_by']


class OnboardingStatusSerializer(serializers.Serializer):
    """
    Get complete onboarding status for a school
    """
    school_id = serializers.UUIDField(read_only=True)
    school_name = serializers.CharField(read_only=True)
    current_step = serializers.IntegerField(read_only=True)
    onboarding_status = serializers.CharField(read_only=True)
    checklist = OnboardingChecklistSerializer(read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    can_go_live = serializers.BooleanField(read_only=True)
