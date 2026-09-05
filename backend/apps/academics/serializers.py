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
    grade_id = serializers.UUIDField(source='grade_config.id', read_only=True)
    grade_name = serializers.CharField(source='grade_config.grade_name', read_only=True)
    grade_order = serializers.IntegerField(source='grade_config.grade_order', read_only=True)
    class_teacher_name = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = ['id', 'grade_id', 'full_name', 'grade_name', 'grade_order', 'section_letter', 'capacity', 'class_teacher_name', 'student_count', 'is_active']
    
    def get_class_teacher_name(self, obj):
        from apps.teachers.models import TeacherAssignment
        from apps.teachers.signals import get_active_academic_year_code
        active_year = get_active_academic_year_code(obj.school)
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            role='CLASS_TEACHER',
            grade__iexact=obj.grade_config.grade_name,
            section__iexact=obj.section_letter,
            academic_year=active_year,
            is_active=True
        ).select_related('teacher__user').first()
        if assignment:
            return assignment.teacher.user.full_name
        if obj.class_teacher:
            return obj.class_teacher.user.full_name
        return None

    def get_student_count(self, obj):
        from apps.students.models import Student
        return Student.objects.filter(
            current_section=obj,
            status='ACTIVE'
        ).count()


class SectionDetailSerializer(serializers.ModelSerializer):
    grade_info = GradeConfigurationSerializer(source='grade_config', read_only=True)
    grade_name = serializers.CharField(source='grade_config.grade_name', read_only=True)
    full_name = serializers.CharField(read_only=True)
    class_teacher_name = serializers.SerializerMethodField()
    class_teacher_info = serializers.SerializerMethodField()
    subjects = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = [
            'id', 'grade_info', 'grade_name', 'full_name', 'section_letter', 
            'capacity', 'class_teacher_info', 'class_teacher_name', 'room_number', 
            'is_active', 'subjects', 'created_at'
        ]
    
    def get_class_teacher_name(self, obj):
        from apps.teachers.models import TeacherAssignment
        from apps.teachers.signals import get_active_academic_year_code
        active_year = get_active_academic_year_code(obj.school)
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            role='CLASS_TEACHER',
            grade__iexact=obj.grade_config.grade_name,
            section__iexact=obj.section_letter,
            academic_year=active_year,
            is_active=True
        ).select_related('teacher__user').first()
        if assignment:
            return assignment.teacher.user.full_name
        if obj.class_teacher:
            return obj.class_teacher.user.full_name
        return None

    def get_class_teacher_info(self, obj):
        from apps.teachers.models import TeacherAssignment
        from apps.teachers.signals import get_active_academic_year_code
        active_year = get_active_academic_year_code(obj.school)
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            role='CLASS_TEACHER',
            grade__iexact=obj.grade_config.grade_name,
            section__iexact=obj.section_letter,
            academic_year=active_year,
            is_active=True
        ).select_related('teacher__user').first()
        
        teacher = None
        if assignment:
            teacher = assignment.teacher
        elif obj.class_teacher:
            teacher = obj.class_teacher
            
        if teacher:
            return {
                'id': str(teacher.id),
                'name': teacher.user.full_name,
                'email': teacher.user.email
            }
        return None
    
    def get_subjects(self, obj):
        mappings = obj.subject_mappings.filter(is_active=True)
        return SubjectMappingListSerializer(mappings, many=True).data


def get_or_create_grade_config(school, grade_name):
    # Try to find an existing GradeConfiguration for this school with this grade_name
    from apps.schools.models_programs import GradeConfiguration, AcademicProgram, Campus
    
    # 1. Look for existing grade configurations in any program of the school
    grade_config = GradeConfiguration.objects.filter(
        program__school=school,
        grade_name=grade_name
    ).first()
    if grade_config:
        return grade_config
        
    # 2. If it does not exist, find or create a default AcademicProgram for this school
    program = AcademicProgram.objects.filter(school=school).first()
    if not program:
        # We need a Campus first, or we can see if school has a campus
        campus = Campus.objects.filter(school=school).first()
        if not campus:
            campus = Campus.objects.create(
                school=school,
                name="Main Campus",
                code="MAIN",
                is_primary=True
            )
        program = AcademicProgram.objects.create(
            school=school,
            campus=campus,
            name="General Program",
            code="GEN",
            board="CBSE",
            medium_of_instruction="English",
            evaluation_system="MARKS",
            academic_pattern="ANNUAL",
            is_active=True
        )
        
    # 3. Create the GradeConfiguration under this program
    try:
        grade_order = int(grade_name)
    except ValueError:
        grade_order = 1
        
    grade_config = GradeConfiguration.objects.create(
        program=program,
        grade_name=grade_name,
        grade_order=grade_order,
        max_sections=10,
        section_capacity=50,
        is_active=True
    )
    return grade_config


class SectionSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating sections with write-only foreign key IDs"""
    school_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    grade_id = serializers.CharField(write_only=True)
    class_teacher_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    co_class_teacher_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    move_students = serializers.BooleanField(write_only=True, required=False, default=False)
    
    # Read-only display fields
    grade_name = serializers.CharField(source='grade_config.grade_name', read_only=True)
    class_teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = [
            'id', 'school_id', 'grade_id', 'grade_name', 'section_letter', 'capacity',
            'class_teacher_id', 'class_teacher_name', 'co_class_teacher_id',
            'room_number', 'capacity_locked', 'is_active', 'created_at', 'move_students'
        ]
        read_only_fields = ['id', 'created_at']

    def get_class_teacher_name(self, obj):
        from apps.teachers.models import TeacherAssignment
        from apps.teachers.signals import get_active_academic_year_code
        active_year = get_active_academic_year_code(obj.school)
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            role='CLASS_TEACHER',
            grade__iexact=obj.grade_config.grade_name,
            section__iexact=obj.section_letter,
            academic_year=active_year,
            is_active=True
        ).select_related('teacher__user').first()
        if assignment:
            return assignment.teacher.user.full_name
        if obj.class_teacher:
            return obj.class_teacher.user.full_name
        return None
    
    def validate(self, data):
        from apps.schools.models import School
        from apps.teachers.models import Teacher
        import uuid
        
        school = self.instance.school if self.instance else None
        grade_config = self.instance.grade_config if self.instance else None
        
        school_id = data.get('school_id')
        if school_id:
            try:
                school = School.objects.get(id=school_id)
            except School.DoesNotExist:
                raise serializers.ValidationError({'school_id': 'School not found'})
        
        grade_id = data.get('grade_config_id') or data.get('grade_id')
        if grade_id:
            # Check if grade_id is a UUID
            is_uuid = False
            try:
                uuid.UUID(str(grade_id))
                is_uuid = True
            except ValueError:
                pass
                
            if is_uuid:
                try:
                    grade_config = GradeConfiguration.objects.select_related('program__school').get(id=grade_id)
                    # Use the school from the grade configuration as the source of truth
                    school = grade_config.program.school
                    data['school'] = school
                    data['grade_config'] = grade_config
                except GradeConfiguration.DoesNotExist:
                    raise serializers.ValidationError({'grade_id': 'Grade not found'})
            else:
                # Resolve or auto-create GradeConfiguration by grade_name
                if not school:
                    from apps.core.school_isolation import get_user_school
                    request = self.context.get('request')
                    if request and request.user:
                        school = get_user_school(request.user)
                
                if not school:
                    raise serializers.ValidationError({'school_id': 'School is required (provide school_id or authenticate)'})
                
                grade_config = get_or_create_grade_config(school, str(grade_id))
                data['school'] = school
                data['grade_config'] = grade_config
        elif not grade_config:
            raise serializers.ValidationError({'grade_id': 'Grade configuration is required'})
        
        # Ensure school is resolved
        if not school:
            raise serializers.ValidationError({'school_id': 'School is required'})
        
        # Validate class teacher if provided
        if 'class_teacher_id' in data:
            class_teacher_id = data.get('class_teacher_id')
            if class_teacher_id:
                try:
                    teacher = Teacher.objects.get(id=class_teacher_id, school_associations__school=school)
                    
                    # Validate teacher isn't already assigned as Class Teacher to another grade/section
                    from apps.teachers.models import TeacherAssignment
                    existing_ta = TeacherAssignment.objects.filter(
                        school=school,
                        teacher=teacher,
                        role='CLASS_TEACHER',
                        is_active=True
                    )
                    if self.instance and self.instance.grade_config and self.instance.section_letter:
                        existing_ta = existing_ta.exclude(
                            grade__iexact=self.instance.grade_config.grade_name,
                            section__iexact=self.instance.section_letter
                        )
                    if existing_ta.exists():
                        eta = existing_ta.first()
                        teacher_name = teacher.user.full_name if (hasattr(teacher, 'user') and teacher.user) else f"Teacher {teacher.tuid}"
                        raise serializers.ValidationError({
                            'class_teacher_id': f"{teacher_name} is already assigned as Class Teacher for Grade {eta.grade} Section {eta.section}. A teaching staff member can only be the Class Teacher of one grade/section."
                        })

                    data['class_teacher'] = teacher
                except Teacher.DoesNotExist:
                    raise serializers.ValidationError({'class_teacher_id': 'Teacher not found or belongs to a different school'})
            else:
                data['class_teacher'] = None
        
        # Validate co-class teacher if provided
        if 'co_class_teacher_id' in data:
            co_class_teacher_id = data.get('co_class_teacher_id')
            if co_class_teacher_id:
                try:
                    teacher = Teacher.objects.get(id=co_class_teacher_id, school_associations__school=school)
                    data['co_class_teacher'] = teacher
                except Teacher.DoesNotExist:
                    raise serializers.ValidationError({'co_class_teacher_id': 'Co-teacher not found or belongs to a different school'})
            else:
                data['co_class_teacher'] = None
        
        # Check uniqueness, case-insensitively, excluding self during update
        grade_config_to_check = data.get('grade_config') or (self.instance.grade_config if self.instance else None)
        section_letter_to_check = data.get('section_letter') or (self.instance.section_letter if self.instance else None)
        
        if section_letter_to_check and grade_config_to_check:
            if 'section_letter' in data:
                section_letter_to_check = section_letter_to_check.upper()
                data['section_letter'] = section_letter_to_check
                
            qs = Section.objects.filter(school=school, grade_config=grade_config_to_check, section_letter__iexact=section_letter_to_check)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                if self.instance:
                    # Merge update into the existing section record
                    data['_merge_into_section'] = qs.first()
                else:
                    raise serializers.ValidationError(
                        f'Section {section_letter_to_check} already exists for {grade_config_to_check.grade_name}'
                    )
        
        return data
    
    def create(self, validated_data):
        # Remove write-only ID fields and use resolved instances
        validated_data.pop('school_id', None)
        validated_data.pop('grade_id', None) # Clean up both names if present
        validated_data.pop('grade_config_id', None)
        validated_data.pop('class_teacher_id', None)
        validated_data.pop('co_class_teacher_id', None)
        validated_data.pop('move_students', None)
        
        return Section.objects.create(**validated_data)

    def update(self, instance, validated_data):
        merge_section = validated_data.pop('_merge_into_section', None)
        move_students = validated_data.pop('move_students', False)
        
        # Attach to instance so signals can read it
        instance._move_students = move_students
        
        # Remove write-only ID fields
        validated_data.pop('school_id', None)
        validated_data.pop('grade_id', None)
        validated_data.pop('grade_config_id', None)
        validated_data.pop('class_teacher_id', None)
        validated_data.pop('co_class_teacher_id', None)
        
        if merge_section:
            # We are merging `instance` (e.g. 11-A) into `merge_section` (e.g. 12-A)
            # Update merge_section with the validated_data
            for attr, value in validated_data.items():
                setattr(merge_section, attr, value)
            
            # Since we resolved grade_config and school in validate(), make sure they are set correctly
            if 'grade_config' in validated_data:
                merge_section.grade_config = validated_data['grade_config']
            if 'school' in validated_data:
                merge_section.school = validated_data['school']
            if 'class_teacher' in validated_data:
                merge_section.class_teacher = validated_data['class_teacher']
            if 'co_class_teacher' in validated_data:
                merge_section.co_class_teacher = validated_data['co_class_teacher']
                
            merge_section.save()
            
            # Find all students currently pointing to instance
            from apps.students.models import Student
            
            if move_students:
                # Update their active enrollments in the database to match the new grade and section letter
                from apps.enrollments.models import StudentEnrollment
                from apps.teachers.signals import get_active_academic_year_code
                
                student_ids = Student.objects.filter(current_section=instance).values_list('id', flat=True)
                if student_ids:
                    active_year = get_active_academic_year_code(instance.school)
                    StudentEnrollment.objects.filter(
                        student_id__in=student_ids,
                        academic_year=active_year,
                        status='ACTIVE'
                    ).update(
                        grade=merge_section.grade_config.grade_name,
                        section=merge_section.section_letter
                    )
                
                # Move them to the merged section card
                Student.objects.filter(current_section=instance).update(
                    current_section=merge_section,
                    grade_config=merge_section.grade_config
                )
            else:
                # Keep students in their old grade/section by recreating the old section card
                old_sec, created = Section.objects.get_or_create(
                    school=instance.school,
                    grade_config=instance.grade_config,
                    section_letter=instance.section_letter,
                    defaults={
                        'capacity': instance.capacity,
                        'room_number': instance.room_number,
                        'class_teacher': instance.class_teacher,
                        'is_active': True
                    }
                )
                
                # Point students to the recreated card
                Student.objects.filter(current_section=instance).update(
                    current_section=old_sec,
                    grade_config=old_sec.grade_config
                )
            
            # Transfer subject mappings
            instance.subject_mappings.update(section=merge_section)
            
            # Transfer exams
            instance.exams.update(section=merge_section)
            
            # Transfer report cards
            instance.report_cards.update(section=merge_section)
            
            # Transfer timetable (OneToOneField)
            if hasattr(instance, 'timetable'):
                timetable = instance.timetable
                # Delete any existing timetable on merge_section first to avoid unique constraint violations
                if hasattr(merge_section, 'timetable'):
                    merge_section.timetable.delete()
                timetable.section = merge_section
                timetable.save()
                
            # Transfer timetable entries (ForeignKey)
            if hasattr(instance, 'timetable_entries'):
                instance.timetable_entries.update(section=merge_section)
                
            # Transfer assignments
            if hasattr(instance, 'assignments'):
                instance.assignments.update(section=merge_section)
                
            # Transfer exam_instances
            if hasattr(instance, 'exam_instances'):
                instance.exam_instances.update(section=merge_section)
                
            # Transfer rbac section scope
            from apps.accounts.rbac_models import UserRole
            UserRole.objects.filter(section_scope=instance).update(section_scope=merge_section)
            
            # Transfer finance target_section
            from apps.finance.models import BulkFeeAssignment
            BulkFeeAssignment.objects.filter(target_section=instance).update(target_section=merge_section)
            
            # Transfer student history
            from apps.students.models import StudentHistory
            StudentHistory.objects.filter(section=instance).update(section=merge_section)
            
            # Delete the current instance being edited since it's now redundant
            instance.delete()
            
            # Return the merged section instance
            return merge_section
            
        return super().update(instance, validated_data)


# ============================================================
# SUBJECT SERIALIZERS
# ============================================================

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'description', 'is_core', 'subject_type', 'subject_limit', 'passing_marks', 'is_active', 'created_at']
        read_only_fields = ['created_at']

    def validate(self, data):
        raw_type = data.get('subject_type', self.instance.subject_type if self.instance else 'CORE')
        subject_type = str(raw_type).upper() if raw_type else 'CORE'
        data['subject_type'] = subject_type
        data['is_core'] = (subject_type == 'CORE')
        
        subject_limit = data.get('subject_limit', self.instance.subject_limit if self.instance else None)
        
        if subject_type == 'ELECTIVE':
            if subject_limit is None or (isinstance(subject_limit, int) and subject_limit <= 0):
                raise serializers.ValidationError({
                    'subject_limit': 'Subject Limit is mandatory for Elective subjects and must be greater than 0.'
                })
        return data


class SubjectMappingListSerializer(serializers.ModelSerializer):
    subject_id = serializers.UUIDField(source='subject.id', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_type = serializers.CharField(source='subject.subject_type', read_only=True)
    subject_limit = serializers.IntegerField(source='subject.subject_limit', read_only=True)
    section_id = serializers.UUIDField(source='section.id', read_only=True)
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    teacher_id = serializers.SerializerMethodField(read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = SubjectMapping
        fields = ['id', 'subject_id', 'subject_name', 'subject_code', 'subject_type', 'subject_limit', 'section_id', 'section_name', 'teacher_id', 'teacher_name', 'periods_per_week', 'max_marks', 'is_active']

    def get_teacher_id(self, obj):
        if obj.teacher:
            return obj.teacher.id
        from apps.teachers.models import TeacherAssignment
        assignment = TeacherAssignment.objects.filter(
            school=obj.school,
            grade__iexact=obj.section.grade_config.grade_name if (obj.section and obj.section.grade_config) else '',
            section__iexact=obj.section.section_letter if obj.section else '',
            subject__iexact=obj.subject.name,
            is_active=True
        ).order_by('-created_at').first()
        return assignment.teacher.id if assignment else None

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
    
    teacher_id = serializers.SerializerMethodField(read_only=True)
    
    # Write-only fields
    timetable_id = serializers.UUIDField(write_only=True, required=False)
    subject_id = serializers.UUIDField(write_only=True, required=True)
    
    class Meta:
        model = Period
        fields = [
            'id', 'day', 'day_display', 'period_number', 'start_time', 'end_time', 
            'subject_name', 'teacher_name', 'teacher_id', 'classroom', 'timetable_id', 'subject_id'
        ]
        read_only_fields = ['day_display']

    def get_teacher_id(self, obj):
        if obj.subject_mapping and obj.subject_mapping.teacher:
            return obj.subject_mapping.teacher.id
        return None
    
    def validate(self, data):
        """Validate period data"""
        timetable_id = data.get('timetable_id')
        subject_id = data.get('subject_id')
        teacher_id = self.initial_data.get('teacher_id') or data.get('teacher_id')
        
        # Get timetable
        timetable = None
        if timetable_id:
            try:
                timetable = Timetable.objects.get(id=timetable_id)
                data['timetable'] = timetable
            except Timetable.DoesNotExist:
                raise serializers.ValidationError({'timetable_id': 'Timetable not found'})
        elif self.instance:
            timetable = self.instance.timetable
            
        # Get teacher if teacher_id is provided
        teacher = None
        if teacher_id:
            from apps.teachers.models import Teacher
            try:
                teacher = Teacher.objects.get(id=teacher_id)
            except Teacher.DoesNotExist:
                raise serializers.ValidationError({'teacher_id': 'Teacher not found'})
        
        # Auto-create or fetch subject mapping from subject_id
        if subject_id and timetable:
            try:
                subject = Subject.objects.get(id=subject_id)
                mapping, _ = SubjectMapping.objects.get_or_create(
                    school=timetable.school,
                    section=timetable.section,
                    subject=subject
                )
                
                # Update teacher if provided (or clear if explicitly set to null/None)
                if 'teacher_id' in data:
                    if teacher:
                        if mapping.teacher != teacher:
                            mapping.teacher = teacher
                            mapping.save(update_fields=['teacher'])
                    else:
                        if mapping.teacher is not None:
                            mapping.teacher = None
                            mapping.save(update_fields=['teacher'])
                            
                data['subject_mapping'] = mapping
            except Subject.DoesNotExist:
                raise serializers.ValidationError({'subject_id': 'Subject not found'})
        
        # Check for period number duplicate, time slot overlap, and teacher clash
        day = data.get('day') or (self.instance.day if self.instance else None)
        period_number = data.get('period_number') or (self.instance.period_number if self.instance else None)
        start_time = data.get('start_time') or (self.instance.start_time if self.instance else None)
        end_time = data.get('end_time') or (self.instance.end_time if self.instance else None)

        # 1. Duplicate period number check within the same timetable & day
        if timetable and day and period_number:
            existing_pnum = Period.objects.filter(
                timetable=timetable,
                day=day,
                period_number=period_number
            )
            if self.instance:
                existing_pnum = existing_pnum.exclude(id=self.instance.id)
            if existing_pnum.exists():
                raise serializers.ValidationError({
                    'period_number': f'Period {period_number} has already been added for {day} in this timetable.'
                })

        # 2. Time slot overlap check within the same timetable & day
        if timetable and day and start_time and end_time:
            overlapping_periods = Period.objects.filter(
                timetable=timetable,
                day=day,
                start_time__lt=end_time,
                end_time__gt=start_time
            )
            if self.instance:
                overlapping_periods = overlapping_periods.exclude(id=self.instance.id)
            if overlapping_periods.exists():
                raise serializers.ValidationError({
                    'start_time': 'This time slot overlaps with an existing period on the same day in this timetable.'
                })

        # 3. Teacher clash check across ALL timetables/grade-sections in the school
        assigned_teacher = teacher or (mapping.teacher if 'mapping' in locals() and mapping else None)
        if not assigned_teacher and self.instance and self.instance.subject_mapping:
            assigned_teacher = self.instance.subject_mapping.teacher

        if assigned_teacher and day and timetable:
            from django.db.models import Q
            teacher_periods = Period.objects.filter(
                timetable__school=timetable.school,
                day=day,
                subject_mapping__teacher=assigned_teacher
            )
            if self.instance:
                teacher_periods = teacher_periods.exclude(id=self.instance.id)

            clash_period = None
            for p in teacher_periods:
                # Matches same period_number OR overlapping start/end times
                if (period_number and p.period_number == period_number) or \
                   (start_time and end_time and p.start_time and p.end_time and p.start_time < end_time and p.end_time > start_time):
                    clash_period = p
                    break

            if clash_period:
                clash_sec = clash_period.timetable.section.full_name
                teacher_name = assigned_teacher.user.full_name
                raise serializers.ValidationError({
                    'teacher_id': f'Teacher {teacher_name} is already assigned to Period {clash_period.period_number} in {clash_sec} on {day}.'
                })
        
        return data
    
    def create(self, validated_data):
        """Create period with explicit FK relationships"""
        timetable_id = validated_data.pop('timetable_id', None)
        subject_id = validated_data.pop('subject_id', None)
        validated_data.pop('teacher_id', None) # pop write-only field
        
        if timetable_id:
            validated_data['timetable_id'] = timetable_id
        
        return Period.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        """Update period"""
        timetable_id = validated_data.pop('timetable_id', None)
        subject_id = validated_data.pop('subject_id', None)
        validated_data.pop('teacher_id', None) # pop write-only field
        
        if timetable_id:
            validated_data['timetable_id'] = timetable_id
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['subject_id'] = str(instance.subject_mapping.subject.id) if (instance.subject_mapping and instance.subject_mapping.subject) else None
        ret['teacher_id'] = instance.subject_mapping.teacher.id if (instance.subject_mapping and instance.subject_mapping.teacher) else None
        return ret


class TimetableSerializer(serializers.ModelSerializer):
    # Read-only display fields
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    section_id = serializers.SerializerMethodField()
    grade_name = serializers.CharField(source='section.grade_config.grade_name', read_only=True, allow_null=True)
    section_letter = serializers.CharField(source='section.section_letter', read_only=True, allow_null=True)
    periods = PeriodSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    
    # Write-only ID fields for creation
    school_id = serializers.UUIDField(write_only=True, required=False)
    section_id_write = serializers.UUIDField(write_only=True, required=True)
    
    class Meta:
        model = Timetable
        fields = ['id', 'section_name', 'section_id', 'grade_name', 'section_letter', 'periods', 'created_at', 'updated_at', 'school_id', 'section_id_write', 'created_by', 'created_by_name']
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
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

    def validate(self, data):
        syllabus = data.get('syllabus')
        if not syllabus:
            return data
            
        request = self.context.get('request')
        if request and request.user:
            user = request.user
            if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
                from apps.accounts.permission_utils import get_user_roles
                from apps.core.school_isolation import get_user_school
                school = get_user_school(user)
                
                roles = get_user_roles(user, school)
                
                has_syllabus_perm = False
                allowed_subject_mappings = set()
                unrestricted = False
                
                for role in roles:
                    has_perm = role.permissions.filter(codename__in=[
                        'academics.view_syllabus', 'academics.add_syllabus', 'academics.add_chapter', 'academics.edit_chapter'
                    ]).exists()
                    
                    if has_perm:
                        has_syllabus_perm = True
                        scopes = role.syllabus_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
                
                if has_syllabus_perm and not unrestricted:
                    if syllabus.subject_mapping_id not in allowed_subject_mappings:
                        raise serializers.ValidationError({'syllabus': 'You do not have permission to modify syllabus for this subject/grade/section'})
        return data


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
        
        # Enforce scope limits for non-admin users
        request = self.context.get('request')
        if request and request.user:
            user = request.user
            if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
                from apps.accounts.permission_utils import get_user_roles
                from apps.core.school_isolation import get_user_school
                school = get_user_school(user)
                
                roles = get_user_roles(user, school)
                
                has_syllabus_perm = False
                allowed_subject_mappings = set()
                unrestricted = False
                
                for role in roles:
                    has_perm = role.permissions.filter(codename__in=[
                        'academics.view_syllabus', 'academics.add_syllabus', 'academics.add_chapter', 'academics.edit_chapter'
                    ]).exists()
                    
                    if has_perm:
                        has_syllabus_perm = True
                        scopes = role.syllabus_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
                
                if has_syllabus_perm and not unrestricted:
                    if subject_mapping_id not in allowed_subject_mappings:
                        raise serializers.ValidationError({'subject_mapping_id': 'You do not have permission to add syllabus for this subject/grade/section'})

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
    subject_id = serializers.UUIDField(source='subject_mapping.subject.id', read_only=True)
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    exam_type_display = serializers.CharField(source='get_exam_type_display', read_only=True)
    grade_name = serializers.CharField(source='section.grade_config.grade_name', read_only=True)
    section_id_display = serializers.UUIDField(source='section.id', read_only=True)
    invigilator_names = serializers.SerializerMethodField(read_only=True)
    
    # Write-only ID fields for creation
    school_id = serializers.UUIDField(write_only=True, required=False)
    section_id = serializers.UUIDField(write_only=True, required=True)
    subject_mapping_id = serializers.UUIDField(write_only=True, required=True)
    invigilator_ids = serializers.ListField(
        child=serializers.IntegerField(),
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
            'school_id', 'section_id', 'subject_mapping_id', 'invigilator_ids', 'section_id_display',
            'invigilator_names', 'marks_locked', 'assessment_category', 'subject_id'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_invigilator_names(self, obj):
        return [f"{t.user.first_name} {t.user.last_name}".strip() for t in obj.invigilators.all()]
    
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
            invigilators = Teacher.objects.filter(id__in=invigilator_ids, school_associations__school_id=school_id)
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
        
        # Enforce scope limits for non-admin users
        request = self.context.get('request')
        if request and request.user:
            user = request.user
            if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
                from apps.accounts.permission_utils import get_user_roles
                from apps.core.school_isolation import get_user_school
                school = get_user_school(user)
                roles = get_user_roles(user, school)
                
                has_exam_perm = False
                allowed_subject_mappings = set()
                allowed_exam_types = set()
                unrestricted_subjects = False
                unrestricted_types = False
                
                for role in roles:
                    has_perm = role.permissions.filter(codename='academics.add_exam').exists()
                    if has_perm:
                        has_exam_perm = True
                        
                        # 1. Subject mapping scopes
                        scopes = role.exam_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted_subjects = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
                                
                        # 2. Exam type scopes
                        type_scopes = role.exam_type_scopes
                        if not type_scopes:
                            unrestricted_types = True
                        else:
                            for t in type_scopes:
                                allowed_exam_types.add(t)
                                
                if has_exam_perm:
                    # Validate subject mapping
                    if not unrestricted_subjects and subject_mapping_id not in allowed_subject_mappings:
                        raise serializers.ValidationError({'subject_mapping_id': 'You do not have permission to create/manage exams for this subject/grade/section'})
                    
                    # Validate exam type
                    exam_type = data.get('exam_type')
                    if not unrestricted_types and exam_type not in allowed_exam_types:
                        raise serializers.ValidationError({'exam_type': f'You do not have permission to create/manage exams of type: {exam_type}'})

        # Extra enforcement: teachers can only create Unit Test exams
        if request and request.user:
            from apps.teachers.models import Teacher
            is_teacher = (request.user.user_type == 'TEACHER') or Teacher.objects.filter(user=request.user).exists()
            is_admin = request.user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
            if is_teacher and not is_admin:
                exam_type = data.get('exam_type')
                if exam_type and exam_type != 'UNIT_TEST':
                    raise serializers.ValidationError({'exam_type': 'Teachers are only permitted to create Unit Test exams.'})
        
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

    def update(self, instance, validated_data):
        from apps.teachers.models import Teacher
        invigilator_ids = validated_data.pop('invigilator_ids', None)
        school_id = validated_data.pop('school_id', None)
        section_id = validated_data.pop('section_id', None)
        subject_mapping_id = validated_data.pop('subject_mapping_id', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if invigilator_ids is not None:
            invigilators = Teacher.objects.filter(id__in=invigilator_ids)
            instance.invigilators.set(invigilators)
            
        return instance


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
            'exam_id', 'student_id',
            'aggregated_internal_marks', 'aggregated_practical_marks'
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
        
        exam_id = data.get('exam_id') or (self.instance.exam_id if self.instance else None)
        student_id = data.get('student_id') or (self.instance.student_id if self.instance else None)
        request = self.context.get('request')
        
        # 1. Validate exam exists
        try:
            exam = Exam.objects.select_related('school', 'subject_mapping__teacher').get(id=exam_id)
        except Exam.DoesNotExist:
            raise serializers.ValidationError({'exam_id': 'Exam not found'})
            
        # Check if exam marks are locked (applies to both create and update)
        if exam.marks_locked:
            raise serializers.ValidationError({'exam_id': 'Cannot enter or modify marks for a locked exam'})
            
        # 6. Validate teacher permission (if request available)
        if request and request.user:
            user = request.user
            from apps.accounts.permission_utils import has_permission, get_user_roles
            from apps.teachers.models import Teacher, TeacherAssignment
            
            # Check view_marks_entry permission
            has_marks_entry_perm = has_permission(user, 'academics.view_marks_entry')
            
            is_admin = (
                user.is_superuser or 
                getattr(user, 'is_staff', False) or 
                user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'] or
                has_permission(user, 'academics.enter_marks')
            )
            
            # If they have view_marks_entry permission, they can enter marks but subject scoping must be verified
            is_permitted_by_role = False
            if has_marks_entry_perm:
                if user.is_superuser or user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
                    is_permitted_by_role = True
                else:
                    roles = get_user_roles(user, exam.school)
                    unrestricted = False
                    allowed_mappings = set()
                    has_role_with_perm = False
                    for r in roles:
                        if r.permissions.filter(codename='academics.view_marks_entry').exists():
                            has_role_with_perm = True
                            scopes = r.marks_subject_scopes.all()
                            if not scopes.exists():
                                unrestricted = True
                            else:
                                for s in scopes:
                                    allowed_mappings.add(s.id)
                    
                    if has_role_with_perm:
                        if unrestricted or exam.subject_mapping_id in allowed_mappings:
                            is_permitted_by_role = True
            
            is_subject_teacher = False
            teacher_obj = getattr(user, 'teacher_profile', None)
            if not teacher_obj:
                teacher_obj = Teacher.objects.filter(user=user).first()
                if not teacher_obj and user.user_type == 'ROLE':
                    from apps.accounts.rbac_models import UserRole
                    ur = UserRole.objects.filter(user=user, is_active=True).first()
                    if ur and ur.role and ur.role.associated_user:
                        teacher_obj = Teacher.objects.filter(user=ur.role.associated_user).first()
                if not teacher_obj:
                    teacher_obj = Teacher.objects.filter(user__email__iexact=user.email).first()

            if teacher_obj:
                # 1. Direct subject mapping teacher check
                if exam.subject_mapping and exam.subject_mapping.teacher_id and str(exam.subject_mapping.teacher_id) == str(teacher_obj.id):
                    is_subject_teacher = True
                else:
                    # 2. TeacherAssignment check
                    sub_name = (exam.subject_mapping.subject.name if exam.subject_mapping and exam.subject_mapping.subject else exam.name).strip().lower()
                    g_name = (exam.section.grade_config.grade_name if exam.section and exam.section.grade_config else '').replace('Grade', '').strip().lower()
                    s_let = (exam.section.section_letter if exam.section else '').strip().upper()
                    
                    for ta in TeacherAssignment.objects.filter(teacher=teacher_obj, role__in=['SUBJECT_TEACHER', 'SUBSTITUTE'], is_active=True):
                        ta_sub = (ta.subject or '').strip().lower()
                        ta_g = (ta.grade or '').replace('Grade', '').strip().lower()
                        ta_s = (ta.section or '').strip().upper()
                        
                        match_sub = bool(ta_sub and ta_sub == sub_name)
                        match_g = not ta_g or ta_g in g_name or g_name in ta_g
                        match_s = not ta_s or ta_s == s_let
                        
                        if match_sub and match_g and match_s:
                            is_subject_teacher = True
                            break

            is_invigilator = False
            if teacher_obj:
                is_invigilator = exam.invigilators.filter(id=teacher_obj.id).exists()
            elif user.is_authenticated:
                is_invigilator = exam.invigilators.filter(user=user).exists()
            
            print(f"DEBUG: Permission Check - is_admin: {is_admin}, is_permitted_by_role: {is_permitted_by_role}, is_teacher: {is_subject_teacher}, is_invigilator: {is_invigilator}")
            
            if not (is_admin or is_permitted_by_role or is_subject_teacher or is_invigilator):
                raise serializers.ValidationError({'non_field_errors': ['You do not have permission to enter results for this exam as you are not assigned to this subject/class.']})
        
        if self.instance:  # Skip student enrollment and duplicate checks on update
            return data
        
        # 2. Check feature flag
        if not school_has_feature(exam.school_id, 'ACADEMICS'):
            raise serializers.ValidationError({'exam_id': 'Result entry not enabled for this school'})
        
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

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['student_id'] = instance.student_id
        representation['exam_id'] = instance.exam_id
        return representation


class ReportCardSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    section_name = serializers.CharField(source='section.full_name', read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True, allow_null=True)
    grade_name = serializers.SerializerMethodField()

    def get_grade_name(self, obj):
        if obj.section and obj.section.grade_config:
            return obj.section.grade_config.grade_name
        return None
    
    class Meta:
        model = ReportCard
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'section_name', 'grade_name', 'term_name',
            'academic_year', 'total_marks_obtained', 'total_marks_possible',
            'percentage', 'grade_awarded', 'rank', 'remarks', 'generated_by_name',
            'generated_date', 'file_path'
        ]
        read_only_fields = ['generated_date']


from .models import DirectEvaluation

class DirectEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectEvaluation
        fields = ['id', 'school', 'section', 'subject_mapping', 'category_id', 'config', 'grades', 'is_locked', 'created_at', 'updated_at']
        read_only_fields = ['id', 'school', 'created_at', 'updated_at']