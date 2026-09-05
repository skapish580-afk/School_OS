from rest_framework import serializers
from .models import Teacher, TeacherSchoolAssociation, TeacherAssignment, Remark, TeacherDocument
from apps.accounts.serializers import UserSerializer
from apps.schools.serializers import SchoolSerializer
from apps.features.serializers import FeatureFieldMixin


class TeacherDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherDocument
        fields = ['id', 'document_type', 'title', 'file', 'uploaded_at', 'notes']


class TeacherSerializer(FeatureFieldMixin, serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone_number', read_only=True)
    documents = TeacherDocumentSerializer(many=True, read_only=True)

    username = serializers.SerializerMethodField(read_only=True)
    hierarchy_level = serializers.SerializerMethodField(read_only=True)
    is_registered = serializers.SerializerMethodField(read_only=True)

    active_assignments = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Teacher
        fields = [
            'id', 'tuid', 'user', 'user_details', 'full_name', 'email', 'phone', 'username',
            'hierarchy_level', 'is_registered',
            'photo', 'title', 'date_of_birth', 'gender', 'marital_status',
            'place_of_birth', 'blood_group', 'emergency_contact_phone', 'address',
            'aadhaar_last_4_digits', 'pan_number', 'dietary_preference',
            'custom_attributes',
            'qualifications', 'certified_subjects', 'experience_years', 'awards',
            'verification_status', 'created_at', 'salary', 'date_of_joining', 'documents',
            'teacher_type', 'active_assignments'
        ]
        read_only_fields = ['tuid']

    def get_active_assignments(self, obj):
        from apps.core.school_isolation import get_user_school
        request = self.context.get('request')
        school = get_user_school(request.user) if request and request.user else None
        assignments = TeacherAssignment.objects.filter(teacher=obj, is_active=True)
        if school:
            assignments = assignments.filter(school=school)
        return TeacherAssignmentSerializer(assignments, many=True).data
    
    def get_username(self, obj):
        from apps.accounts.rbac_models import UserRole
        ur = UserRole.objects.filter(user=obj.user, is_active=True).first()
        if ur and ur.role and ur.role.username:
            return ur.role.username
        return None

    def get_hierarchy_level(self, obj):
        from apps.accounts.rbac_models import UserRole
        ur = UserRole.objects.filter(user=obj.user, is_active=True).first()
        if ur and ur.role:
            return ur.role.hierarchy_level
        return None

    def get_is_registered(self, obj):
        from apps.accounts.rbac_models import UserRole
        ur = UserRole.objects.filter(user=obj.user, is_active=True).first()
        if ur and ur.role and ur.role.username and obj.user.has_usable_password():
            return True
        return False
    
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def update(self, instance, validated_data):
        from django.db import transaction
        from apps.accounts.models import User
        
        # Read from raw initial_data since these are read-only in the serializer
        full_name = self.initial_data.get('full_name')
        email = self.initial_data.get('email')
        phone = self.initial_data.get('phone')
        
        with transaction.atomic():
            # 1. Update User Identity Details
            user = instance.user
            if full_name:
                name_parts = full_name.split(' ', 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ''
            if email and email != user.email:
                if User.objects.filter(email=email).exclude(id=user.id).exists():
                    raise serializers.ValidationError({'email': 'This email is already taken by another user.'})
                user.email = email
            if phone is not None:
                user.phone_number = phone
            user.save()
            
            # 2. Update Salary value
            salary_val = validated_data.get('salary', instance.salary)
            if salary_val == '' or salary_val is None:
                validated_data['salary'] = None
            else:
                try:
                    validated_data['salary'] = float(salary_val)
                except (ValueError, TypeError):
                    validated_data['salary'] = None

            # 3. Update date_of_joining and sync with active school association
            date_of_joining = validated_data.get('date_of_joining')
            if date_of_joining:
                from .models import TeacherSchoolAssociation
                association = TeacherSchoolAssociation.objects.filter(teacher=instance, status='ACTIVE').first()
                if association:
                    association.joining_date = date_of_joining
                    association.save()
            
            # 4. Handle document uploads
            request = self.context.get('request')
            if request:
                doc_resume = request.FILES.get('doc_resume')
                doc_id_proof = request.FILES.get('doc_id_proof')
                doc_qualification = request.FILES.get('doc_qualification')
                
                from .models import TeacherDocument
                if doc_resume:
                    TeacherDocument.objects.filter(teacher=instance, document_type='RESUME').delete()
                    TeacherDocument.objects.create(
                        teacher=instance,
                        document_type='RESUME',
                        title='Resume/CV',
                        file=doc_resume
                    )
                if doc_id_proof:
                    TeacherDocument.objects.filter(teacher=instance, document_type='ID_PROOF').delete()
                    TeacherDocument.objects.create(
                        teacher=instance,
                        document_type='ID_PROOF',
                        title='ID Proof',
                        file=doc_id_proof
                    )
                    instance.verification_status = 'VERIFIED'
                    instance.save()
                    
                if doc_qualification:
                    TeacherDocument.objects.filter(teacher=instance, document_type='QUALIFICATION_CERTIFICATE').delete()
                    TeacherDocument.objects.create(
                        teacher=instance,
                        document_type='QUALIFICATION_CERTIFICATE',
                        title='Qualification Certificate',
                        file=doc_qualification
                    )
                
                # Custom documents
                custom_files = request.FILES.getlist('custom_doc_files')
                custom_titles = request.data.getlist('custom_doc_titles')
                has_custom_id_proof = False
                for title, file in zip(custom_titles, custom_files):
                    if title and file:
                        TeacherDocument.objects.create(
                            teacher=instance,
                            document_type='OTHER',
                            title=title,
                            file=file
                        )
                        title_lower = title.lower()
                        if 'id' in title_lower or 'aadhaar' in title_lower or 'pan' in title_lower or 'passport' in title_lower:
                            has_custom_id_proof = True
                
                if has_custom_id_proof:
                    instance.verification_status = 'VERIFIED'
                    instance.save()
            
            return super().update(instance, validated_data)


class TeacherSchoolAssociationSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField(read_only=True)
    teacher_tuid = serializers.CharField(source='teacher.tuid', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = TeacherSchoolAssociation
        fields = '__all__'
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    school_details = SchoolSerializer(source='school', read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    teacher_tuid = serializers.CharField(source='teacher.tuid', read_only=True)
    student_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TeacherAssignment
        fields = [
            'id', 'teacher', 'teacher_name', 'teacher_tuid',
            'school', 'school_details',
            'role', 'grade', 'section', 'subject', 'department',
            'academic_year', 'is_active', 'created_at', 'student_count'
        ]
        read_only_fields = ['school'] # Make school read-only so it's not required in POST
    
    def validate(self, data):
        role = data.get('role', self.instance.role if self.instance else None)
        grade = data.get('grade', self.instance.grade if self.instance else '')
        section = data.get('section', self.instance.section if self.instance else '')
        is_active = data.get('is_active', self.instance.is_active if self.instance else True)
        academic_year = data.get('academic_year', self.instance.academic_year if self.instance else '2025-2026')
        
        # Resolve school
        school = None
        if self.instance:
            school = self.instance.school
        else:
            school = data.get('school')
            
        if not school and 'request' in self.context:
            from apps.core.school_isolation import get_user_school
            school = get_user_school(self.context['request'].user)
            
        if role == 'CLASS_TEACHER' and is_active and school:
            # 1. Check for another active class teacher assignment for this grade, section and academic year
            queryset = TeacherAssignment.objects.filter(
                school=school,
                academic_year=academic_year,
                grade__iexact=grade,
                section__iexact=section,
                role='CLASS_TEACHER',
                is_active=True
            )
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
                
            if queryset.exists():
                teacher_names = ", ".join([f"{ta.teacher.user.full_name}" for ta in queryset])
                raise serializers.ValidationError({
                    'detail': f"A Class Teacher is already assigned to Grade {grade} Section {section} for academic year {academic_year} (Assigned to: {teacher_names}). Only one class teacher is allowed."
                })

            # 2. Check if this teacher is already assigned as Class Teacher for another grade/section
            teacher = data.get('teacher', self.instance.teacher if self.instance else None)
            if teacher:
                teacher_qs = TeacherAssignment.objects.filter(
                    school=school,
                    teacher=teacher,
                    role='CLASS_TEACHER',
                    is_active=True
                )
                if self.instance:
                    teacher_qs = teacher_qs.exclude(id=self.instance.id)
                if teacher_qs.exists():
                    eta = teacher_qs.first()
                    teacher_name = teacher.user.full_name if (hasattr(teacher, 'user') and teacher.user) else "This teacher"
                    raise serializers.ValidationError({
                        'detail': f"{teacher_name} is already assigned as Class Teacher for Grade {eta.grade} Section {eta.section}. A teaching staff member can only be the Class Teacher of one grade/section."
                    })
        return data

    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()
    
    def get_student_count(self, obj):
        from apps.enrollments.models import StudentEnrollment
        return StudentEnrollment.objects.filter(
            grade=str(obj.grade),
            section=str(obj.section),
            status='ACTIVE'
        ).count()


class RemarkSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField(read_only=True)
    student_name = serializers.SerializerMethodField(read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    
    class Meta:
        model = Remark
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'teacher', 'teacher_name',
            'category', 'severity', 'context', 'details', 'visible_to_parent',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'teacher', 'created_at', 'updated_at']
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}".strip()

