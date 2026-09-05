from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count

from .models import (
    Section, Subject, SubjectMapping, Timetable, Period,
    Syllabus, Chapter, Exam, Result, ReportCard
)
from .serializers import (
    SectionListSerializer, SectionDetailSerializer, SectionSerializer,
    SubjectSerializer, SubjectMappingListSerializer, SubjectMappingDetailSerializer,
    TimetableSerializer, PeriodSerializer, SyllabusSerializer, ChapterSerializer,
    ExamSerializer, ResultSerializer, ReportCardSerializer
)
from apps.schools.models_programs import GradeConfiguration
from apps.schools.serializers_programs import GradeConfigurationSerializer
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin
from apps.accounts.permission_utils import RBACPermission, has_permission
from apps.features.permissions import can


# ============================================================
# GRADE VIEW (Mapped to GradeConfiguration)
# ============================================================

class GradeViewSet(SchoolIsolationMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing available grades.
    Mapped to GradeConfiguration for backward compatibility.
    """
    serializer_class = GradeConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    school_field = 'program__school'
    
    rbac_module = 'academics'
    rbac_resource = 'grade'
    rbac_action_permissions = {
        'list': ['academics.view_class', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam', 'attendance.view_attendance', 'attendance.change_attendance'],
        'retrieve': ['academics.view_class', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam', 'attendance.view_attendance', 'attendance.change_attendance'],
    }
    
    def get_queryset(self):
        queryset = GradeConfiguration.objects.select_related('program', 'program__school')
        school_filter = self.get_school_filter()
        if school_filter:
            # school_filter is already {'program__school': user.school}
            queryset = queryset.filter(**school_filter)
        return queryset.order_by('grade_order')


# ============================================================
# SECTION VIEW
# ============================================================

class SectionViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'grade_config', 'is_active']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'section'
    rbac_action_permissions = {
        'list': ['academics.view_class', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam', 'attendance.view_attendance', 'attendance.change_attendance'],
        'retrieve': ['academics.view_class', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam', 'attendance.view_attendance', 'attendance.change_attendance'],
        'by_grade': ['academics.view_class', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam', 'attendance.view_attendance', 'attendance.change_attendance'],
        'create': 'academics.manage_class',
        'update': 'academics.edit_class',
        'partial_update': 'academics.edit_class',
        'destroy': 'academics.manage_class',
        'reallocate_and_delete': 'academics.manage_class',
    }
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SectionDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SectionSerializer
        return SectionListSerializer
    
    def get_queryset(self):
        queryset = Section.objects.prefetch_related('subject_mappings').select_related('grade_config', 'class_teacher')
        
        # Apply school isolation
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
            
        # Custom filter: handle 'grade' query parameter for backward compatibility
        grade_param = self.request.query_params.get('grade')
        if grade_param:
            queryset = queryset.filter(grade_config_id=grade_param)
            
        # Enforce grade scope limits for non-admin users
        user = self.request.user
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
            has_add_timetable = False
            allowed_grade_ids = set()
            unrestricted = False
            
            for role in roles:
                if role.permissions.filter(codename='academics.add_timetable').exists():
                    has_add_timetable = True
                    scopes = role.timetable_grade_scopes.all()
                    if not scopes.exists():
                        unrestricted = True
                    else:
                        for s in scopes:
                            allowed_grade_ids.add(s.id)
                            
            if has_add_timetable and not unrestricted:
                queryset = queryset.filter(grade_config_id__in=allowed_grade_ids)
                
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_grade(self, request):
        """Get sections for a specific grade: /academics/sections/by_grade/?grade_id=<id>"""
        grade_id = request.query_params.get('grade_id') or request.query_params.get('grade')
        if not grade_id:
            return Response({'error': 'grade_id required'}, status=400)
        
        sections = self.get_queryset().filter(grade_config_id=grade_id, is_active=True)
        serializer = SectionListSerializer(sections, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        from apps.students.models import Student
        student_count = Student.objects.filter(current_section=instance, status='ACTIVE').count()
        if student_count > 0:
            return Response(
                {'error': 'cannot_delete_with_students', 'student_count': student_count},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def reallocate_and_delete(self, request, pk=None):
        section = self.get_object()
        reallocations = request.data.get('reallocations', [])
        
        from apps.students.models import Student
        from apps.enrollments.models import StudentEnrollment
        from apps.teachers.signals import get_active_academic_year_code
        
        new_section_ids = [r.get('new_section_id') for r in reallocations if r.get('new_section_id')]
        sections_dict = {str(s.id): s for s in Section.objects.filter(id__in=new_section_ids)}
        
        student_ids = [r.get('student_id') for r in reallocations if r.get('student_id')]
        students = Student.objects.filter(id__in=student_ids, current_section=section)
        students_dict = {str(s.id): s for s in students}
        
        school = section.school
        academic_year = get_active_academic_year_code(school)
        
        from django.db import transaction
        with transaction.atomic():
            for r in reallocations:
                student_id = r.get('student_id')
                new_section_id = r.get('new_section_id')
                
                if not student_id or not new_section_id:
                    continue
                    
                student = students_dict.get(student_id)
                new_section = sections_dict.get(new_section_id)
                
                if student and new_section:
                    student.current_section = new_section
                    student.grade_config = new_section.grade_config
                    student.save(update_fields=['current_section', 'grade_config'])
                    
                    StudentEnrollment.objects.filter(
                        student=student,
                        school=school,
                        academic_year=academic_year,
                        status='ACTIVE'
                    ).update(
                        grade=new_section.grade_config.grade_name,
                        section=new_section.section_letter
                    )
            
            section.delete()
            
        return Response({'status': 'success'}, status=status.HTTP_200_OK)



# ============================================================
# SUBJECT VIEW
# ============================================================

class SubjectViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'is_core', 'is_active']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'subject'
    rbac_action_permissions = {
        'list': ['academics.view_subject', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam'],
        'retrieve': ['academics.view_subject', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam'],
        'active_subjects': ['academics.view_subject', 'academics.add_timetable', 'academics.view_syllabus', 'academics.add_syllabus', 'academics.view_exam', 'academics.add_exam'],
        'create': 'academics.manage_subject',
        'update': 'academics.edit_subject',
        'partial_update': 'academics.edit_subject',
        'destroy': 'academics.manage_subject',
    }
    
    def perform_create(self, serializer):
        school = self.get_user_school()
        instance = serializer.save(school=school)
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        log_hierarchy_record_edit(self.request.user, instance, 'CREATE', f"Created Subject ({instance})", school=school)

    
    @action(detail=False, methods=['get'])
    def active_subjects(self, request):
        """Get all active subjects for user's school"""
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


# ============================================================
# SUBJECT MAPPING VIEW
# ============================================================

class SubjectMappingViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'section', 'subject', 'is_active']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'subject'
    rbac_action_permissions = {
        'list': ['academics.view_subject_allocation', 'attendance.view_attendance', 'attendance.change_attendance'],
        'retrieve': ['academics.view_subject_allocation', 'attendance.view_attendance', 'attendance.change_attendance'],
        'by_section': ['academics.view_subject_allocation', 'attendance.view_attendance', 'attendance.change_attendance'],
        'by_teacher': ['academics.view_subject_allocation', 'attendance.view_attendance', 'attendance.change_attendance'],
        'my_assignments': ['academics.view_subject_allocation', 'academics.view_exam', 'academics.add_exam', 'teachers.view_teaching'],
        'create': 'academics.manage_subject_allocation',
        'update': 'academics.manage_subject_allocation',
        'partial_update': 'academics.manage_subject_allocation',
        'destroy': 'academics.manage_subject_allocation',
        'bulk_allocate': 'academics.manage_subject_allocation',
    }
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SubjectMappingDetailSerializer
        return SubjectMappingListSerializer
    
    def check_permissions(self, request):
        # Allow syllabus, exam or marks users to view subject mappings for setup dropdowns
        if self.action in ['list', 'retrieve', 'by_section', 'my_assignments'] and (
            request.user.user_type in ['TEACHER', 'PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'] or
            has_permission(request.user, 'academics.view_syllabus') or
            has_permission(request.user, 'academics.view_exam') or
            has_permission(request.user, 'academics.add_exam') or
            has_permission(request.user, 'academics.view_marks_entry')
        ):
            return
        super().check_permissions(request)

    def get_queryset(self):
        queryset = SubjectMapping.objects.select_related('subject', 'section', 'teacher')
        
        # Apply school isolation
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
            
        # Scope filtering for syllabus tracking setup and exams
        user = self.request.user
        bypass_scope = self.request.query_params.get('bypass_scope') == 'true'
        
        print(f"--- DEBUG MAPPINGS ---")
        print(f"User: {user.email if user.is_authenticated else 'Anonymous'}")
        print(f"User Type: {user.user_type if user.is_authenticated else 'None'}")
        print(f"Bypass Scope: {bypass_scope}")
        print(f"School Filter: {school_filter}")
        print(f"Initial Mappings Count: {queryset.count()}")
        
        if not bypass_scope and user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.teachers.models import Teacher, TeacherAssignment
            from django.db.models import Q
            
            teacher = Teacher.objects.filter(user=user).first()
            if not teacher and user.user_type == 'ROLE':
                from apps.accounts.rbac_models import UserRole
                ur = UserRole.objects.filter(user=user, is_active=True).first()
                if ur and ur.role and ur.role.associated_user:
                    teacher = Teacher.objects.filter(user=ur.role.associated_user).first()
            if not teacher:
                teacher = Teacher.objects.filter(user__email__iexact=user.email).first()

            if teacher or user.user_type == 'TEACHER':
                allowed_mapping_ids = set()
                if teacher:
                    # 1. Direct mappings where teacher is assigned
                    for sm_id in SubjectMapping.objects.filter(school=self.get_user_school(), teacher=teacher).values_list('id', flat=True):
                        allowed_mapping_ids.add(sm_id)
                    # 2. Teacher assignments with specific subject
                    assignments = TeacherAssignment.objects.filter(teacher=teacher, role__in=['SUBJECT_TEACHER', 'SUBSTITUTE'], is_active=True)
                    for ta in assignments:
                        sub_name = (ta.subject or '').strip()
                        g_name = (ta.grade or '').replace('Grade', '').strip()
                        s_let = (ta.section or '').strip()
                        if sub_name:
                            sub_q = Q(school=self.get_user_school()) & (Q(subject__name__iexact=sub_name) | Q(subject__code__iexact=sub_name))
                            if g_name:
                                sub_q &= (Q(section__grade_config__grade_name__icontains=g_name) | Q(section__grade_config__grade_name__iexact=g_name))
                            if s_let:
                                sub_q &= Q(section__section_letter__iexact=s_let)
                            for sm_id in SubjectMapping.objects.filter(sub_q).values_list('id', flat=True):
                                allowed_mapping_ids.add(sm_id)
                return queryset.filter(id__in=allowed_mapping_ids).distinct()

            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
            purpose = self.request.query_params.get('purpose', 'syllabus')
            has_academics_perm = False
            allowed_subject_mappings = set()
            unrestricted = False
            
            for role in roles:
                if purpose == 'syllabus':
                    # Check syllabus permission and scopes
                    has_syllabus_perm = role.permissions.filter(codename__in=[
                        'academics.view_syllabus', 'academics.add_syllabus', 'academics.add_chapter', 'academics.edit_chapter'
                    ]).exists()
                    
                    if has_syllabus_perm:
                        has_academics_perm = True
                        scopes = role.syllabus_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
                            
                elif purpose == 'exams':
                    # Check exam permission and scopes
                    has_exam_perm = role.permissions.filter(codename__in=[
                        'academics.view_exam', 'academics.add_exam'
                    ]).exists()
                    
                    if has_exam_perm:
                        has_academics_perm = True
                        scopes = role.exam_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
                                
                elif purpose == 'marks':
                    # Check marks permission and scopes
                    has_marks_perm = role.permissions.filter(codename__in=[
                        'academics.view_marks_entry'
                    ]).exists()
                    
                    if has_marks_perm:
                        has_academics_perm = True
                        scopes = role.marks_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
            
            if has_academics_perm and not unrestricted:
                queryset = queryset.filter(id__in=allowed_subject_mappings)
                
        print(f"Final Mappings Count: {queryset.count()}")
        for m in queryset:
            print(f"  * {m.subject.name} - {m.section.full_name}")
        print(f"----------------------")
                    
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_section(self, request):
        """Get all subjects for a section: /academics/subject-mappings/by_section/?section_id=<id>"""
        section_id = request.query_params.get('section_id')
        if not section_id:
            return Response({'error': 'section_id required'}, status=400)
        
        mappings = self.get_queryset().filter(section_id=section_id, is_active=True)
        serializer = SubjectMappingListSerializer(mappings, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_teacher(self, request):
        """Get all subject assignments for a teacher: /academics/subject-mappings/by_teacher/?teacher_id=<id>"""
        teacher_id = request.query_params.get('teacher_id')
        if not teacher_id:
            return Response({'error': 'teacher_id required'}, status=400)
        
        mappings = self.get_queryset().filter(teacher_id=teacher_id, is_active=True)
        serializer = SubjectMappingListSerializer(mappings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_assignments(self, request):
        """
        Get subject mappings strictly assigned to the teacher based on
        SUBJECT_TEACHER roles assigned in the Teachers module.
        """
        user = request.user
        school = self.get_user_school()
        if not school and hasattr(user, 'school') and user.school:
            school = user.school
            
        if not school:
            return Response({'error': 'School context not found'}, status=400)
            
        from apps.teachers.models import Teacher, TeacherAssignment
        from apps.academics.models import SubjectMapping, Section, Subject
        import re

        # 1. Resolve teacher identity
        teacher_id = request.query_params.get('teacher_id')
        teacher = None
        if teacher_id:
            teacher = Teacher.objects.filter(id=teacher_id, school=school).first()
            
        if not teacher:
            teacher = Teacher.objects.filter(user=user).first()
        if not teacher and user.user_type == 'ROLE':
            from apps.accounts.rbac_models import UserRole
            ur = UserRole.objects.filter(user=user, is_active=True).first()
            if ur and ur.role and ur.role.associated_user:
                teacher = Teacher.objects.filter(user=ur.role.associated_user).first()
        if not teacher:
            teacher = Teacher.objects.filter(user__email__iexact=user.email).first()

        # If no teacher profile exists for this user, return empty list (strict filtering)
        if not teacher:
            return Response([], status=200)

        # Helper matchers
        def clean_num(val):
            if not val:
                return ""
            digits = re.findall(r'\d+', str(val))
            if digits:
                return digits[0]
            return str(val).strip().lower()

        def section_matches(sec, ta_grade, ta_section):
            if not sec or not sec.grade_config:
                return False
            sec_letter = sec.section_letter.strip().lower()
            ta_sec = str(ta_section or '').strip().lower()
            if sec_letter != ta_sec and not (len(ta_sec) > 1 and sec_letter in ta_sec):
                return False
            sec_g_num = clean_num(sec.grade_config.grade_name)
            ta_g_num = clean_num(ta_grade)
            if sec_g_num and ta_g_num and sec_g_num == ta_g_num:
                return True
            sec_gname = sec.grade_config.grade_name.strip().lower()
            ta_gstr = str(ta_grade or '').strip().lower()
            if sec_gname == ta_gstr:
                return True
            return False

        def subject_matches(sub, ta_subject):
            if not sub or not ta_subject:
                return False
            s_name = sub.name.strip().lower()
            s_code = (sub.code or '').strip().lower()
            ta_sub = str(ta_subject).strip().lower()
            if s_name == ta_sub or s_code == ta_sub:
                return True
            math_aliases = {'math', 'maths', 'mathematics'}
            if ta_sub in math_aliases and s_name in math_aliases:
                return True
            sst_aliases = {'sst', 'social science', 'social studies', 'social-science', 'social_science'}
            if ta_sub in sst_aliases and s_name in sst_aliases:
                return True
            sci_aliases = {'sci', 'science', 'general science'}
            if ta_sub in sci_aliases and s_name in sci_aliases:
                return True
            eng_aliases = {'eng', 'english'}
            if ta_sub in eng_aliases and s_name in eng_aliases:
                return True
            hin_aliases = {'hin', 'hindi'}
            if ta_sub in hin_aliases and s_name in hin_aliases:
                return True
            return False

        found_mappings = set()

        # Query ONLY active SUBJECT_TEACHER assignments (or assignments specifying an explicit subject)
        teacher_assignments = TeacherAssignment.objects.filter(
            school=school,
            teacher=teacher,
            is_active=True
        ).exclude(
            subject__isnull=True
        ).exclude(
            subject__exact=''
        )

        all_sections = list(Section.objects.filter(school=school, is_active=True).select_related('grade_config'))
        all_subjects = list(Subject.objects.filter(school=school, is_active=True))

        for ta in teacher_assignments:
            if ta.role == 'SUBJECT_TEACHER' or ta.subject:
                matched_sections = [sec for sec in all_sections if section_matches(sec, ta.grade, ta.section)]
                matched_subjects = [sub for sub in all_subjects if subject_matches(sub, ta.subject)]
                
                for sec in matched_sections:
                    for sub in matched_subjects:
                        sm = SubjectMapping.objects.filter(
                            school=school,
                            section=sec,
                            subject=sub,
                            is_active=True
                        ).first()
                        if not sm:
                            sm = SubjectMapping.objects.create(
                                school=school,
                                section=sec,
                                subject=sub,
                                teacher=teacher,
                                is_active=True
                            )
                        found_mappings.add(sm)

        sorted_mappings = sorted(list(found_mappings), key=lambda x: (x.section.full_name if x.section else '', x.subject.name if x.subject else ''))
        serializer = SubjectMappingListSerializer(sorted_mappings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_allocate(self, request):
        grade_id = request.data.get('grade_id')
        allocations = request.data.get('allocations', [])
        
        if not grade_id:
            return Response({'error': 'grade_id is required'}, status=400)
            
        school = self.get_user_school()
        
        from django.db import transaction
        from .models import SubjectMapping, Section
        from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy, log_hierarchy_record_edit
        
        sections = Section.objects.filter(grade_config_id=grade_id, school=school)
        
        section_allocations = {str(s.id): [] for s in sections}
        for alloc in allocations:
            sub_id = alloc.get('subject_id')
            sec_ids = alloc.get('section_ids', [])
            for sid in sec_ids:
                if str(sid) in section_allocations:
                    section_allocations[str(sid)].append(str(sub_id))
                    
        with transaction.atomic():
            for section in sections:
                allocated_subs = section_allocations.get(str(section.id), [])
                
                # Check hierarchy permission on existing active mappings BEFORE deactivating or modifying
                existing_active = list(SubjectMapping.objects.filter(
                    school=school,
                    section=section,
                    is_active=True
                ))
                
                for mapping in existing_active:
                    allowed, reason = can_user_edit_object_by_hierarchy(request.user, mapping, school)
                    if not allowed:
                        return Response({'error': f"Hierarchy error for allocation of {mapping.subject.name} in {section.full_name}: {reason}"}, status=status.HTTP_403_FORBIDDEN)

                # Deactivate mappings not in the new allocation list
                to_deactivate = [m for m in existing_active if str(m.subject_id) not in allocated_subs]
                for mapping in to_deactivate:
                    mapping.is_active = False
                    mapping.save(update_fields=['is_active'])
                    log_hierarchy_record_edit(request.user, mapping, 'UPDATE', f"Deallocated Subject {mapping.subject.name} from {section.full_name}", school=school)
                
                # Activate or create mappings in the allocation list
                for sub_id in allocated_subs:
                    mapping, created = SubjectMapping.objects.get_or_create(
                        school=school,
                        section=section,
                        subject_id=sub_id,
                        defaults={'is_active': True}
                    )
                    if created:
                        log_hierarchy_record_edit(request.user, mapping, 'CREATE', f"Allocated Subject {mapping.subject.name} to {section.full_name}", school=school)
                    elif not mapping.is_active:
                        # Check hierarchy if re-activating an inactive record modified by higher role
                        allowed, reason = can_user_edit_object_by_hierarchy(request.user, mapping, school)
                        if not allowed:
                            return Response({'error': f"Hierarchy error for re-allocating {mapping.subject.name} in {section.full_name}: {reason}"}, status=status.HTTP_403_FORBIDDEN)
                        mapping.is_active = True
                        mapping.save(update_fields=['is_active'])
                        log_hierarchy_record_edit(request.user, mapping, 'UPDATE', f"Re-allocated Subject {mapping.subject.name} to {section.full_name}", school=school)
                        
        return Response({'status': 'success'}, status=status.HTTP_200_OK)




# ============================================================
# TIMETABLE VIEW
# ============================================================

class TimetableViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Timetable.objects.all()
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'section']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'timetable'
    
    rbac_action_permissions = {
        'list': 'academics.add_timetable',
        'retrieve': 'academics.add_timetable',
        'create': 'academics.add_timetable',
        'update': 'academics.add_timetable',
        'partial_update': 'academics.add_timetable',
        'destroy': 'academics.add_timetable',
        'for_section': 'academics.add_timetable',
        'missing_periods': 'academics.add_timetable',
        'my_schedule': 'academics.add_timetable',
    }

    def check_permissions(self, request):
        if self.action in ['my_schedule', 'student_schedule']:
            return
        super().check_permissions(request)


    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            if request.method not in permissions.SAFE_METHODS:
                if obj.created_by_id and obj.created_by_id != user.id:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You can only modify timetables created by you.")

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # Enforce grade scope limits for non-admin users
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
            has_add_timetable = False
            allowed_grade_ids = set()
            unrestricted = False
            
            for role in roles:
                if role.permissions.filter(codename='academics.add_timetable').exists():
                    has_add_timetable = True
                    scopes = role.timetable_grade_scopes.all()
                    if not scopes.exists():
                        unrestricted = True
                    else:
                        for s in scopes:
                            allowed_subject_mappings = allowed_grade_ids.add(s.id)
                            
            if has_add_timetable and not unrestricted:
                queryset = queryset.filter(section__grade_config_id__in=allowed_grade_ids)
                
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        school = self.get_user_school()
        
        # Enforce grade scope limits for non-admin users
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            section_id = self.request.data.get('section_id_write') or self.request.data.get('section')
            if section_id:
                from apps.academics.models import Section
                try:
                    section = Section.objects.get(id=section_id, school=school)
                    grade_config = section.grade_config
                    
                    # Check user role assignments to verify if this grade_config is in their scope
                    from apps.accounts.permission_utils import get_user_roles
                    roles = get_user_roles(user, school)
                    
                    has_add_timetable = False
                    allowed_grade_ids = set()
                    unrestricted = False
                    
                    for role in roles:
                        if role.permissions.filter(codename='academics.add_timetable').exists():
                            has_add_timetable = True
                            scopes = role.timetable_grade_scopes.all()
                            if not scopes.exists():
                                unrestricted = True
                            else:
                                for s in scopes:
                                    allowed_grade_ids.add(s.id)
                                    
                    if has_add_timetable and not unrestricted and grade_config.id not in allowed_grade_ids:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied("You are not permitted to create a timetable for this grade.")
                except Section.DoesNotExist:
                    pass
                    
        serializer.save(school=school, created_by=user)
    
    @action(detail=False, methods=['get'])
    def for_section(self, request):
        """Get timetable for a section"""
        section_id = request.query_params.get('section_id')
        if not section_id:
            return Response({'error': 'section_id required'}, status=400)
        
        try:
            timetable = Timetable.objects.get(section_id=section_id)
            serializer = self.get_serializer(timetable)
            return Response(serializer.data)
        except Timetable.DoesNotExist:
            return Response({'error': 'Timetable not found'}, status=404)

    @action(detail=True, methods=['get'])
    def missing_periods(self, request, pk=None):
        """Get missing periods and next period number for a specific day"""
        timetable = self.get_object()
        day = request.query_params.get('day')
        if not day:
            return Response({'error': 'day query param is required'}, status=400)
            
        existing_numbers = list(Period.objects.filter(
            timetable=timetable,
            day=day
        ).values_list('period_number', flat=True))
        
        if not existing_numbers:
            return Response({'missing_periods': [], 'next_period': 1})
            
        max_num = max(existing_numbers)
        full_set = set(range(1, max_num + 1))
        missing = sorted(list(full_set - set(existing_numbers)))
        next_period = max_num + 1
        
        return Response({
            'missing_periods': missing,
            'next_period': next_period
        })

    @action(detail=False, methods=['get'])
    def my_schedule(self, request):
        """
        Get weekly timetable schedule for the currently logged-in teacher in their school.
        Filters Timetable / Period data based on the teacher's school and teacher identity.
        Returns: period number, day of week, start time, end time, subject, grade, section, room number, total strength.
        """
        user = request.user
        school = self.get_user_school()
        
        if not school and hasattr(user, 'school') and user.school:
            school = user.school
            
        if not school:
            return Response({'error': 'School context not found for user.'}, status=400)
            
        from apps.teachers.models import Teacher, TeacherAssignment
        from apps.academics.models import Period, SubjectMapping, Section
        from apps.academics.models_timetable import TimetableEntry
        from apps.students.models import Student
        from django.db.models import Q
        
        teacher = Teacher.objects.filter(user=user).first()
        
        # Build section student strength cache
        section_strength_map = {}
        def get_strength(sec):
            if not sec:
                return 0
            sec_id = str(sec.id)
            if sec_id not in section_strength_map:
                section_strength_map[sec_id] = Student.objects.filter(
                    school=school,
                    current_section=sec,
                    status__in=['ACTIVE', 'TEMPORARY']
                ).count()
            return section_strength_map[sec_id]

        schedule_items = []
        seen_keys = set()
        
        # 1. Fetch from Period model (Academics Master Timetable)
        periods_qs = Period.objects.filter(timetable__school=school).select_related(
            'timetable', 'timetable__section', 'timetable__section__grade_config',
            'subject_mapping', 'subject_mapping__subject', 'subject_mapping__teacher',
            'subject_mapping__teacher__user', 'subject_mapping__section'
        )
        
        # Filter periods for this teacher
        if teacher:
            # Check teacher directly or via teacher assignments
            teacher_assignments = TeacherAssignment.objects.filter(
                school=school,
                teacher=teacher,
                is_active=True
            )
            assigned_combos = set()
            for ta in teacher_assignments:
                if ta.grade and ta.section and ta.subject:
                    assigned_combos.add((ta.grade.strip().upper(), ta.section.strip().upper(), ta.subject.strip().upper()))
            
            for p in periods_qs:
                sm = p.subject_mapping
                if not sm:
                    continue
                
                is_teacher_match = False
                if sm.teacher and sm.teacher_id == teacher.id:
                    is_teacher_match = True
                elif sm.co_teacher and sm.co_teacher_id == teacher.id:
                    is_teacher_match = True
                elif sm.teacher and sm.teacher.user_id == user.id:
                    is_teacher_match = True
                else:
                    # Check assignment matching
                    g_name = sm.section.grade_config.grade_name.strip().upper() if (sm.section and sm.section.grade_config) else ''
                    s_let = sm.section.section_letter.strip().upper() if sm.section else ''
                    sub_name = sm.subject.name.strip().upper() if sm.subject else ''
                    if (g_name, s_let, sub_name) in assigned_combos:
                        is_teacher_match = True
                        
                if is_teacher_match:
                    sec = p.timetable.section
                    room = p.classroom or (sec.room_number if sec else '') or ''
                    grade_str = sec.grade_config.grade_name if (sec and sec.grade_config) else ''
                    section_str = sec.section_letter if sec else ''
                    subject_str = sm.subject.name if sm.subject else ''
                    day_display = p.get_day_display()
                    start_str = p.start_time.strftime('%H:%M') if p.start_time else ''
                    end_str = p.end_time.strftime('%H:%M') if p.end_time else ''
                    
                    key = (p.day, p.period_number, grade_str, section_str, subject_str)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        schedule_items.append({
                            'id': str(p.id),
                            'day': day_display,
                            'day_code': p.day,
                            'period': p.period_number,
                            'start_time': start_str,
                            'end_time': end_str,
                            'subject': subject_str,
                            'grade': grade_str,
                            'section': section_str,
                            'room': room,
                            'student_count': get_strength(sec)
                        })

        # 2. Also check TimetableEntry model (Clash Detection Engine Timetable)
        if teacher:
            entries_qs = TimetableEntry.objects.filter(
                school=school,
                is_active=True,
                is_cancelled=False
            ).filter(
                Q(teacher=teacher) | Q(substitute_teacher=teacher)
            ).select_related(
                'time_slot', 'subject', 'grade', 'section', 'section__grade_config'
            )
            
            DAY_NAMES = {1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'}
            DAY_CODES = {1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 7: 'SUN'}
            
            for entry in entries_qs:
                sec = entry.section
                room = entry.room_number or (sec.room_number if sec else '') or ''
                grade_str = entry.grade.grade_name if entry.grade else (sec.grade_config.grade_name if (sec and sec.grade_config) else '')
                section_str = sec.section_letter if sec else ''
                subject_str = entry.subject.name if entry.subject else ''
                day_display = DAY_NAMES.get(entry.day_of_week, 'Monday')
                day_code = DAY_CODES.get(entry.day_of_week, 'MON')
                
                slot = entry.time_slot
                period_num = slot.slot_number if slot else 1
                start_str = slot.start_time.strftime('%H:%M') if (slot and slot.start_time) else ''
                end_str = slot.end_time.strftime('%H:%M') if (slot and slot.end_time) else ''
                
                key = (day_code, period_num, grade_str, section_str, subject_str)
                if key not in seen_keys:
                    seen_keys.add(key)
                    schedule_items.append({
                        'id': str(entry.id),
                        'day': day_display,
                        'day_code': day_code,
                        'period': period_num,
                        'start_time': start_str,
                        'end_time': end_str,
                        'subject': subject_str,
                        'grade': grade_str,
                        'section': section_str,
                        'room': room,
                        'student_count': get_strength(sec)
                    })
                    
        # Sort schedule by day order (MON, TUE, WED, THU, FRI, SAT, SUN) and period_number
        DAY_ORDER = {'MON': 1, 'Monday': 1, 'TUE': 2, 'Tuesday': 2, 'WED': 3, 'Wednesday': 3, 'THU': 4, 'Thursday': 4, 'FRI': 5, 'Friday': 5, 'SAT': 6, 'Saturday': 6, 'SUN': 7, 'Sunday': 7}
        schedule_items.sort(key=lambda x: (DAY_ORDER.get(x.get('day_code', x['day']), 99), x['period']))

        return Response(schedule_items, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def student_schedule(self, request):
        """
        Get weekly timetable schedule for the currently logged-in student in their school & class.
        Determines current day of week, student's school, grade, and section with fallbacks.
        Returns tabular timetable entries grouped by period & day of week, highlighting today's day.
        """
        user = request.user
        from apps.students.models import Student
        from apps.academics.models import Period, Section
        from apps.academics.models_timetable import TimetableEntry
        from datetime import datetime
        from django.db.models import Q

        student = Student.objects.filter(user=user).first()
        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found for this user.'}, status=404)

        school = student.school or self.get_user_school()
        if not school:
            return Response({'error': 'School context not found for student.'}, status=400)

        # Determine grade & section for this student with full fallbacks
        section = getattr(student, 'current_section', None)
        grade_config = getattr(student, 'grade_config', None)

        # Fallback 1: Check active/temporary enrollments
        enrollment = student.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY']).first()
        if not section and enrollment:
            if hasattr(enrollment, 'section') and enrollment.section:
                if isinstance(enrollment.section, Section):
                    section = enrollment.section
                elif isinstance(enrollment.section, str):
                    section = Section.objects.filter(
                        school=school,
                        section_letter__iexact=enrollment.section.strip()
                    ).first()

        if not grade_config and enrollment and getattr(enrollment, 'grade', None):
            from apps.schools.models_programs import GradeConfiguration
            grade_config = GradeConfiguration.objects.filter(
                school=school,
                grade_name__iexact=str(enrollment.grade).strip()
            ).first()

        if not grade_config and section and getattr(section, 'grade_config', None):
            grade_config = section.grade_config

        if not section and grade_config:
            section = Section.objects.filter(school=school, grade_config=grade_config).first()

        # Build set of matching section IDs for this student
        target_section_ids = set()
        if section:
            target_section_ids.add(section.id)

        if grade_config:
            grade_sections = Section.objects.filter(school=school, grade_config=grade_config)
            if section and getattr(section, 'section_letter', None):
                grade_sections = grade_sections.filter(section_letter__iexact=section.section_letter)
            for gs in grade_sections:
                target_section_ids.add(gs.id)

        grade_name = grade_config.grade_name if grade_config else (section.grade_config.grade_name if (section and section.grade_config) else 'N/A')
        section_name = section.section_letter if section else (getattr(section, 'name', 'A') if section else 'A')
        full_class_name = f"Grade {grade_name}-{section_name}" if grade_name != 'N/A' else 'Enrolled Class'

        # Determine today's day of week
        now = datetime.now()
        day_index = now.weekday()  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
        DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
        today_day_name = DAY_NAMES[day_index]
        today_day_code = DAY_CODES[day_index]
        today_day_num = day_index + 1

        schedule_items = []
        seen_keys = set()

        # 1. Query Period model (Academics Master Timetable)
        periods_qs = Period.objects.filter(timetable__school=school).select_related(
            'timetable', 'timetable__section', 'timetable__section__grade_config',
            'subject_mapping', 'subject_mapping__subject', 'subject_mapping__teacher',
            'subject_mapping__teacher__user'
        )

        if target_section_ids:
            periods_qs = periods_qs.filter(timetable__section_id__in=target_section_ids)
        elif grade_config:
            periods_qs = periods_qs.filter(timetable__section__grade_config=grade_config)

        for p in periods_qs.order_by('period_number'):
            sm = p.subject_mapping
            subject_name = sm.subject.name if (sm and sm.subject) else 'Subject'
            subject_code = getattr(sm.subject, 'code', '') if (sm and sm.subject) else ''

            teacher_name = 'TBA'
            if sm and sm.teacher and sm.teacher.user:
                teacher_name = sm.teacher.user.get_full_name().strip() or sm.teacher.user.email
            elif sm and sm.teacher:
                teacher_name = getattr(sm.teacher, 'tuid', 'Teacher')

            sec = p.timetable.section if p.timetable else None
            room = p.classroom or (sec.room_number if sec else '') or ''
            start_str = p.start_time.strftime('%H:%M') if p.start_time else ''
            end_str = p.end_time.strftime('%H:%M') if p.end_time else ''
            day_display = p.get_day_display()

            key = (p.day, p.period_number, subject_name)
            if key not in seen_keys:
                seen_keys.add(key)
                schedule_items.append({
                    'id': str(p.id),
                    'day': day_display,
                    'day_code': p.day,
                    'period': p.period_number,
                    'start_time': start_str,
                    'end_time': end_str,
                    'subject': subject_name,
                    'subject_code': subject_code,
                    'teacher': teacher_name,
                    'room': room,
                    'is_today': (p.day.upper() == today_day_code or day_display.lower() == today_day_name.lower())
                })

        # 2. Query TimetableEntry model (Clash Detection Engine)
        entries_qs = TimetableEntry.objects.filter(
            school=school,
            is_active=True,
            is_cancelled=False
        ).select_related(
            'time_slot', 'subject', 'teacher', 'teacher__user',
            'substitute_teacher', 'substitute_teacher__user'
        )

        if target_section_ids:
            entries_qs = entries_qs.filter(section_id__in=target_section_ids)
        elif grade_config:
            entries_qs = entries_qs.filter(Q(grade=grade_config) | Q(section__grade_config=grade_config))

        DAY_NUM_TO_NAME = {1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'}
        DAY_NUM_TO_CODE = {1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 7: 'SUN'}

        for entry in entries_qs.order_by('day_of_week', 'time_slot__slot_number'):
            day_name = DAY_NUM_TO_NAME.get(entry.day_of_week, 'Monday')
            day_code = DAY_NUM_TO_CODE.get(entry.day_of_week, 'MON')
            period_num = entry.time_slot.slot_number if entry.time_slot else 1

            subject_name = entry.subject.name if entry.subject else 'Subject'
            subject_code = getattr(entry.subject, 'code', '') or ''

            teacher_obj = entry.substitute_teacher or entry.teacher
            teacher_name = 'TBA'
            if teacher_obj and teacher_obj.user:
                teacher_name = teacher_obj.user.get_full_name().strip() or teacher_obj.user.email
            elif teacher_obj:
                teacher_name = getattr(teacher_obj, 'tuid', 'Teacher')

            if entry.is_substituted:
                teacher_name += " (Substitute)"

            sec = entry.section
            room = entry.room_number or (sec.room_number if sec else '') or ''
            start_str = entry.time_slot.start_time.strftime('%H:%M') if (entry.time_slot and entry.time_slot.start_time) else ''
            end_str = entry.time_slot.end_time.strftime('%H:%M') if (entry.time_slot and entry.time_slot.end_time) else ''

            key = (day_code, period_num, subject_name)
            if key not in seen_keys:
                seen_keys.add(key)
                schedule_items.append({
                    'id': str(entry.id),
                    'day': day_name,
                    'day_code': day_code,
                    'period': period_num,
                    'start_time': start_str,
                    'end_time': end_str,
                    'subject': subject_name,
                    'subject_code': subject_code,
                    'teacher': teacher_name,
                    'room': room,
                    'is_today': (entry.day_of_week == today_day_num)
                })

        # 3. Fallback: If no periods were found for target_section_ids, fetch all periods in the school
        if not schedule_items:
            fallback_periods = Period.objects.filter(timetable__school=school).select_related(
                'timetable', 'timetable__section', 'subject_mapping',
                'subject_mapping__subject', 'subject_mapping__teacher',
                'subject_mapping__teacher__user'
            ).order_by('period_number')

            for p in fallback_periods:
                sm = p.subject_mapping
                subject_name = sm.subject.name if (sm and sm.subject) else 'Subject'
                subject_code = getattr(sm.subject, 'code', '') if (sm and sm.subject) else ''

                teacher_name = 'TBA'
                if sm and sm.teacher and sm.teacher.user:
                    teacher_name = sm.teacher.user.get_full_name().strip() or sm.teacher.user.email
                elif sm and sm.teacher:
                    teacher_name = getattr(sm.teacher, 'tuid', 'Teacher')

                sec = p.timetable.section if p.timetable else None
                room = p.classroom or (sec.room_number if sec else '') or ''
                start_str = p.start_time.strftime('%H:%M') if p.start_time else ''
                end_str = p.end_time.strftime('%H:%M') if p.end_time else ''
                day_display = p.get_day_display()

                key = (p.day, p.period_number, subject_name)
                if key not in seen_keys:
                    seen_keys.add(key)
                    schedule_items.append({
                        'id': str(p.id),
                        'day': day_display,
                        'day_code': p.day,
                        'period': p.period_number,
                        'start_time': start_str,
                        'end_time': end_str,
                        'subject': subject_name,
                        'subject_code': subject_code,
                        'teacher': teacher_name,
                        'room': room,
                        'is_today': (p.day.upper() == today_day_code or day_display.lower() == today_day_name.lower())
                    })

        # Sort schedule by day order (MON to SUN) and period
        DAY_ORDER = {'MON': 1, 'Monday': 1, 'TUE': 2, 'Tuesday': 2, 'WED': 3, 'Wednesday': 3, 'THU': 4, 'Thursday': 4, 'FRI': 5, 'Friday': 5, 'SAT': 6, 'Saturday': 6, 'SUN': 7, 'Sunday': 7}
        schedule_items.sort(key=lambda x: (DAY_ORDER.get(x.get('day_code', x['day']), 99), x['period']))

        student_name = ""
        if student.user:
            student_name = student.user.get_full_name().strip()
        if not student_name:
            student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        if not student_name:
            student_name = getattr(student, 'full_name_display', '') or student.suid or 'Student'

        return Response({
            'today_day': today_day_name,
            'today_day_code': today_day_code,
            'today_day_num': today_day_num,
            'school_name': school.display_name or school.legal_name,
            'student_name': student_name,
            'suid': student.suid,
            'grade': str(grade_name),
            'section': str(section_name),
            'class_name': full_class_name,
            'schedule': schedule_items
        }, status=status.HTTP_200_OK)





class PeriodViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    serializer_class = PeriodSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['timetable', 'day']
    school_field = 'timetable__school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'timetable'
    
    rbac_action_permissions = {
        'list': 'academics.add_timetable',
        'retrieve': 'academics.add_timetable',
        'create': 'academics.add_timetable',
        'update': 'academics.add_timetable',
        'partial_update': 'academics.add_timetable',
        'destroy': 'academics.add_timetable',
        'by_timetable': 'academics.add_timetable',
    }

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            if request.method not in permissions.SAFE_METHODS:
                if obj.timetable.created_by_id and obj.timetable.created_by_id != user.id:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You can only modify periods for timetables created by you.")

    def perform_create(self, serializer):
        user = self.request.user
        timetable_id = self.request.data.get('timetable_id') or self.request.data.get('timetable')
        if timetable_id and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.academics.models import Timetable
            try:
                timetable = Timetable.objects.get(id=timetable_id)
                if timetable.created_by_id and timetable.created_by_id != user.id:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You can only add periods to timetables created by you.")
            except Timetable.DoesNotExist:
                pass
        serializer.save()

    def get_queryset(self):
        queryset = Period.objects.select_related('timetable', 'subject_mapping')
        
        # Enforce grade scope limits for non-admin users
        user = self.request.user
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
            has_add_timetable = False
            allowed_grade_ids = set()
            unrestricted = False
            
            for role in roles:
                if role.permissions.filter(codename='academics.add_timetable').exists():
                    has_add_timetable = True
                    scopes = role.timetable_grade_scopes.all()
                    if not scopes.exists():
                        unrestricted = True
                    else:
                        for s in scopes:
                            allowed_grade_ids.add(s.id)
                            
            if has_add_timetable and not unrestricted:
                queryset = queryset.filter(timetable__section__grade_config_id__in=allowed_grade_ids)
                
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_timetable(self, request):
        """Get periods for a timetable"""
        timetable_id = request.query_params.get('timetable_id')
        if not timetable_id:
            return Response({'error': 'timetable_id required'}, status=400)
        
        periods = self.get_queryset().filter(timetable_id=timetable_id).order_by('day', 'period_number')
        serializer = self.get_serializer(periods, many=True)
        return Response(serializer.data)


# ============================================================
# SYLLABUS VIEW
# ============================================================

class SyllabusViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Syllabus.objects.all()
    serializer_class = SyllabusSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'subject_mapping', 'academic_year']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'syllabus'
    rbac_action_permissions = {
        'list': 'academics.view_syllabus',
        'retrieve': 'academics.view_syllabus',
        'progress': 'academics.view_syllabus',
        'create': 'academics.add_syllabus',
        'update': 'academics.edit_chapter',
        'partial_update': 'academics.edit_chapter',
        'destroy': 'academics.edit_chapter',
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Enforce syllabus scope limits for non-admin users
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
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
            
            if has_syllabus_perm:
                if not unrestricted:
                    queryset = queryset.filter(subject_mapping_id__in=allowed_subject_mappings)
                        
        return queryset
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """Get detailed progress for a syllabus"""
        syllabus = self.get_object()
        chapters = syllabus.chapters.all()
        
        return Response({
            'total_chapters': chapters.count(),
            'completed': chapters.filter(status='COMPLETED').count(),
            'in_progress': chapters.filter(status='IN_PROGRESS').count(),
            'not_started': chapters.filter(status='NOT_STARTED').count(),
            'progress_percentage': syllabus.progress_percentage
        })


class ChapterViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    serializer_class = ChapterSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['syllabus', 'status']
    school_field = 'syllabus__school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'syllabus'
    rbac_action_permissions = {
        'list': 'academics.view_syllabus',
        'retrieve': 'academics.view_syllabus',
        'mark_complete': 'academics.edit_chapter',
        'mark_in_progress': 'academics.edit_chapter',
        'create': 'academics.add_chapter',
        'update': 'academics.edit_chapter',
        'partial_update': 'academics.edit_chapter',
        'destroy': 'academics.edit_chapter',
    }
    
    def get_queryset(self):
        queryset = Chapter.objects.select_related('syllabus', 'last_updated_by')
        user = self.request.user
        
        # Enforce syllabus scope limits for non-admin users
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
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
            
            if has_syllabus_perm:
                if not unrestricted:
                    queryset = queryset.filter(syllabus__subject_mapping_id__in=allowed_subject_mappings)
                        
        return queryset
    
    @action(detail=True, methods=['patch'])
    def mark_complete(self, request, pk=None):
        """Mark a chapter as completed"""
        chapter = self.get_object()
        chapter.status = 'COMPLETED'
        chapter.last_updated_by = request.user
        chapter.save()
        
        serializer = self.get_serializer(chapter)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def mark_in_progress(self, request, pk=None):
        """Mark a chapter as in progress"""
        chapter = self.get_object()
        chapter.status = 'IN_PROGRESS'
        chapter.last_updated_by = request.user
        chapter.save()
        
        serializer = self.get_serializer(chapter)
        return Response(serializer.data)


# ============================================================
# EXAM VIEW
# ============================================================

class ExamViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'section', 'subject_mapping', 'exam_type', 'academic_year']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'exam'
    rbac_action_permissions = {
        'list': ['academics.view_exam', 'academics.view_marks_entry', 'attendance.view_attendance', 'teachers.view_teaching'],
        'retrieve': ['academics.view_exam', 'academics.view_marks_entry', 'attendance.view_attendance', 'teachers.view_teaching'],
        'upcoming': ['academics.view_exam', 'academics.view_marks_entry', 'attendance.view_attendance', 'teachers.view_teaching'],
        'create': 'academics.add_exam',
        'update': 'academics.add_exam',
        'partial_update': 'academics.add_exam',
        'destroy': 'academics.add_exam',
        'lock_marks': ['academics.add_exam', 'academics.view_marks_entry'],
        'unlock_marks': ['academics.add_exam', 'academics.view_marks_entry'],
    }

    def get_permissions(self):
        if self.action == 'student_marks_and_results':
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        user = request.user
        if self.action in ['student_marks_and_results']:
            return
        if self.action in ['create', 'list', 'retrieve', 'upcoming'] and user.is_authenticated:
            from apps.teachers.models import Teacher
            if user.user_type == 'TEACHER' or Teacher.objects.filter(user=user).exists():
                return
        super().check_permissions(request)


    def perform_create(self, serializer):
        user = self.request.user
        school = self.get_user_school()
        
        from apps.teachers.models import Teacher
        is_teacher = (user.user_type == 'TEACHER') or Teacher.objects.filter(user=user).exists()
        is_admin = user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
        
        if is_teacher and not is_admin:
            exam_type = serializer.validated_data.get('exam_type')
            if exam_type and exam_type != 'UNIT_TEST':
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'exam_type': 'Teachers are only permitted to add Unit Test exams.'})
            serializer.save(school=school, exam_type='UNIT_TEST')
        else:
            serializer.save(school=school)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        purpose = self.request.query_params.get('purpose', 'exams')
        
        # Scope filtering for exams
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.teachers.models import Teacher, TeacherAssignment
            from apps.academics.models import SubjectMapping
            from django.db.models import Q

            teacher = Teacher.objects.filter(user=user).first()
            if not teacher and user.user_type == 'ROLE':
                from apps.accounts.rbac_models import UserRole
                ur = UserRole.objects.filter(user=user, is_active=True).first()
                if ur and ur.role and ur.role.associated_user:
                    teacher = Teacher.objects.filter(user=ur.role.associated_user).first()
            if not teacher:
                teacher = Teacher.objects.filter(user__email__iexact=user.email).first()

            if teacher or user.user_type == 'TEACHER':
                allowed_mapping_ids = set()
                if teacher:
                    # 1. Direct mappings where teacher is assigned
                    for sm_id in SubjectMapping.objects.filter(school=self.get_user_school(), teacher=teacher).values_list('id', flat=True):
                        allowed_mapping_ids.add(sm_id)
                    # 2. Teacher assignments with specific subject
                    assignments = TeacherAssignment.objects.filter(teacher=teacher, role__in=['SUBJECT_TEACHER', 'SUBSTITUTE'], is_active=True)
                    for ta in assignments:
                        sub_name = (ta.subject or '').strip()
                        g_name = (ta.grade or '').replace('Grade', '').strip()
                        s_let = (ta.section or '').strip()
                        if sub_name:
                            sub_q = Q(school=self.get_user_school()) & (Q(subject__name__iexact=sub_name) | Q(subject__code__iexact=sub_name))
                            if g_name:
                                sub_q &= (Q(section__grade_config__grade_name__icontains=g_name) | Q(section__grade_config__grade_name__iexact=g_name))
                            if s_let:
                                sub_q &= Q(section__section_letter__iexact=s_let)
                            for sm_id in SubjectMapping.objects.filter(sub_q).values_list('id', flat=True):
                                allowed_mapping_ids.add(sm_id)

                exam_filter = Q(subject_mapping_id__in=allowed_mapping_ids)
                if teacher:
                    exam_filter |= Q(invigilators=teacher)
                elif user.is_authenticated:
                    exam_filter |= Q(invigilators__user=user)
                
                return queryset.filter(exam_filter).distinct()

            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
            allowed_subject_mappings = set()
            allowed_exam_types = set()
            unrestricted_subjects = False
            unrestricted_types = False
            has_academics_perm = False
            
            for role in roles:
                if purpose == 'exams':
                    has_perm = role.permissions.filter(codename__in=[
                        'academics.view_exam', 'academics.add_exam'
                    ]).exists()
                    
                    if has_perm:
                        has_academics_perm = True
                        
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
                                
                elif purpose == 'marks':
                    has_perm = role.permissions.filter(codename='academics.view_marks_entry').exists()
                    if has_perm:
                        has_academics_perm = True
                        
                        # Marks subject scopes
                        scopes = role.marks_subject_scopes.all()
                        if not scopes.exists():
                            unrestricted_subjects = True
                        else:
                            for s in scopes:
                                allowed_subject_mappings.add(s.id)
                        unrestricted_types = True
            
            if has_academics_perm:
                if not unrestricted_subjects:
                    queryset = queryset.filter(subject_mapping_id__in=allowed_subject_mappings)
                if not unrestricted_types:
                    queryset = queryset.filter(exam_type__in=allowed_exam_types)
            else:
                queryset = queryset.none()
                    
        return queryset

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming exams"""
        from django.utils import timezone
        exams = self.filter_queryset(self.get_queryset()).filter(
            exam_date__gte=timezone.now().date()
        ).order_by('exam_date')[:10]
        serializer = self.get_serializer(exams, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def lock_marks(self, request, pk=None):
        """Lock marks for an exam - ONLY Admin / School Admin can lock"""
        if getattr(request.user, 'user_type', '') not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return Response({'detail': 'Only school admin can lock marks.'}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        exam.marks_locked = True
        exam.save()
        
        # Approve all results for this exam to trigger report card generation
        results = exam.results.all()
        for r in results:
            r.moderation_status = 'APPROVED'
            r.save()  # Triggers signal to recalculate report card
            
        return Response({'status': 'Marks locked successfully'})

    @action(detail=True, methods=['post'])
    def unlock_marks(self, request, pk=None):
        """Unlock marks for an exam - ONLY Admin / School Admin can unlock"""
        if getattr(request.user, 'user_type', '') not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return Response({'detail': 'Only school admin can unlock marks.'}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        exam.marks_locked = False
        exam.save()
        
        # Revert results for this exam to DRAFT
        results = exam.results.all()
        for r in results:
            r.moderation_status = 'DRAFT'
            r.save()  # Triggers signal to recalculate/delete report card
            
        return Response({'status': 'Marks unlocked successfully'})

    @action(detail=False, methods=['get'])
    def student_marks_and_results(self, request):
        """
        Get exams, marks obtained, and annual report cards for the currently logged-in student.
        Exams table data:
        - Exam Name (from Exams)
        - Exam Type (from Exams)
        - Exam Category (from Exams)
        - Maximum Marks (from Exams)
        - Passing Marks (from Exams)
        - Marks Obtained (from Marks Entry / Result)
        
        Annual Report Card section:
        - Annual report card data (from Results / ReportCard)
        """
        user = request.user
        from apps.students.models import Student
        from apps.academics.models import Exam, Result, ReportCard, Section

        student = Student.objects.filter(user=user).first()
        if not student:
            student_id = request.query_params.get('student_id')
            if student_id:
                student = Student.objects.filter(id=student_id).first()

        if not student:
            return Response({'error': 'Student profile not found for this user.'}, status=404)

        school = student.school or self.get_user_school()
        if not school:
            return Response({'error': 'School context not found for student.'}, status=400)

        # Determine student's grade & section
        section = getattr(student, 'current_section', None)
        grade_config = getattr(student, 'grade_config', None)

        enrollment = student.enrollments.filter(status__in=['ACTIVE', 'TEMPORARY']).first()
        if not section and enrollment and getattr(enrollment, 'section', None):
            if isinstance(enrollment.section, Section):
                section = enrollment.section
            elif isinstance(enrollment.section, str):
                section = Section.objects.filter(school=school, section_letter__iexact=enrollment.section.strip()).first()

        if not grade_config and enrollment and getattr(enrollment, 'grade', None):
            from apps.schools.models_programs import GradeConfiguration
            grade_config = GradeConfiguration.objects.filter(school=school, grade_name__iexact=str(enrollment.grade).strip()).first()

        if not grade_config and section and getattr(section, 'grade_config', None):
            grade_config = section.grade_config

        if not section and grade_config:
            section = Section.objects.filter(school=school, grade_config=grade_config).first()

        # Build list of candidate section IDs
        target_section_ids = set()
        if section:
            target_section_ids.add(section.id)

        if grade_config:
            grade_sections = Section.objects.filter(school=school, grade_config=grade_config)
            if section and getattr(section, 'section_letter', None):
                grade_sections = grade_sections.filter(section_letter__iexact=section.section_letter)
            for gs in grade_sections:
                target_section_ids.add(gs.id)

        # 1. Fetch Exams created by the school for student's section/grade (EXCLUDING Final Exams)
        exams_qs = Exam.objects.filter(school=school).exclude(
            exam_type__iexact='FINALS'
        ).exclude(
            exam_type__iexact='FINAL'
        ).exclude(
            exam_type__iexact='FINAL_EXAM'
        ).select_related(
            'section', 'subject_mapping', 'subject_mapping__subject'
        )

        if target_section_ids:
            exams_qs = exams_qs.filter(section_id__in=target_section_ids)
        elif grade_config:
            exams_qs = exams_qs.filter(section__grade_config=grade_config)

        # Fallback to non-final exams in school if section is unassigned or empty
        if not exams_qs.exists():
            exams_qs = Exam.objects.filter(school=school).exclude(
                exam_type__iexact='FINALS'
            ).exclude(
                exam_type__iexact='FINAL'
            ).exclude(
                exam_type__iexact='FINAL_EXAM'
            ).select_related(
                'section', 'subject_mapping', 'subject_mapping__subject'
            )

        exams_qs = exams_qs.order_by('-exam_date')

        # 2. Fetch Marks Obtained from Result model (Marks Entry) for this student
        student_results = Result.objects.filter(
            student=student
        ).select_related('exam')

        results_by_exam_id = {str(res.exam_id): res for res in student_results}

        exam_items = []
        for ex in exams_qs:
            res = results_by_exam_id.get(str(ex.id))
            
            marks_obtained_display = "-"
            status_display = "Pending Entry"
            grade = "-"

            # ONLY display marks obtained if marks for this exam have been LOCKED in Marks Entry
            is_marks_locked = ex.marks_locked or (res and res.moderation_status in ['APPROVED', 'LOCKED'])

            if res and is_marks_locked:
                if res.is_absent:
                    marks_obtained_display = "AB"
                    status_display = "Absent"
                    grade = "AB"
                else:
                    marks_obtained_display = str(res.marks_obtained)
                    status_display = res.result_status or ("PASS" if res.marks_obtained >= ex.passing_marks else "FAIL")
                    grade = res.grade or "-"
            elif res and not is_marks_locked:
                status_display = "Pending Lock"

            subject_name = ex.subject_mapping.subject.name if (ex.subject_mapping and ex.subject_mapping.subject) else "General"

            exam_items.append({
                'id': str(ex.id),
                'exam_name': ex.name,
                'subject_name': subject_name,
                'exam_type': ex.exam_type,
                'exam_type_display': ex.get_exam_type_display() if hasattr(ex, 'get_exam_type_display') else ex.exam_type,
                'exam_category': ex.assessment_category,
                'exam_category_display': ex.get_assessment_category_display() if hasattr(ex, 'get_assessment_category_display') else ex.assessment_category,
                'max_marks': ex.max_marks,
                'passing_marks': ex.passing_marks,
                'marks_obtained': marks_obtained_display,
                'status': status_display,
                'grade': grade,
                'is_locked': is_marks_locked,
                'exam_date': str(ex.exam_date) if ex.exam_date else ""
            })


        # 3. Fetch Annual Report Cards from ReportCard model (Results) for this student
        report_cards_qs = ReportCard.objects.filter(
            student=student
        ).select_related('section').order_by('-generated_date', '-academic_year')

        # Fallback to suid match
        if not report_cards_qs.exists() and student.suid:
            report_cards_qs = ReportCard.objects.filter(
                student__suid=student.suid
            ).select_related('section').order_by('-generated_date', '-academic_year')

        report_cards = []
        for rc in report_cards_qs:
            report_cards.append({
                'id': str(rc.id),
                'term_name': rc.term_name,
                'academic_year': rc.academic_year,
                'total_marks_obtained': float(rc.total_marks_obtained),
                'total_marks_possible': float(rc.total_marks_possible),
                'percentage': float(rc.percentage),
                'grade_awarded': rc.grade_awarded,
                'rank': rc.rank,
                'remarks': rc.remarks or "Great performance throughout the year!",
                'is_locked': rc.is_locked,
                'generated_date': str(rc.generated_date) if rc.generated_date else ""
            })

        student_name = ""
        if student.user:
            student_name = student.user.get_full_name().strip()
        if not student_name:
            student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
        if not student_name:
            student_name = getattr(student, 'full_name_display', '') or student.suid or 'Student'

        return Response({
            'student_name': student_name,
            'suid': student.suid,
            'school_name': school.display_name or school.legal_name,
            'grade': grade_config.grade_name if grade_config else 'N/A',
            'section': section.section_letter if section else 'A',
            'exams': exam_items,
            'report_cards': report_cards
        }, status=status.HTTP_200_OK)



# ============================================================
# RESULT VIEW
# ============================================================

class ResultViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['exam', 'student']
    school_field = 'exam__school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'result'
    rbac_action_permissions = {
        'list': 'academics.view_marks_entry',
        'retrieve': 'academics.view_marks_entry',
        'for_student': 'academics.view_marks_entry',
        'for_exam': 'academics.view_marks_entry',
        'create': 'academics.view_marks_entry',
        'update': 'academics.view_marks_entry',
        'partial_update': 'academics.view_marks_entry',
        'destroy': 'academics.view_marks_entry',
        'save_aggregation': 'academics.view_marks_entry',
        'undo_aggregation': 'academics.view_marks_entry',
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.select_related('exam', 'student', 'recorded_by')
        
        user = self.request.user
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            from apps.teachers.models import Teacher, TeacherAssignment
            from apps.academics.models import SubjectMapping
            from django.db.models import Q
            
            teacher = Teacher.objects.filter(user=user).first()
            if not teacher and user.user_type == 'ROLE':
                from apps.accounts.rbac_models import UserRole
                ur = UserRole.objects.filter(user=user, is_active=True).first()
                if ur and ur.role and ur.role.associated_user:
                    teacher = Teacher.objects.filter(user=ur.role.associated_user).first()
            if not teacher:
                teacher = Teacher.objects.filter(user__email__iexact=user.email).first()

            if teacher or user.user_type == 'TEACHER':
                allowed_mapping_ids = set()
                if teacher:
                    for sm_id in SubjectMapping.objects.filter(school=self.get_user_school(), teacher=teacher).values_list('id', flat=True):
                        allowed_mapping_ids.add(sm_id)
                    assignments = TeacherAssignment.objects.filter(teacher=teacher, role__in=['SUBJECT_TEACHER', 'SUBSTITUTE'], is_active=True)
                    for ta in assignments:
                        sub_name = (ta.subject or '').strip()
                        g_name = (ta.grade or '').replace('Grade', '').strip()
                        s_let = (ta.section or '').strip()
                        if sub_name:
                            sub_q = Q(school=self.get_user_school()) & (Q(subject__name__iexact=sub_name) | Q(subject__code__iexact=sub_name))
                            if g_name:
                                sub_q &= (Q(section__grade_config__grade_name__icontains=g_name) | Q(section__grade_config__grade_name__iexact=g_name))
                            if s_let:
                                sub_q &= Q(section__section_letter__iexact=s_let)
                            for sm_id in SubjectMapping.objects.filter(sub_q).values_list('id', flat=True):
                                allowed_mapping_ids.add(sm_id)
                res_filter = Q(exam__subject_mapping_id__in=allowed_mapping_ids)
                if teacher:
                    res_filter |= Q(exam__invigilators=teacher)
                elif user.is_authenticated:
                    res_filter |= Q(exam__invigilators__user=user)
                return queryset.filter(res_filter).distinct()

            from apps.accounts.permission_utils import get_user_roles
            roles = get_user_roles(user, self.get_user_school())
            
            has_marks_perm = False
            allowed_subject_mappings = set()
            unrestricted = False
            
            for role in roles:
                has_perm = role.permissions.filter(codename='academics.view_marks_entry').exists()
                if has_perm:
                    has_marks_perm = True
                    scopes = role.marks_subject_scopes.all()
                    if not scopes.exists():
                        unrestricted = True
                    else:
                        for s in scopes:
                            allowed_subject_mappings.add(s.id)
            
            if has_marks_perm and not unrestricted:
                queryset = queryset.filter(exam__subject_mapping_id__in=allowed_subject_mappings)
                
        return queryset
    
    @action(detail=False, methods=['get'])
    def for_student(self, request):
        """Get all results for a student"""
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id required'}, status=400)
        
        results = self.get_queryset().filter(student_id=student_id).order_by('-exam__exam_date')
        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def for_exam(self, request):
        """Get all results for an exam"""
        exam_id = request.query_params.get('exam_id')
        if not exam_id:
            return Response({'error': 'exam_id required'}, status=400)
        
        results = self.get_queryset().filter(exam_id=exam_id).order_by('-marks_obtained')
        
        # Calculate statistics
        total_results = results.count()
        absent_count = results.filter(is_absent=True).count()
        present_results = results.filter(is_absent=False)
        
        stats = {
            'total': total_results,
            'absent': absent_count,
            'present': present_results.count(),
            'average_marks': sum(r.marks_obtained for r in present_results) / max(present_results.count(), 1) if present_results.exists() else 0,
            'highest_marks': max((r.marks_obtained for r in present_results), default=0),
            'lowest_marks': min((r.marks_obtained for r in present_results), default=0),
        }
        
        serializer = self.get_serializer(results, many=True)
        return Response({
            'statistics': stats,
            'results': serializer.data
        })

    @action(detail=False, methods=['post'])
    def save_aggregation(self, request):
        """
        POST /api/v1/academics/results/save_aggregation/
        """
        if not can(request.user, 'ENTER_MARKS', 'ACADEMIC_SYSTEM'):
            raise PermissionDenied("You do not have permission to enter or aggregate marks.")

        category = request.data.get('category')  # 'INTERNAL' or 'PRACTICAL'
        section_id = request.data.get('section_id')
        subject_id = request.data.get('subject_id')
        scores = request.data.get('scores', {})

        if not category or not section_id or not subject_id:
            return Response({'error': 'category, section_id, and subject_id are required'}, status=400)

        if category not in ['INTERNAL', 'PRACTICAL']:
            return Response({'error': 'Invalid category'}, status=400)

        # 1. Update existing results
        results = Result.objects.filter(
            exam__section_id=section_id,
            exam__subject_mapping__subject_id=subject_id
        )

        updated_student_ids = set()
        for r in results:
            student_id_str = str(r.student_id)
            if student_id_str in scores:
                val = scores[student_id_str]
                if category == 'INTERNAL':
                    r.aggregated_internal_marks = val
                else:
                    r.aggregated_practical_marks = val
                r.save()
                updated_student_ids.add(student_id_str)

        # 2. Sync missing student results by creating placeholder results under any exam
        missing_student_ids = set(scores.keys()) - updated_student_ids
        if missing_student_ids:
            exam = Exam.objects.filter(
                section_id=section_id,
                subject_mapping__subject_id=subject_id,
                assessment_category=category
            ).first()
            
            if not exam:
                exam = Exam.objects.filter(
                    section_id=section_id,
                    subject_mapping__subject_id=subject_id
                ).first()

            if exam:
                for student_id in missing_student_ids:
                    val = scores[student_id]
                    Result.objects.create(
                        exam=exam,
                        student_id=student_id,
                        marks_obtained=0,
                        is_absent=True,
                        aggregated_internal_marks=val if category == 'INTERNAL' else None,
                        aggregated_practical_marks=val if category == 'PRACTICAL' else None,
                        recorded_by=request.user,
                        remarks="Placeholder for aggregated marks"
                    )

        return Response({'message': 'Aggregated marks saved successfully.'})

    @action(detail=False, methods=['post'])
    def undo_aggregation(self, request):
        """
        POST /api/v1/academics/results/undo_aggregation/
        """
        if not can(request.user, 'ENTER_MARKS', 'ACADEMIC_SYSTEM'):
            raise PermissionDenied("You do not have permission to enter or aggregate marks.")

        category = request.data.get('category')  # 'INTERNAL' or 'PRACTICAL'
        section_id = request.data.get('section_id')
        subject_id = request.data.get('subject_id')

        if not category or not section_id or not subject_id:
            return Response({'error': 'category, section_id, and subject_id are required'}, status=400)

        if category not in ['INTERNAL', 'PRACTICAL']:
            return Response({'error': 'Invalid category'}, status=400)

        # Filter results for this section and subject
        results = Result.objects.filter(
            exam__section_id=section_id,
            exam__subject_mapping__subject_id=subject_id
        )

        for r in results:
            if category == 'INTERNAL':
                r.aggregated_internal_marks = None
            else:
                r.aggregated_practical_marks = None

            # Delete placeholder results if both aggregated marks are None
            if (r.aggregated_internal_marks is None and
                r.aggregated_practical_marks is None and
                r.remarks == "Placeholder for aggregated marks"):
                r.delete()
            else:
                r.save()

        return Response({'message': 'Aggregated marks cleared successfully.'})


# ============================================================
# REPORT CARD VIEW
# ============================================================

class ReportCardViewSet(SchoolIsolationMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportCardSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['student', 'section', 'academic_year']
    school_field = 'student__school'
    
    # RBAC Configuration
    rbac_module = 'reports'
    rbac_resource = 'report_card'
    rbac_action_permissions = {
        'list': 'academics.view_results',
        'retrieve': 'academics.view_results',
        'for_student': 'academics.view_results',
        'upload_pdf': 'academics.generate_report_card',
    }

    def get_permissions(self):
        if self.action == 'for_student' and self.request.user and self.request.user.user_type == 'STUDENT':
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def check_permissions(self, request):
        if self.action == 'for_student' and request.user and request.user.user_type == 'STUDENT':
            return
        super().check_permissions(request)

    
    def get_queryset(self):
        return ReportCard.objects.select_related('student', 'section', 'generated_by')
    
    @action(detail=False, methods=['get'])
    def for_student(self, request):
        """Get all report cards for a student"""
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id required'}, status=400)
        
        cards = self.get_queryset().filter(student_id=student_id).order_by('-generated_date')
        serializer = self.get_serializer(cards, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='upload_pdf')
    def upload_pdf(self, request):
        """Upload/Save a generated report card PDF for a student"""
        student_id = request.data.get('student_id')
        section_id = request.data.get('section_id')
        academic_year = request.data.get('academic_year', '2026-2027')
        term_name = request.data.get('term_name', 'Term 1 - 2025-2026')
        pdf_file = request.FILES.get('file')

        # Accept marks stats from frontend (calculated from FINALS exam results)
        total_marks_obtained = request.data.get('total_marks_obtained')
        total_marks_possible = request.data.get('total_marks_possible')
        percentage = request.data.get('percentage')

        if not student_id or not pdf_file:
            return Response({'error': 'student_id and file are required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.students.models import Student
        
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        section = None
        if section_id:
            try:
                section = Section.objects.get(id=section_id)
            except Section.DoesNotExist:
                return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)

        # Look up or create ReportCard. If it exists, update it. If not, create it.
        report_card, created = ReportCard.objects.get_or_create(
            student=student,
            section=section,
            academic_year=academic_year,
            term_name=term_name
        )

        if report_card.file_path:
            # Delete old file from storage to avoid orphan files
            report_card.file_path.delete(save=False)

        report_card.file_path = pdf_file
        report_card.generated_by = request.user if request.user.is_authenticated else None

        # Update marks stats if provided
        if total_marks_obtained is not None:
            try:
                report_card.total_marks_obtained = float(total_marks_obtained)
            except (ValueError, TypeError):
                pass
        if total_marks_possible is not None:
            try:
                report_card.total_marks_possible = float(total_marks_possible)
            except (ValueError, TypeError):
                pass
        if percentage is not None:
            try:
                report_card.percentage = float(percentage)
            except (ValueError, TypeError):
                pass
        elif total_marks_obtained is not None and total_marks_possible is not None:
            # Auto-calculate percentage if not explicitly provided
            try:
                obt = float(total_marks_obtained)
                poss = float(total_marks_possible)
                if poss > 0:
                    report_card.percentage = round((obt / poss) * 100, 2)
            except (ValueError, TypeError):
                pass

        # Auto-assign grade based on percentage
        pct = float(report_card.percentage)
        if pct >= 90:
            report_card.grade_awarded = 'A+'
        elif pct >= 80:
            report_card.grade_awarded = 'A'
        elif pct >= 70:
            report_card.grade_awarded = 'B'
        elif pct >= 60:
            report_card.grade_awarded = 'C'
        elif pct >= 50:
            report_card.grade_awarded = 'D'
        elif pct >= 40:
            report_card.grade_awarded = 'E'
        else:
            report_card.grade_awarded = 'F'

        report_card.save()

        serializer = self.get_serializer(report_card)
        return Response(serializer.data, status=status.HTTP_200_OK)


from .models import DirectEvaluation
from .serializers import DirectEvaluationSerializer

class DirectEvaluationViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = DirectEvaluation.objects.all()
    serializer_class = DirectEvaluationSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['section', 'subject_mapping', 'category_id']
    school_field = 'school'
    
    rbac_module = 'academics'
    rbac_resource = 'result'
    rbac_action_permissions = {
        'list': ['academics.view_marks_entry', 'academics.view_exam', 'teachers.view_teaching', 'attendance.view_attendance'],
        'retrieve': ['academics.view_marks_entry', 'academics.view_exam', 'teachers.view_teaching', 'attendance.view_attendance'],
        'create': ['academics.view_marks_entry', 'academics.view_exam', 'teachers.view_teaching', 'attendance.view_attendance'],
        'update': ['academics.view_marks_entry', 'academics.view_exam', 'teachers.view_teaching', 'attendance.view_attendance'],
        'partial_update': ['academics.view_marks_entry', 'academics.view_exam', 'teachers.view_teaching', 'attendance.view_attendance'],
        'destroy': ['academics.view_marks_entry', 'academics.view_exam', 'teachers.view_teaching', 'attendance.view_attendance'],
    }

    def create(self, request, *args, **kwargs):
        school = self.get_user_school()
        section_id = request.data.get('section')
        subject_mapping_id = request.data.get('subject_mapping')
        category_id = request.data.get('category_id')
        
        evaluation, created = DirectEvaluation.objects.get_or_create(
            school=school,
            section_id=section_id,
            subject_mapping_id=subject_mapping_id,
            category_id=category_id
        )

        is_admin = getattr(request.user, 'user_type', '') in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
        
        # If locked and user is not admin, reject all modifications
        if evaluation.is_locked and not is_admin:
            return Response(
                {'detail': 'This assessment has been locked by the school admin and cannot be modified.'},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Verify teacher subject assignment for non-admin users
        if not is_admin:
            from apps.teachers.models import Teacher, TeacherAssignment
            from apps.academics.models import SubjectMapping
            teacher_obj = getattr(request.user, 'teacher_profile', None) or Teacher.objects.filter(user=request.user).first()
            if not teacher_obj and request.user.user_type == 'ROLE':
                from apps.accounts.rbac_models import UserRole
                ur = UserRole.objects.filter(user=request.user, is_active=True).first()
                if ur and ur.role and ur.role.associated_user:
                    teacher_obj = Teacher.objects.filter(user=ur.role.associated_user).first()
            if not teacher_obj:
                teacher_obj = Teacher.objects.filter(user__email__iexact=request.user.email).first()

            is_assigned = False
            if teacher_obj:
                sm = SubjectMapping.objects.filter(id=subject_mapping_id).first()
                if sm:
                    if sm.teacher_id and str(sm.teacher_id) == str(teacher_obj.id):
                        is_assigned = True
                    else:
                        sub_name = (sm.subject.name if sm.subject else '').strip().lower()
                        g_name = (sm.section.grade_config.grade_name if sm.section and sm.section.grade_config else '').replace('Grade', '').strip().lower()
                        s_let = (sm.section.section_letter if sm.section else '').strip().upper()
                        for ta in TeacherAssignment.objects.filter(teacher=teacher_obj, role__in=['SUBJECT_TEACHER', 'SUBSTITUTE'], is_active=True):
                            ta_sub = (ta.subject or '').strip().lower()
                            ta_g = (ta.grade or '').replace('Grade', '').strip().lower()
                            ta_s = (ta.section or '').strip().upper()
                            if ta_sub and ta_sub == sub_name and (not ta_g or ta_g in g_name or g_name in ta_g) and (not ta_s or ta_s == s_let):
                                is_assigned = True
                                break
            if not is_assigned:
                return Response(
                    {'detail': 'You do not have permission to enter evaluations for this subject as you are not assigned to it.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Only admin can configure marks/grade system
        if 'config' in request.data:
            if is_admin or created:
                evaluation.config = request.data['config']
                
        if 'grades' in request.data:
            evaluation.grades = request.data['grades']
            
        # Only admin can lock/unlock
        if 'is_locked' in request.data:
            if is_admin:
                evaluation.is_locked = bool(request.data['is_locked'])
            
        evaluation.save()
        serializer = self.get_serializer(evaluation)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        evaluation = self.get_object()
        is_admin = getattr(request.user, 'user_type', '') in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
        if evaluation.is_locked and not is_admin:
            return Response(
                {'detail': 'This assessment has been locked by the school admin and cannot be modified.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        evaluation = self.get_object()
        is_admin = getattr(request.user, 'user_type', '') in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
        if evaluation.is_locked and not is_admin:
            return Response(
                {'detail': 'This assessment has been locked by the school admin and cannot be modified.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)