from rest_framework import serializers
from django.db import transaction
from django.apps import apps 
from .models import Student, Guardian, StudentDocument, StudentHistory
from apps.accounts.models import User
from apps.enrollments.models import StudentEnrollment
from apps.features.serializers import FeatureFieldMixin
import uuid

class StudentSerializer(FeatureFieldMixin, serializers.ModelSerializer):
    # --- OUTPUT FIELDS (Displaying Data) ---
    # These fields ensure names are pulled directly from the Identity (User) table
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    # allow_blank=True is REQUIRED alongside allow_null=True:
    # FormData always sends strings, so a missing phone arrives as '' not None.
    # Without allow_blank, DRF rejects '' even though the model field is nullable.
    phone_number = serializers.CharField(source='user.phone_number', required=False, allow_null=True, allow_blank=True)
    current_class = serializers.SerializerMethodField()
    transport_assignment = serializers.SerializerMethodField()

    # --- INPUT FIELDS (Admissions Form) ---
    address = serializers.CharField(required=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=True)

    user_email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    grade = serializers.CharField(write_only=True, required=False, allow_blank=True)
    section = serializers.CharField(write_only=True, required=False, allow_blank=True)
    middle_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Student
        fields = [
            'id', 'suid', 'full_name', 
            'first_name', 'middle_name', 'last_name',
            'email', 'phone_number', 
            'profile_photo', 'blood_group', 'address', 'date_of_birth', 'gender', 
            'current_class', 'grade_config', 'current_section',
            'latitude', 'longitude',
            'transport_assignment',
            'user_email', 'grade', 'section',
            'category', 'religion', 'mother_tongue', 'languages_known',
            'nationality', 'birth_place', 'is_rte_student', 
            'fee_concession_applicable', 'house_color', 'alumni_directory_consent',
            'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
            'custom_attributes'
        ]
        read_only_fields = ['suid', 'email']
        feature_fields = {
            'EXTENDED_PROFILES': [
                'category', 'religion', 'mother_tongue', 'languages_known',
                'nationality', 'birth_place', 'house_color',
                'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
                'custom_attributes'
            ]
        }

    def get_current_class(self, obj):
        """Returns the student's active enrollment class (e.g., 10-A)."""
        enrollment = obj.enrollments.filter(status='ACTIVE').first()
        return f"{enrollment.grade}-{enrollment.section}" if enrollment else "Unassigned"

    def get_transport_assignment(self, obj):
        try:
            return {
                'id': obj.transport_assignment.id,
                'vehicle': obj.transport_assignment.vehicle.id if obj.transport_assignment.vehicle else None,
                'route': obj.transport_assignment.route.id if obj.transport_assignment.route else None,
                'order': obj.transport_assignment.order
            }
        except:
            return None

    def to_internal_value(self, data):
        """Map gender names and other pre-processing."""
        # QueryDict (from FormData) is immutable. We must copy it to modify.
        if hasattr(data, 'copy'):
            data = data.copy()
            
        if 'gender' in data and data['gender']:
            val = str(data['gender']).upper()
            if val in ['MALE', 'M', '"MALE"']: data['gender'] = 'M'
            elif val in ['FEMALE', 'F', '"FEMALE"']: data['gender'] = 'F'
            elif val in ['OTHER', 'O', '"OTHER"']: data['gender'] = 'O'
        return super().to_internal_value(data)

    def validate(self, attrs):
        """Enforce required fields."""
        # Always check for address and coordinates
        mandatory_fields = ['address', 'latitude', 'longitude']
        for field in mandatory_fields:
            if not attrs.get(field):
                raise serializers.ValidationError({field: f'{field.replace("_", " ").capitalize()} is required.'})

        # self.instance is None on create, set on update
        if self.instance is None:
            if not attrs.get('user_email'):
                raise serializers.ValidationError({'user_email': 'This field is required when adding a new student.'})
            if not attrs.get('grade'):
                raise serializers.ValidationError({'grade': 'This field is required when adding a new student.'})
            if not attrs.get('section'):
                raise serializers.ValidationError({'section': 'This field is required when adding a new student.'})
        return attrs

    def update(self, instance, validated_data):
        """Handles updating both the User Identity and Student Profile."""
        user_data = validated_data.pop('user', {})
        # Strip out create-only fields that must not be applied on update
        validated_data.pop('user_email', None)
        validated_data.pop('grade', None)
        validated_data.pop('section', None)
        with transaction.atomic():
            # 1. Update User Identity (Names/Phone)
            user = instance.user
            if user_data:
                for attr, value in user_data.items():
                    setattr(user, attr, value)
                user.save()
            
            # 2. Update Student Profile (Address/Middle Name/photo/etc.)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
        return instance

    def create(self, validated_data):
        """Creates User Identity, Student Profile, and Class Enrollment in one transaction."""
        # 1. Extract Identity and Academic Data
        user_data = validated_data.pop('user', {})
        first_name = user_data.get('first_name')
        last_name = user_data.get('last_name', '')
        
        middle_name = validated_data.pop('middle_name', '')
        email = validated_data.pop('user_email') 
        phone = user_data.get('phone_number', '') or None
        
        grade_number = validated_data.pop('grade')
        section_letter = validated_data.pop('section')

        # 2. Safety check for School model
        try:
            School = apps.get_model('schools', 'School')
            school = School.objects.first()
            if not school:
                school = School.objects.create(name="Main Campus")
        except:
             raise serializers.ValidationError({"detail": "School configuration missing."})

        # 3. Get or create Grade and Section
        from apps.academics.models import Section
        from apps.schools.models_programs import GradeConfiguration
        try:
            # Match by grade_name since grade_number is deprecated
            grade_obj = GradeConfiguration.objects.get(
                program__school=school, 
                grade_name=str(grade_number)
            )
        except GradeConfiguration.DoesNotExist:
            raise serializers.ValidationError({"grade": f"Grade {grade_number} not found for this school."})
        
        try:
            section_obj = Section.objects.get(school=school, grade_config=grade_obj, section_letter=section_letter)
        except Section.DoesNotExist:
            raise serializers.ValidationError({"section": f"Section {section_letter} in Grade {grade_number} not found."})

        with transaction.atomic():
            # 4. Create Identity (Matches your custom User schema - NO USERNAME)
            user = User.objects.create(
                email=email, 
                user_type='STUDENT',
                first_name=first_name, 
                last_name=last_name, 
                phone_number=phone,
                school=school
            )
            user.set_password("Student@123")
            user.save()

            # 5. Create Student Profile linked to User
            # SUID is auto-generated in your Student model save() logic
            student = Student.objects.create(
                user=user, 
                middle_name=middle_name,
                school=school,
                grade_config=grade_obj,
                current_section=section_obj,
                **validated_data
            )

            # 6. Create Enrollment Record with validated grade/section stored as strings
            StudentEnrollment.objects.create(
                student=student, 
                grade=grade_number,
                section=section_letter,
                status='ACTIVE', 
                school=school
            )

        return student


class GuardianSerializer(serializers.ModelSerializer):
    """Serializer for parent/guardian information"""
    class Meta:
        model = Guardian
        fields = ['id', 'name', 'relationship', 'phone', 'email', 'occupation', 
                  'workplace', 'annual_income', 'is_primary', 'can_pickup']


class StudentDocumentSerializer(serializers.ModelSerializer):
    """Serializer for student documents"""
    class Meta:
        model = StudentDocument
        fields = ['id', 'document_type', 'title', 'file', 'academic_year', 'uploaded_at', 'notes']


class StudentHistorySerializer(serializers.ModelSerializer):
    """Serializer for student academic history - FULL JOURNEY DATA"""
    awards = serializers.SerializerMethodField()
    class_teacher_id = serializers.UUIDField(source='class_teacher.id', read_only=True, allow_null=True)
    class_teacher_tuid = serializers.CharField(source='class_teacher.tuid', read_only=True, allow_null=True)
    
    class Meta:
        model = StudentHistory
        fields = [
            'id', 'academic_year_name', 'grade_name', 'section_name', 'roll_number',
            # Teacher info
            'class_teacher_id', 'class_teacher_tuid', 'class_teacher_name', 'teacher_remarks', 'remarks_date',
            # Academic performance
            'overall_grade', 'total_marks', 'percentage', 
            'class_rank', 'grade_rank', 'total_students_in_class', 'total_students_in_grade',
            # Attendance
            'attendance_percentage', 'total_working_days', 'days_present', 'days_absent', 'days_late',
            # Karma
            'karma_points_earned', 'karma_points_deducted', 'net_karma',
            # Achievement counts
            'achievements_count', 'certificates_count', 'awards_count',
            # Status
            'promoted', 'promotion_remarks', 'profile_photo_at_time',
            # Awards for this year
            'awards',
            'created_at', 'updated_at'
        ]
    
    def get_awards(self, obj):
        """Get all awards for this academic year"""
        from apps.achievements.models import StudentYearlyAward
        awards = StudentYearlyAward.objects.filter(
            student=obj.student, 
            academic_year=obj.academic_year_name
        )
        return [{
            'id': str(a.id),
            'title': a.title,
            'description': a.description,
            'award_type': a.award_type,
            'category': a.category,
            'level': a.level,
            'position': a.position,
            'cash_prize_amount': str(a.cash_prize_amount) if a.cash_prize_amount else None,
            'certificate_image': a.certificate_image.url if a.certificate_image else None,
            'event_name': a.event_name,
            'event_date': a.event_date.isoformat() if a.event_date else None,
            'awarded_by': a.awarded_by,
        } for a in awards]


class StudentDetailSerializer(FeatureFieldMixin, serializers.ModelSerializer):
    """Complete student profile serializer with all related data"""
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    
    guardians = GuardianSerializer(many=True, read_only=True)
    documents = StudentDocumentSerializer(many=True, read_only=True)
    history = StudentHistorySerializer(many=True, read_only=True)
    
    current_class = serializers.SerializerMethodField()
    current_grade_name = serializers.SerializerMethodField()
    current_section_name = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = [
            'id', 'suid', 'admission_number',
            'first_name', 'middle_name', 'last_name', 'full_name',
            'email', 'phone_number', 'phone',
            'date_of_birth', 'age', 'gender', 'blood_group',
            'profile_photo',
            'medical_conditions', 'emergency_contact_name', 'emergency_contact_phone',
            'address_line1', 'address_line2', 'city', 'state', 'pincode', 'address',
            'latitude', 'longitude',
            'category', 'religion', 'mother_tongue', 'languages_known',
            'nationality', 'birth_place', 'is_rte_student', 
            'fee_concession_applicable', 'house_color', 'alumni_directory_consent',
            'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
            'custom_attributes',
            'current_class', 'current_grade_name', 'current_section_name',
            'admission_date', 'graduation_date', 'status',
            'guardians', 'documents', 'history',
            'created_at', 'updated_at'
        ]
        feature_fields = {
            'EXTENDED_PROFILES': [
                'category', 'religion', 'mother_tongue', 'languages_known',
                'nationality', 'birth_place', 'house_color',
                'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
                'custom_attributes'
            ]
        }
    
    def get_current_class(self, obj):
        if obj.current_grade and obj.current_section:
            return f"{obj.current_grade.grade_name}-{obj.current_section.section_letter}"
        enrollment = obj.enrollments.filter(status='ACTIVE').first()
        return f"{enrollment.grade}-{enrollment.section}" if enrollment else "Unassigned"
    
    def get_current_grade_name(self, obj):
        if obj.current_grade:
            return obj.current_grade.grade_name
        return None
    
    def get_current_section_name(self, obj):
        if obj.current_section:
            return obj.current_section.section_letter
        return None
    
    def get_age(self, obj):
        if obj.date_of_birth:
            from datetime import date
            today = date.today()
            return today.year - obj.date_of_birth.year - (
                (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
            )
        return None