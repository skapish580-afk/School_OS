from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
import json
from .models import (
    Section, Subject, SubjectMapping, Timetable, Period,
    Syllabus, Chapter, Exam, Result, ReportCard
)
from apps.schools.models_programs import GradeConfiguration
from apps.schools.serializers_programs import GradeConfigurationSerializer
from apps.features.services import school_has_feature


# ============================================================
# CLASS & SECTION SERIALIZERS
# ============================================================

# NOTE: GradeSerializer removed - use GradeConfigurationSerializer from schools app


class SectionListSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade_config.grade_name', read_only=True)
    grade_order = serializers.IntegerField(source='grade_config.grade_order', read_only=True)
    class_teacher_name = serializers.CharField(source='class_teacher.user.full_name', read_only=True, allow_null=True)
    student_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = ['id', 'full_name', 'grade_name', 'grade_order', 'section_letter', 'capacity', 'class_teacher_name', 'student_count', 'is_active']
    
    def get_student_count(self, obj):
        from apps.enrollments.models import StudentEnrollment
        # grade and section are stored as strings in StudentEnrollment
        return StudentEnrollment.objects.filter(
            school_id=obj.school_id,
            section=obj,  # Use section directly
            status='ACTIVE'
        ).count()


class SectionDetailSerializer(serializers.ModelSerializer):
    grade_info = GradeConfigurationSerializer(source='grade_config', read_only=True)
    class_teacher_info = serializers.SerializerMethodField()
    subjects = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = ['id', 'grade_info', 'section_letter', 'capacity', 'class_teacher_info', 'is_active', 'subjects', 'created_at']
    
    def get_class_teacher_info(self, obj):
        if obj.class_teacher:
            return {
                'id': str(obj.class_teacher.id),
                'name': obj.class_teacher.user.full_name,
                'email': obj.class_teacher.user.email
            }
        return None
    
    def get_subjects(self, obj):
        mappings = obj.subject_mappings.filter(is_active=True)
        return SubjectMappingListSerializer(mappings, many=True).data


class SectionSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating sections with write-only foreign key IDs"""
    school_id = serializers.UUIDField(write_only=True)
    grade_id = serializers.UUIDField(write_only=True)
    class_teacher_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    co_class_teacher_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    
    # Read-only display fields
    grade_name = serializers.CharField(source='grade_config.grade_name', read_only=True)
    class_teacher_name = serializers.CharField(source='class_teacher.user.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Section
        fields = [
            'id', 'school_id', 'grade_id', 'grade_name', 'section_letter', 'capacity',
            'class_teacher_id', 'class_teacher_name', 'co_class_teacher_id',
            'room_number', 'capacity_locked', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, data):
        from apps.schools.models import School
        from apps.teachers.models import Teacher
        
        school_id = data.get('school_id')
        grade_id = data.get('grade_id')
        
        # Validate school exists
        try:
            school = School.objects.get(id=school_id)
        except School.DoesNotExist:
            raise serializers.ValidationError({'school_id': 'School not found'})
        
        # Validate grade config exists
        grade_id = data.get('grade_config_id') or data.get('grade_id')
        try:
            grade_config = GradeConfiguration.objects.select_related('program__school').get(id=grade_id)
            # Use the school from the grade configuration as the source of truth
            school = grade_config.program.school
            data['school'] = school
            data['grade_config'] = grade_config
        except GradeConfiguration.DoesNotExist:
            raise serializers.ValidationError({'grade_id': 'Grade not found'})
        
        # Validate class teacher if provided
        class_teacher_id = data.get('class_teacher_id')
        if class_teacher_id:
            try:
                teacher = Teacher.objects.get(id=class_teacher_id, school=school)
                data['class_teacher'] = teacher
            except Teacher.DoesNotExist:
                raise serializers.ValidationError({'class_teacher_id': 'Teacher not found or belongs to a different school'})
        
        # Validate co-class teacher if provided
        co_class_teacher_id = data.get('co_class_teacher_id')
        if co_class_teacher_id:
            try:
                teacher = Teacher.objects.get(id=co_class_teacher_id, school=school)
                data['co_class_teacher'] = teacher
            except Teacher.DoesNotExist:
                raise serializers.ValidationError({'co_class_teacher_id': 'Co-teacher not found or belongs to a different school'})
        
        # Check uniqueness
        section_letter = data.get('section_letter')
        if Section.objects.filter(school=school, grade_config=grade_config, section_letter=section_letter).exists():
            raise serializers.ValidationError(
                f'Section {section_letter} already exists for {grade_config.grade_name}'
            )
        
        return data
    
    def create(self, validated_data):
        # Remove write-only ID fields and use resolved instances
        validated_data.pop('school_id', None)
        validated_data.pop('grade_id', None) # Clean up both names if present
        validated_data.pop('grade_config_id', None)
        validated_data.pop('class_teacher_id', None)
        validated_data.pop('co_class_teacher_id', None)
        
        return Section.objects.create(**validated_data)


# ============================================================
# SUBJECT SERIALIZERS
# ============================================================

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'description', 'is_core', 'subject_type', 'passing_marks', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class SubjectMappingListSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    
    class Meta:
        model = SubjectMapping
        fields = ['id', 'subject_name', 'subject_code', 'section_name', 'teacher_name', 'periods_per_week', 'max_marks', 'is_active']

    def get_teacher_name(self, obj):
        if obj.teacher:
            return obj.teacher.user.full_name
            
        # Fallback to TeacherAssignment in teachers app
        from apps.teachers.models import TeacherAssignment
        from django.db.models import Q
        
        # Try to find any active assignment for this subject and section
        # We match by strings since TeacherAssignment uses CharFields
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            grade__iexact=obj.section.grade_config.grade_name,
            section__iexact=obj.section.section_letter,
            subject__iexact=obj.subject.name,
            is_active=True
        ).order_by('-created_at').first()
        
        if assignment:
            return assignment.teacher.user.full_name
            
        # Second fallback: If it's a Class Teacher assignment without a specific subject
        class_teacher = TeacherAssignment.objects.filter(
            school=obj.school,
            grade__iexact=obj.section.grade_config.grade_name,
            section__iexact=obj.section.section_letter,
            role='CLASS_TEACHER',
            is_active=True
        ).order_by('-created_at').first()
        
        return class_teacher.teacher.user.full_name if class_teacher else None


class SubjectMappingDetailSerializer(serializers.ModelSerializer):
    subject_info = SubjectSerializer(source='subject', read_only=True)
    teacher_info = serializers.SerializerMethodField()
    section_info = SectionListSerializer(source='section', read_only=True)
    
    class Meta:
        model = SubjectMapping
        fields = ['id', 'subject_info', 'section_info', 'teacher_info', 'periods_per_week', 'max_marks', 'is_active']
    
    def get_teacher_info(self, obj):
        teacher = obj.teacher
        
        # Fallback to TeacherAssignment if no direct teacher mapping
        if not teacher:
            from apps.teachers.models import TeacherAssignment
            assignment = TeacherAssignment.objects.filter(
                school=obj.school,
                grade__iexact=obj.section.grade_config.grade_name,
                section__iexact=obj.section.section_letter,
                subject__iexact=obj.subject.name,
                is_active=True
            ).order_by('-created_at').first()
            
            if assignment:
                teacher = assignment.teacher
            else:
                # Fallback to class teacher
                class_teacher = TeacherAssignment.objects.filter(
                    school=obj.school,
                    grade__iexact=obj.section.grade_config.grade_name,
                    section__iexact=obj.section.section_letter,
                    role='CLASS_TEACHER',
                    is_active=True
                ).order_by('-created_at').first()
                if class_teacher:
                    teacher = class_teacher.teacher

        if teacher:
            return {
                'id': str(teacher.id),
                'name': teacher.user.full_name,
                'email': teacher.user.email
            }
        return None


# ============================================================
# TIMETABLE SERIALIZERS
# ============================================================

class PeriodSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject_mapping.subject.name', read_only=True, allow_null=True)
    teacher_name = serializers.CharField(source='subject_mapping.teacher.user.full_name', read_only=True, allow_null=True)
    day_display = serializers.CharField(source='get_day_display', read_only=True)
    
    # Write-only fields
    timetable_id = serializers.UUIDField(write_only=True, required=False)
    subject_id = serializers.UUIDField(write_only=True, required=True)
    
    class Meta:
        model = Period
        fields = [
            'id', 'day', 'day_display', 'period_number', 'start_time', 'end_time', 
            'subject_name', 'teacher_name', 'classroom', 'timetable_id', 'subject_id'
        ]
        read_only_fields = ['day_display']
    
    def validate(self, data):
        """Validate period data"""
        timetable_id = data.get('timetable_id')
        subject_id = data.get('subject_id')
        
        # Validate timetable if provided
        if timetable_id:
            try:
                timetable = Timetable.objects.get(id=timetable_id)
                data['timetable'] = timetable
            except Timetable.DoesNotExist:
                raise serializers.ValidationError({'timetable_id': 'Timetable not found'})
        
        # Auto-create or fetch subject mapping from subject_id
        if subject_id and 'timetable' in data:
            try:
                subject = Subject.objects.get(id=subject_id)
                mapping, _ = SubjectMapping.objects.get_or_create(
                    school=data['timetable'].school,
                    section=data['timetable'].section,
                    subject=subject
                )
                data['subject_mapping'] = mapping
            except Subject.DoesNotExist:
                raise serializers.ValidationError({'subject_id': 'Subject not found'})
        
        return data
    
    def create(self, validated_data):
        """Create period with explicit FK relationships"""
        timetable_id = validated_data.pop('timetable_id', None)
        subject_id = validated_data.pop('subject_id', None)
        
        if timetable_id:
            validated_data['timetable_id'] = timetable_id
        
        return Period.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        """Update period"""
        timetable_id = validated_data.pop('timetable_id', None)
        subject_id = validated_data.pop('subject_id', None)
        
        if timetable_id:
            validated_data['timetable_id'] = timetable_id
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class TimetableSerializer(serializers.ModelSerializer):
    # Read-only display fields
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    section_id = serializers.SerializerMethodField()
    periods = PeriodSerializer(many=True, read_only=True)
    
    # Write-only ID fields for creation
    school_id = serializers.UUIDField(write_only=True, required=False)
    section_id_write = serializers.UUIDField(write_only=True, required=True)
    
    class Meta:
        model = Timetable
        fields = ['id', 'section_name', 'section_id', 'periods', 'created_at', 'updated_at', 'school_id', 'section_id_write']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_section_id(self, obj):
        return str(obj.section.id)
    
    def validate(self, data):
        """Validate same-school and feature flag"""
        if self.instance:  # Skip on update
            return data
        
        section_id_write = data.get('section_id_write')
        
        try:
            section = Section.objects.get(id=section_id_write)
        except Section.DoesNotExist:
            raise serializers.ValidationError({'section_id': 'Section not found'})
            
        # Always infer school from section to prevent mismatch
        school_id = section.school_id
        data['school_id'] = school_id
        
        # 1. Check feature flag
        if not school_has_feature(school_id, 'ACADEMICS'):
            raise serializers.ValidationError({'school_id': 'Timetable management not enabled for this school'})
        
        # 3. Check if timetable already exists for section
        if Timetable.objects.filter(section_id=section_id_write).exists():
            raise serializers.ValidationError({'section_id': 'Timetable already exists for this section'})
        
        return data
    
    def create(self, validated_data):
        """Create timetable with explicit FKs"""
        school_id = validated_data.pop('school_id')
        section_id_write = validated_data.pop('section_id_write')
        
        return Timetable.objects.create(
            school_id=school_id,
            section_id=section_id_write,
            **validated_data
        )


# ============================================================
# SYLLABUS & CHAPTER SERIALIZERS
# ============================================================

class ChapterSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    last_updated_by_name = serializers.CharField(source='last_updated_by.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Chapter
        fields = [
            'id', 'syllabus', 'chapter_number', 'title', 'description', 'status', 'status_display',
            'planned_start_date', 'planned_end_date', 'actual_completion_date',
            'last_updated_by_name', 'last_updated_at'
        ]
        read_only_fields = ['last_updated_at']


class SyllabusSerializer(serializers.ModelSerializer):
    # Read-only display fields
    subject_name = serializers.CharField(source='subject_mapping.subject.name', read_only=True)
    section_name = serializers.CharField(source='subject_mapping.section.full_name', read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    chapters = ChapterSerializer(many=True, read_only=True)
    progress_percentage = serializers.ReadOnlyField()
    
    # Write-only ID fields for creation
    school_id = serializers.UUIDField(write_only=True, required=True)
    subject_mapping_id = serializers.UUIDField(write_only=True, required=True)
    
    class Meta:
        model = Syllabus
        fields = [
            'id', 'subject_name', 'section_name', 'teacher_name', 'total_chapters',
            'academic_year', 'chapters', 'progress_percentage', 'created_at', 'updated_at',
            'school_id', 'subject_mapping_id'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_teacher_name(self, obj):
        if obj.subject_mapping.teacher:
            return obj.subject_mapping.teacher.user.full_name
            
        # Fallback to TeacherAssignment
        from apps.teachers.models import TeacherAssignment
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            grade__iexact=obj.subject_mapping.section.grade_config.grade_name,
            section__iexact=obj.subject_mapping.section.section_letter,
            subject__iexact=obj.subject_mapping.subject.name,
            academic_year=obj.academic_year,
            is_active=True
        ).order_by('-created_at').first()
        
        if assignment:
            return assignment.teacher.user.full_name
            
        # Fallback to class teacher for the same year
        class_teacher = TeacherAssignment.objects.filter(
            school=obj.school,
            grade__iexact=obj.subject_mapping.section.grade_config.grade_name,
            section__iexact=obj.subject_mapping.section.section_letter,
            academic_year=obj.academic_year,
            role='CLASS_TEACHER',
            is_active=True
        ).order_by('-created_at').first()
        
        return class_teacher.teacher.user.full_name if class_teacher else None
    
    def validate(self, data):
        """Validate same-school, feature flag, and active academic year"""
        from apps.features.models import SchoolFeatureConfig
        
        if self.instance:  # Skip on update
            return data
        
        school_id = data.get('school_id')
        subject_mapping_id = data.get('subject_mapping_id')
        
        # 1. Check feature flag
        if not school_has_feature(school_id, 'ACADEMICS'):  # Syllabus tied to academics feature
            raise serializers.ValidationError({'school_id': 'Syllabus tracking not enabled for this school'})
        
        # 2. Validate subject_mapping belongs to school
        try:
            subject_mapping = SubjectMapping.objects.get(id=subject_mapping_id)
            if str(subject_mapping.school_id) != str(school_id):
                raise serializers.ValidationError({'subject_mapping_id': 'Subject mapping does not belong to this school'})
        except SubjectMapping.DoesNotExist:
            raise serializers.ValidationError({'subject_mapping_id': 'Subject mapping not found'})
        
        # 3. Check if syllabus already exists
        if Syllabus.objects.filter(subject_mapping_id=subject_mapping_id).exists():
            raise serializers.ValidationError({'subject_mapping_id': 'Syllabus already exists for this subject mapping'})
        
        # 4. Validate active academic year (optional enforcement)
        try:
            config = SchoolFeatureConfig.objects.get(school_id=school_id, feature__code='ACADEMIC_YEAR')
            config_data = json.loads(config.config_json)
            current_year = config_data.get('current')
            if current_year and data.get('academic_year') != current_year:
                raise serializers.ValidationError({'academic_year': f'Academic year must be {current_year}'})
        except (SchoolFeatureConfig.DoesNotExist, json.JSONDecodeError, KeyError):
            pass
        
        return data
    
    def create(self, validated_data):
        """Create syllabus with explicit FKs"""
        school_id = validated_data.pop('school_id')
        subject_mapping_id = validated_data.pop('subject_mapping_id')
        
        return Syllabus.objects.create(
            school_id=school_id,
            subject_mapping_id=subject_mapping_id,
            **validated_data
        )


# ============================================================
# EXAM & RESULT SERIALIZERS
# ============================================================

class ExamSerializer(serializers.ModelSerializer):
    # Read-only display fields
    subject_name = serializers.CharField(source='subject_mapping.subject.name', read_only=True)
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    exam_type_display = serializers.CharField(source='get_exam_type_display', read_only=True)
    grade_name = serializers.CharField(source='section.grade_config.grade_name', read_only=True)
    section_id_display = serializers.UUIDField(source='section.id', read_only=True)
    
    # Write-only ID fields for creation
    school_id = serializers.UUIDField(write_only=True, required=False)
    section_id = serializers.UUIDField(write_only=True, required=True)
    subject_mapping_id = serializers.UUIDField(write_only=True, required=True)
    invigilator_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    
    class Meta:
        model = Exam
        fields = [
            'id', 'name', 'exam_type', 'exam_type_display', 'subject_name', 'section_name', 'grade_name',
            'exam_date', 'duration_minutes', 'max_marks', 'passing_marks', 'academic_year',
            'exam_room', 'min_attendance_percentage', 'grace_marks',
            'school_id', 'section_id', 'subject_mapping_id', 'invigilator_ids', 'section_id_display'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def validate(self, data):
        """Validate same-school, feature flag, and active academic year"""
        print(f"\n--- DEBUG: START EXAM VALIDATION ---")
        print(f"DEBUG: Incoming Data: {data}")
        from apps.schools.models import School
        from apps.teachers.models import Teacher
        from apps.features.models import SchoolFeatureConfig
        
        if self.instance:  # Skip on update
            return data
        
        school_id = data.get('school_id')
        section_id = data.get('section_id')
        subject_mapping_id = data.get('subject_mapping_id')
        invigilator_ids = data.get('invigilator_ids', [])
        
        # 1. Get Section and derive school_id if missing
        try:
            section = Section.objects.get(id=section_id)
            if not school_id:
                school_id = section.school_id
                data['school_id'] = school_id
                print(f"DEBUG: Derived school_id: {school_id}")
            elif str(section.school_id) != str(school_id):
                print(f"DEBUG: School mismatch. Section: {section.school_id}, Provided: {school_id}")
                raise serializers.ValidationError({'section_id': 'Section does not belong to this school'})
        except Section.DoesNotExist:
            print(f"DEBUG: Section {section_id} not found")
            raise serializers.ValidationError({'section_id': 'Section not found'})
            
        # 2. Check feature flag
        if not school_has_feature(school_id, 'ACADEMICS'):
            print(f"DEBUG: ACADEMICS feature disabled for school {school_id}")
            raise serializers.ValidationError({'school_id': 'Exam management not enabled for this school'})
        
        # 3. Validate subject_mapping belongs to section
        try:
            subject_mapping = SubjectMapping.objects.get(id=subject_mapping_id)
            if str(subject_mapping.section_id) != str(section_id):
                print(f"DEBUG: Mapping section mismatch. Mapping sect: {subject_mapping.section_id}, Provided sect: {section_id}")
                raise serializers.ValidationError({'subject_mapping_id': 'Subject mapping does not belong to this section'})
        except SubjectMapping.DoesNotExist:
            print(f"DEBUG: Subject mapping {subject_mapping_id} not found")
            raise serializers.ValidationError({'subject_mapping_id': 'Subject mapping not found'})
        
        # 4. Validate invigilators belong to school
        if invigilator_ids:
            invigilators = Teacher.objects.filter(id__in=invigilator_ids, school_id=school_id)
            if invigilators.count() != len(invigilator_ids):
                print(f"DEBUG: Invigilator mismatch. Found {invigilators.count()} of {len(invigilator_ids)}")
                raise serializers.ValidationError({'invigilator_ids': 'One or more invigilators do not belong to this school'})
        
        # 5. Validate active academic year
        try:
            config = SchoolFeatureConfig.objects.get(school_id=school_id, feature__code='ACADEMIC_YEAR')
            config_data = json.loads(config.config_json)
            current_year = config_data.get('current')
            if current_year and data.get('academic_year') != current_year:
                print(f"DEBUG: Year mismatch. Current: {current_year}, Provided: {data.get('academic_year')}")
                raise serializers.ValidationError({'academic_year': f'Academic year must be {current_year}'})
        except SchoolFeatureConfig.DoesNotExist:
            pass
        except (json.JSONDecodeError, KeyError) as e:
            print(f"DEBUG: Academic year config error: {str(e)}")
            pass
        
        print(f"DEBUG: VALIDATION SUCCESSFUL\n")
        return data
    
    def create(self, validated_data):
        """Create exam with explicit FKs from write-only IDs"""
        print(f"DEBUG: Creating exam with validated_data: {validated_data}")
        from apps.teachers.models import Teacher
        
        school_id = validated_data.pop('school_id')
        section_id = validated_data.pop('section_id')
        subject_mapping_id = validated_data.pop('subject_mapping_id')
        invigilator_ids = validated_data.pop('invigilator_ids', [])
        
        exam = Exam.objects.create(
            school_id=school_id,
            section_id=section_id,
            subject_mapping_id=subject_mapping_id,
            **validated_data
        )
        
        if invigilator_ids:
            invigilators = Teacher.objects.filter(id__in=invigilator_ids)
            exam.invigilators.set(invigilators)
        
        return exam


class ResultSerializer(serializers.ModelSerializer):
    # Read-only display fields
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subject_name = serializers.CharField(source='exam.subject_mapping.subject.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True, allow_null=True)
    percentage = serializers.SerializerMethodField()
    
    # Write-only ID fields for creation
    exam_id = serializers.UUIDField(write_only=True, required=True)
    student_id = serializers.IntegerField(write_only=True, required=True)
    
    class Meta:
        model = Result
        fields = [
            'id', 'student_name', 'student_suid', 'exam_name', 'subject_name',
            'marks_obtained', 'percentage', 'grade', 'grade_point', 'is_absent',
            'remarks', 'recorded_by_name', 'recorded_at',
            'exam_id', 'student_id'
        ]
        read_only_fields = ['grade', 'grade_point', 'recorded_at']
    
    def get_percentage(self, obj):
        if obj.is_absent:
            return 0
        return round((obj.marks_obtained / obj.exam.max_marks) * 100, 2)
    
    def validate(self, data):
        """Validate exam active, result window open, teacher permission, same school"""
        print(f"\n--- DEBUG: RESULT VALIDATION ---")
        print(f"DEBUG: Data received: {data}")
        from apps.students.models import Student
        from apps.features.models import SchoolFeatureConfig
        
        if self.instance:  # Skip on update
            return data
        
        exam_id = data.get('exam_id')
        student_id = data.get('student_id')
        request = self.context.get('request')
        
        # 1. Validate exam exists
        try:
            exam = Exam.objects.select_related('school', 'subject_mapping__teacher').get(id=exam_id)
        except Exam.DoesNotExist:
            raise serializers.ValidationError({'exam_id': 'Exam not found'})
        
        # 2. Check feature flag
        if not school_has_feature(exam.school_id, 'ACADEMICS'):
            raise serializers.ValidationError({'exam_id': 'Result entry not enabled for this school'})
        
        # 3. Validate exam has happened (today >= exam_date)
        if timezone.now().date() < exam.exam_date:
            raise serializers.ValidationError({'exam_id': 'Cannot enter results for future exams'})
        
        # 4. Validate result entry window is OPEN
        try:
            config = SchoolFeatureConfig.objects.get(school_id=exam.school_id, feature__code='MARKS_ENTRY')
            config_data = json.loads(config.config_json)
            days_after = config_data.get('result_entry_days_after_exam', 7)
        except (SchoolFeatureConfig.DoesNotExist, json.JSONDecodeError, KeyError):
            days_after = 7  # Default
        
        window_close = exam.exam_date + timedelta(days=days_after)
        if timezone.now().date() > window_close:
            raise serializers.ValidationError({'exam_id': f'Result entry window closed {days_after} days after exam date'})
        
        # 5. Validate student belongs to same school and section
        try:
            student = Student.objects.select_related('school').get(id=student_id)
            if str(student.school_id) != str(exam.school_id):
                raise serializers.ValidationError({'student_id': 'Student does not belong to exam school'})
            
            # Check section enrollment
            if str(student.current_section_id) != str(exam.section_id):
                raise serializers.ValidationError({'student_id': 'Student is not enrolled in this exam\'s section'})
        except Student.DoesNotExist:
            raise serializers.ValidationError({'student_id': 'Student not found'})
        
        # 6. Validate teacher permission (if request available)
        if request and request.user:
            user = request.user
            is_admin = (
                user.is_superuser or 
                getattr(user, 'is_staff', False) or 
                user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
            )
            is_subject_teacher = (
                hasattr(user, 'teacher') and 
                exam.subject_mapping.teacher_id and
                str(exam.subject_mapping.teacher_id) == str(user.teacher.id)
            )
            is_invigilator = exam.invigilators.filter(user_id=user.id).exists()
            
            print(f"DEBUG: Permission Check - is_admin: {is_admin}, is_teacher: {is_subject_teacher}, is_invigilator: {is_invigilator}")
            
            if not (is_admin or is_subject_teacher or is_invigilator):
                raise serializers.ValidationError('You do not have permission to enter results for this exam')
        
        # 7. Check for duplicate result
        if Result.objects.filter(exam_id=exam_id, student_id=student_id).exists():
            raise serializers.ValidationError('Result already exists for this student and exam')
        
        return data
    
    def create(self, validated_data):
        """Create result with explicit FKs and record user"""
        exam_id = validated_data.pop('exam_id')
        student_id = validated_data.pop('student_id')
        request = self.context.get('request')
        
        return Result.objects.create(
            exam_id=exam_id,
            student_id=student_id,
            recorded_by=request.user if request else None,
            **validated_data
        )


class ReportCardSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = ReportCard
        fields = [
            'id', 'student_name', 'student_suid', 'section_name', 'term_name',
            'academic_year', 'total_marks_obtained', 'total_marks_possible',
            'percentage', 'grade_awarded', 'rank', 'remarks', 'generated_by_name',
            'generated_date', 'file_path'
        ]
        read_only_fields = ['generated_date']