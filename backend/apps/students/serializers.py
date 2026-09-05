from rest_framework import serializers
from django.db import transaction
from django.apps import apps 
from .models import Student, Guardian, StudentDocument, StudentHistory, SchoolTenure
from apps.accounts.models import User
from apps.enrollments.models import StudentEnrollment
from apps.features.serializers import FeatureFieldMixin
import uuid


def _get_active_year_code(school):
    """
    Returns the active academic year code for a given school.
    Resolution order:
      1. AcademicYear with status='ACTIVE' for this school — but only if its
         date range actually covers today (guards against stale records after rollover)
      2. SchoolSettings.get_academic_year_code_for_date() (pure date calculation,
         always correct regardless of DB state)
      3. Empty string (never a hardcoded year)
    """
    from django.utils import timezone
    today = timezone.now().date()
    try:
        from apps.enrollments.models_promotion import AcademicYear
        from apps.schools.models_settings import sync_school_academic_years
        
        active = AcademicYear.objects.filter(school=school, status='ACTIVE').first()
        if not active or not (active.start_date <= today <= active.end_date):
            sync_school_academic_years(school)
            active = AcademicYear.objects.filter(school=school, status='ACTIVE').first()

        if active and active.start_date <= today <= active.end_date:
            return active.year_code
    except Exception:
        pass
    try:
        from apps.schools.models_settings import SchoolSettings
        settings_obj = SchoolSettings.objects.filter(school=school).first()
        if settings_obj:
            return settings_obj.get_academic_year_code_for_date() or ''
    except Exception:
        pass
    return ''


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
    roll_number = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    # --- INPUT FIELDS (Admissions Form) ---
    address = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)

    user_email = serializers.EmailField(write_only=True, required=False, allow_blank=True, allow_null=True)
    grade = serializers.CharField(write_only=True, required=False, allow_blank=True)
    section = serializers.CharField(write_only=True, required=False, allow_blank=True)
    middle_name = serializers.CharField(required=False, allow_blank=True)

    doc_birth_certificate = serializers.FileField(write_only=True, required=False, allow_null=True)
    doc_transfer_certificate = serializers.FileField(write_only=True, required=False, allow_null=True)
    doc_mark_sheet = serializers.FileField(write_only=True, required=False, allow_null=True)

    allergies = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Student
        fields = [
            'id', 'suid', 'full_name', 
            'first_name', 'middle_name', 'last_name',
            'email', 'phone_number', 
            'profile_photo', 'blood_group', 'address', 'date_of_birth', 'gender', 
            'current_class', 'grade_config', 'current_section', 'roll_number',
            'latitude', 'longitude',
            'transport_assignment',
            'user_email', 'grade', 'section',
            'category', 'religion', 'mother_tongue', 'languages_known',
            'nationality', 'birth_place', 'is_rte_student', 
            'fee_concession_applicable', 'fee_concession_amount', 'house_color', 'alumni_directory_consent',
            'aadhaar_number', 'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
            'medical_conditions', 'allergies',
            'admission_number', 'admission_date',
            'doc_birth_certificate', 'doc_transfer_certificate', 'doc_mark_sheet',
            'custom_attributes', 'status'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if hasattr(instance, 'health_profile') and instance.health_profile:
            data['allergies'] = instance.health_profile.allergies or instance.medical_conditions or ''
        else:
            data['allergies'] = instance.medical_conditions or ''
        return data

        read_only_fields = ['suid', 'email']
        feature_fields = {
            'EXTENDED_PROFILES': [
                'category', 'religion', 'mother_tongue', 'languages_known',
                'nationality', 'birth_place', 'house_color',
                'aadhaar_number', 'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
                'admission_number', 'admission_date',
                'custom_attributes'
            ]
        }

    def get_current_class(self, obj):
        """Returns the student's active enrollment class (e.g., 10-A)."""
        enrollment = obj.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY']).first()
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
        from django.http import QueryDict
        if isinstance(data, QueryDict):
            new_data = QueryDict(mutable=True)
            for key, val_list in data.lists():
                new_data.setlist(key, val_list)
            data = new_data
        elif hasattr(data, 'copy'):
            data = data.copy()
            
        if 'gender' in data and data['gender']:
            val = str(data['gender']).upper()
            if val in ['MALE', 'M', '"MALE"']: data['gender'] = 'M'
            elif val in ['FEMALE', 'F', '"FEMALE"']: data['gender'] = 'F'
            elif val in ['OTHER', 'O', '"OTHER"']: data['gender'] = 'O'

        # Normalize coordinates to 6 decimal places to satisfy max_digits=9, decimal_places=6
        if 'latitude' in data and data['latitude']:
            try:
                data['latitude'] = f"{float(data['latitude']):.6f}"
            except (ValueError, TypeError):
                pass
        if 'longitude' in data and data['longitude']:
            try:
                data['longitude'] = f"{float(data['longitude']):.6f}"
            except (ValueError, TypeError):
                pass

        return super().to_internal_value(data)

    def validate(self, attrs):
        """Enforce required fields."""
        status_val = attrs.get('status', 'ACTIVE')
        
        # self.instance is None on create, set on update
        if self.instance is None:
            if not attrs.get('user_email') or not str(attrs.get('user_email')).strip():
                raise serializers.ValidationError({'user_email': 'Email is required when adding a new student.'})
            
            # Require phone number
            user_data = attrs.get('user', {})
            phone = user_data.get('phone_number') or attrs.get('phone_number') or attrs.get('user_phone')
            if not phone or not str(phone).strip():
                raise serializers.ValidationError({'phone_number': 'Phone number is required.'})

            # Enforce validation only for ACTIVE status
            if status_val == 'ACTIVE':
                mandatory_fields = ['address', 'latitude', 'longitude']
                for field in mandatory_fields:
                    if not attrs.get(field):
                        raise serializers.ValidationError({field: f'{field.replace("_", " ").capitalize()} is required.'})
                if not attrs.get('grade'):
                    raise serializers.ValidationError({'grade': 'Grade is required for active admission.'})
                if not attrs.get('section'):
                    raise serializers.ValidationError({'section': 'Section is required for active admission.'})
                if not attrs.get('doc_birth_certificate'):
                    raise serializers.ValidationError({'doc_birth_certificate': 'Birth certificate is required.'})
        else:
            # If updating to ACTIVE status, also validate fields
            if status_val == 'ACTIVE':
                mandatory_fields = ['address', 'latitude', 'longitude']
                for field in mandatory_fields:
                    val = attrs.get(field) if field in attrs else getattr(self.instance, field)
                    if not val:
                        raise serializers.ValidationError({field: f'{field.replace("_", " ").capitalize()} is required for active status.'})
        return attrs

    def update(self, instance, validated_data):
        """Handles updating both the User Identity and Student Profile."""
        user_data = validated_data.pop('user', {})
        
        user_email = validated_data.pop('user_email', None)
        grade_number = validated_data.pop('grade', None)
        section_letter = validated_data.pop('section', None)
        roll_number_val = validated_data.pop('roll_number', None)
        allergies_val = validated_data.pop('allergies', None)
        
        # Also strip out the write-only document fields on update
        doc_birth = validated_data.pop('doc_birth_certificate', None)
        doc_transfer = validated_data.pop('doc_transfer_certificate', None)
        doc_mark = validated_data.pop('doc_mark_sheet', None)


        with transaction.atomic():
            # 1. Update User Identity (Names/Phone/Email)
            user = instance.user
            if user_data:
                for attr, value in user_data.items():
                    setattr(user, attr, value)
            if user_email:
                user.email = user_email.strip().lower()
            user.save()
            
            # 2. Update Grade and Section
            if grade_number or section_letter:
                from apps.academics.models import Section
                from apps.schools.models_programs import GradeConfiguration
                from apps.enrollments.models import StudentEnrollment
                
                school = instance.school
                
                if not grade_number and instance.grade_config:
                    grade_number = instance.grade_config.grade_name
                if not section_letter and instance.current_section:
                    section_letter = instance.current_section.section_letter
                    
                if grade_number and section_letter:
                    from apps.schools.models_programs import AcademicProgram
                    import re

                    program = AcademicProgram.objects.filter(school=school, is_active=True).first()
                    if not program:
                        program = AcademicProgram.objects.filter(school=school).first()
                    if not program:
                        program = AcademicProgram.objects.create(
                            school=school,
                            name="General Program",
                            code="GEN",
                            board="CUSTOM",
                            evaluation_system="MARKS",
                            academic_pattern="ANNUAL",
                            is_active=True
                        )

                    grade_name_str = str(grade_number).strip()
                    grade_obj = GradeConfiguration.objects.filter(
                        program__school=school, 
                        grade_name=grade_name_str
                    ).first()

                    if not grade_obj:
                        try:
                            nums = re.findall(r'\d+', grade_name_str)
                            if nums:
                                grade_order = int(nums[0])
                            else:
                                max_order_agg = GradeConfiguration.objects.filter(program=program).aggregate(models.Max('grade_order'))
                                grade_order = (max_order_agg.get('grade_order__max') or 0) + 1
                        except:
                            grade_order = 1
                        
                        grade_obj = GradeConfiguration.objects.create(
                            program=program,
                            grade_name=grade_name_str,
                            grade_order=grade_order,
                            max_sections=5,
                            default_section_names=["A", "B", "C"],
                            section_capacity=50,
                            is_active=True
                        )

                    section_letter_str = str(section_letter).strip().upper()
                    if not section_letter_str:
                        section_letter_str = "A"

                    section_obj = Section.objects.filter(
                        school=school, 
                        grade_config=grade_obj, 
                        section_letter=section_letter_str
                    ).first()

                    if not section_obj:
                        section_obj = Section.objects.create(
                            school=school,
                            grade_config=grade_obj,
                            section_letter=section_letter_str,
                            capacity=50,
                            is_active=True
                        )
                    
                    instance.grade_config = grade_obj
                    instance.current_section = section_obj
                    
                    year_code = _get_active_year_code(school)
                    
                    enrollment = StudentEnrollment.objects.filter(
                        student=instance,
                        school=school,
                        academic_year=year_code,
                        status='ACTIVE'
                    ).first()
                    
                    if not enrollment:
                        enrollment = StudentEnrollment.objects.filter(
                            student=instance,
                            school=school,
                            academic_year=year_code
                        ).first()
                        
                    if enrollment:
                        enrollment.grade = grade_number
                        enrollment.section = section_letter
                        if roll_number_val is not None:
                            enrollment.roll_number = roll_number_val
                        enrollment.status = instance.status
                        enrollment.save()
                    else:
                        StudentEnrollment.objects.create(
                            student=instance,
                            school=school,
                            academic_year=year_code,
                            grade=grade_number,
                            section=section_letter,
                            status=instance.status,
                            roll_number=roll_number_val
                        )
            else:
                if roll_number_val is not None:
                    active_enrollment = instance.enrollments.filter(status='ACTIVE').first()
                    if not active_enrollment:
                        active_enrollment = instance.enrollments.first()
                    if active_enrollment:
                        active_enrollment.roll_number = roll_number_val
                        active_enrollment.save()
            
            # 3. Update Student Profile (Address/Middle Name/photo/etc.)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            if allergies_val is not None:
                instance.medical_conditions = allergies_val
                from apps.health.models import StudentHealthProfile
                health_prof, _ = StudentHealthProfile.objects.get_or_create(student=instance)
                health_prof.allergies = allergies_val
                health_prof.save()
            instance.save()


            # 3. Create Documents if passed (deleting existing ones of same type to avoid duplicates)
            if doc_birth:
                StudentDocument.objects.filter(student=instance, document_type='BIRTH_CERTIFICATE').delete()
                StudentDocument.objects.create(
                    student=instance,
                    document_type='BIRTH_CERTIFICATE',
                    title='Birth Certificate',
                    file=doc_birth
                )
            if doc_transfer:
                StudentDocument.objects.filter(student=instance, document_type='TRANSFER_CERTIFICATE').delete()
                StudentDocument.objects.create(
                    student=instance,
                    document_type='TRANSFER_CERTIFICATE',
                    title='Transfer Certificate',
                    file=doc_transfer
                )
            if doc_mark:
                StudentDocument.objects.filter(student=instance, document_type='MARK_SHEET').delete()
                StudentDocument.objects.create(
                    student=instance,
                    document_type='MARK_SHEET',
                    title='Mark Sheet',
                    file=doc_mark
                )

            # 4. Create Custom Documents if passed
            request = self.context.get('request')
            if request:
                custom_files = request.FILES.getlist('custom_doc_files')
                if hasattr(request.data, 'getlist'):
                    custom_titles = request.data.getlist('custom_doc_titles')
                else:
                    custom_titles = request.data.get('custom_doc_titles', [])
                    if not isinstance(custom_titles, list):
                        custom_titles = [custom_titles] if custom_titles is not None else []
                for title, file in zip(custom_titles, custom_files):
                    if title and file:
                        StudentDocument.objects.create(
                            student=instance,
                            document_type='OTHER',
                            title=title,
                            file=file
                        )
        return instance

    def create(self, validated_data):
        """Creates User Identity, Student Profile, and Class Enrollment in one transaction."""
        # 1. Extract Identity and Academic Data
        user_data = validated_data.pop('user', {})
        first_name = user_data.get('first_name')
        last_name = user_data.get('last_name', '')
        
        middle_name = validated_data.pop('middle_name', '')
        email = validated_data.pop('user_email', '') or None 
        phone = user_data.get('phone_number', '') or None
        
        status_val = validated_data.pop('status', 'ACTIVE')
        grade_number = validated_data.pop('grade', None)
        section_letter = validated_data.pop('section', None)
        roll_number_val = validated_data.pop('roll_number', None)
        allergies_val = validated_data.pop('allergies', None)

        doc_birth = validated_data.pop('doc_birth_certificate', None)

        doc_transfer = validated_data.pop('doc_transfer_certificate', None)
        doc_mark = validated_data.pop('doc_mark_sheet', None)
        school_val = validated_data.pop('school', None)

        # 2. Resolve the school from the request context / logged-in user
        request = self.context.get('request')
        school = school_val
        if not school and request and request.user and request.user.is_authenticated:
            school = request.user.school
            if not school and request.user.user_type == 'PLATFORM_ADMIN':
                school_id = request.data.get('school') or request.query_params.get('school')
                if school_id:
                    School = apps.get_model('schools', 'School')
                    school = School.objects.filter(id=school_id).first()

        if not school:
            try:
                School = apps.get_model('schools', 'School')
                school = School.objects.first()
                if not school:
                    school = School.objects.create(legal_name="Main Campus", display_name="Main Campus", code="MC-01")
            except Exception as e:
                raise serializers.ValidationError({"detail": f"School configuration missing: {str(e)}"})

        # 3. Get or create Grade and Section
        from apps.academics.models import Section
        from apps.schools.models_programs import GradeConfiguration, AcademicProgram
        import re

        # Resolve or create academic program
        program = AcademicProgram.objects.filter(school=school, is_active=True).first()
        if not program:
            program = AcademicProgram.objects.filter(school=school).first()
        if not program:
            program = AcademicProgram.objects.create(
                school=school,
                name="General Program",
                code="GEN",
                board="CUSTOM",
                evaluation_system="MARKS",
                academic_pattern="ANNUAL",
                is_active=True
            )

        grade_obj = None
        section_obj = None

        if grade_number:
            grade_name_str = str(grade_number).strip()
            grade_obj = GradeConfiguration.objects.filter(
                program__school=school, 
                grade_name=grade_name_str
            ).first()

            if not grade_obj:
                try:
                    nums = re.findall(r'\d+', grade_name_str)
                    if nums:
                        grade_order = int(nums[0])
                    else:
                        max_order_agg = GradeConfiguration.objects.filter(program=program).aggregate(models.Max('grade_order'))
                        grade_order = (max_order_agg.get('grade_order__max') or 0) + 1
                except:
                    grade_order = 1
                
                grade_obj = GradeConfiguration.objects.create(
                    program=program,
                    grade_name=grade_name_str,
                    grade_order=grade_order,
                    max_sections=5,
                    default_section_names=["A", "B", "C"],
                    section_capacity=50,
                    is_active=True
                )

            if section_letter:
                section_letter_str = str(section_letter).strip().upper()
                if not section_letter_str:
                    section_letter_str = "A"

                section_obj = Section.objects.filter(
                    school=school, 
                    grade_config=grade_obj, 
                    section_letter=section_letter_str
                ).first()

                if not section_obj:
                    section_obj = Section.objects.create(
                        school=school,
                        grade_config=grade_obj,
                        section_letter=section_letter_str,
                        capacity=50,
                        is_active=True
                    )

        with transaction.atomic():
            clean_email = str(email).strip().lower() if email else None

            # 4. Create Identity (Matches your custom User schema - NO USERNAME)
            user = User.objects.create(
                email=clean_email, 
                user_type='STUDENT',
                first_name=first_name, 
                last_name=last_name, 
                phone_number=phone,
                school=school
            )
            user.set_password("Student@123")
            user.save()

            if allergies_val is not None:
                validated_data['medical_conditions'] = allergies_val

            # 5. Create Student Profile linked to User
            # SUID is auto-generated in your Student model save() logic
            student = Student.objects.create(
                user=user, 
                middle_name=middle_name,
                school=school,
                grade_config=grade_obj,
                current_section=section_obj,
                status=status_val,
                **validated_data
            )

            if allergies_val is not None:
                from apps.health.models import StudentHealthProfile
                StudentHealthProfile.objects.update_or_create(student=student, defaults={'allergies': allergies_val})


            # Create Documents if passed
            if doc_birth:
                StudentDocument.objects.create(
                    student=student,
                    document_type='BIRTH_CERTIFICATE',
                    title='Birth Certificate',
                    file=doc_birth
                )
            if doc_transfer:
                StudentDocument.objects.create(
                    student=student,
                    document_type='TRANSFER_CERTIFICATE',
                    title='Transfer Certificate',
                    file=doc_transfer
                )
            if doc_mark:
                StudentDocument.objects.create(
                    student=student,
                    document_type='MARK_SHEET',
                    title='Mark Sheet',
                    file=doc_mark
                )

            # Create Custom Documents if passed
            request = self.context.get('request')
            if request:
                custom_files = request.FILES.getlist('custom_doc_files')
                if hasattr(request.data, 'getlist'):
                    custom_titles = request.data.getlist('custom_doc_titles')
                else:
                    custom_titles = request.data.get('custom_doc_titles', [])
                    if not isinstance(custom_titles, list):
                        custom_titles = [custom_titles] if custom_titles is not None else []
                for title, file in zip(custom_titles, custom_files):
                    if title and file:
                        StudentDocument.objects.create(
                            student=student,
                            document_type='OTHER',
                            title=title,
                            file=file
                        )

            # 6. Create Enrollment Record with validated grade/section stored as strings
            if grade_number and section_letter:
                StudentEnrollment.objects.create(
                    student=student,
                    grade=grade_number,
                    section=section_letter,
                    status=student.status,
                    school=school,
                    academic_year=_get_active_year_code(school),
                    roll_number=roll_number_val
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
    roll_number = serializers.CharField(read_only=True)
    allergies = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = [
            'id', 'suid', 'admission_number',
            'first_name', 'middle_name', 'last_name', 'full_name',
            'email', 'phone_number', 'phone',
            'date_of_birth', 'age', 'gender', 'blood_group',
            'profile_photo',
            'medical_conditions', 'allergies', 'emergency_contact_name', 'emergency_contact_phone',
            'address_line1', 'address_line2', 'city', 'state', 'pincode', 'address',
            'latitude', 'longitude',
            'category', 'religion', 'mother_tongue', 'languages_known',
            'nationality', 'birth_place', 'is_rte_student', 
            'fee_concession_applicable', 'fee_concession_amount', 'house_color', 'alumni_directory_consent',
            'aadhaar_number', 'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
            'custom_attributes',
            'current_class', 'current_grade_name', 'current_section_name', 'roll_number',
            'admission_date', 'graduation_date', 'status',
            'guardians', 'documents', 'history',
            'created_at', 'updated_at'
        ]
        feature_fields = {
            'EXTENDED_PROFILES': [
                'category', 'religion', 'mother_tongue', 'languages_known',
                'nationality', 'birth_place', 'house_color',
                'aadhaar_number', 'aadhaar_last_4_digits', 'apaar_id', 'pen_id', 'dietary_preference',
                'custom_attributes'
            ]
        }

    def get_allergies(self, obj):
        if hasattr(obj, 'health_profile') and obj.health_profile and obj.health_profile.allergies:
            return obj.health_profile.allergies
        return obj.medical_conditions or ''

    
    def get_current_class(self, obj):
        if obj.current_grade and obj.current_section:
            return f"{obj.current_grade.grade_name}-{obj.current_section.section_letter}"
        enrollment = obj.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY']).first()
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

class SchoolTenureSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolTenure
        fields = '__all__'