from rest_framework import viewsets, permissions, status
from django.http import HttpResponse
import csv
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Achievement, StudentArtifact, StudentYearlyAward
from .serializers import AchievementSerializer, StudentArtifactSerializer, StudentYearlyAwardSerializer
from apps.accounts.permission_utils import RBACPermission
from apps.core.school_isolation import get_user_school, is_platform_admin

class AchievementActionPermission(permissions.BasePermission):
    """
    Custom permission for AchievementViewSet:
    - Safe methods (GET, HEAD, OPTIONS): requires students.view_student_only, view_profile, or view_journey or admin
    - Write methods (POST, PUT, PATCH, DELETE): requires students.record_achievements or admin
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True

        if user.user_type == 'STUDENT':
            if request.method in permissions.SAFE_METHODS:
                return True
            
        from apps.accounts.permission_utils import has_permission
        
        if request.method in permissions.SAFE_METHODS:
            return (
                has_permission(user, 'students.view_student_only') or
                has_permission(user, 'students.view_profile') or
                has_permission(user, 'students.view_journey')
            )
        else:
            return user.user_type == 'TEACHER' or hasattr(user, 'teacher_profile') or has_permission(user, 'students.record_achievements')

    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False
        return True



import uuid

def is_valid_uuid(val):
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


class AchievementViewSet(viewsets.ModelViewSet):
    queryset = Achievement.objects.all()
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated, AchievementActionPermission]

    def get_queryset(self):
        user = self.request.user
        # Base queryset filtered by school for non-platform admins
        if is_platform_admin(user) or (user and getattr(user, 'user_type', '') == 'STUDENT'):
            queryset = Achievement.objects.all()
        else:
            school = get_user_school(user)
            if school:
                # Achievement.student is FK to StudentEnrollment which has 'school'
                queryset = Achievement.objects.filter(student__school=school)
            else:
                queryset = Achievement.objects.none()

        student_id = self.request.query_params.get('student')
        if student_id:
            from django.db.models import Q
            q_filter = Q(student__student__suid__iexact=student_id)
            if is_valid_uuid(student_id):
                q_filter |= Q(student__student__id=student_id) | Q(student_id=student_id)
            elif str(student_id).isdigit():
                q_filter |= Q(student_id=int(student_id)) | Q(student__student_id=int(student_id))
            else:
                q_filter |= Q(student__student_id=student_id)
            queryset = queryset.filter(q_filter)
        
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        return queryset.order_by('-date_awarded')

    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'student parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        achievements = self.get_queryset()
        
        return Response({
            category: achievements.filter(category=category).count()
            for category, _ in Achievement.CATEGORY_CHOICES
        })


class StudentYearlyAwardViewSet(viewsets.ModelViewSet):
    """ViewSet for StudentYearlyAward - the main achievements data"""
    queryset = StudentYearlyAward.objects.select_related(
        'student', 'student__school', 'student_history', 'student_history__school'
    ).all()
    serializer_class = StudentYearlyAwardSerializer
    permission_classes = [permissions.IsAuthenticated, AchievementActionPermission]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Filter by school for non-platform admins
        if is_platform_admin(user) or (user and getattr(user, 'user_type', '') == 'STUDENT'):
            pass
        else:
            school = get_user_school(user)
            if school:
                queryset = queryset.filter(
                    Q(student__school=school) | 
                    Q(student_history__school=school)
                )
            else:
                queryset = queryset.none()
        
        # Filter by student
        student_id = self.request.query_params.get('student')
        if student_id:
            from django.db.models import Q
            q_filter = (
                Q(student__suid__iexact=student_id) |
                Q(student__admission_number__iexact=student_id)
            )
            if is_valid_uuid(student_id):
                q_filter |= Q(student_id=student_id) | Q(student__id=student_id)
            elif str(student_id).isdigit():
                q_filter |= Q(student__enrollments__id=int(student_id))
            queryset = queryset.filter(q_filter)



        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by academic year
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        
        # Filter by level
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(level=level)
        
        return queryset.order_by('-event_date', '-created_at')
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get statistics for awards - category counts, level counts, etc."""
        queryset = self.get_queryset()
        
        # Category stats
        category_stats = {}
        for cat_key, cat_name in StudentYearlyAward.CATEGORY_CHOICES:
            category_stats[cat_key] = {
                'name': cat_name,
                'count': queryset.filter(category=cat_key).count()
            }
        
        # Level stats
        level_stats = {}
        for level_key, level_name in StudentYearlyAward.LEVEL_CHOICES:
            level_stats[level_key] = {
                'name': level_name,
                'count': queryset.filter(level=level_key).count()
            }
        
        # Year-wise stats
        year_stats = queryset.values('academic_year').annotate(
            count=Count('id')
        ).order_by('-academic_year')
        
        return Response({
            'total': queryset.count(),
            'by_category': category_stats,
            'by_level': level_stats,
            'by_year': list(year_stats),
        })
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent awards for the school"""
        queryset = self.get_queryset()[:20]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export achievements report as CSV/JSON"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        format_type = request.query_params.get('format', 'csv').lower()
        grade_param = request.query_params.get('grade', '').strip()
        section_param = request.query_params.get('section', '').strip()
        
        g_raw = grade_param.lower().replace('grade', '').strip() if grade_param else ''
        s_raw = section_param.lower().replace('section', '').strip() if section_param else ''

        from django.db.models import Q
        school = self.get_user_school() if hasattr(self, 'get_user_school') else None

        g_vars = list(set([grade_param, g_raw, f"Grade {g_raw}", grade_param.lower(), grade_param.upper()])) if grade_param else []
        s_vars = list(set([section_param, s_raw, f"Section {s_raw}", section_param.lower(), section_param.upper()])) if section_param else []

        # Query 1: StudentYearlyAward entries
        award_qs = StudentYearlyAward.objects.select_related(
            'student', 'student__user', 'student__grade_config', 'student__current_section'
        )
        if school:
            award_qs = award_qs.filter(student__school=school)
        elif not (request.user and getattr(request.user, 'user_type', '') == 'PLATFORM_ADMIN'):
            award_qs = award_qs.none()

        if start_date and end_date:
            award_qs = award_qs.filter(
                Q(event_date__gte=start_date, event_date__lte=end_date) |
                Q(event_date__isnull=True, created_at__date__gte=start_date, created_at__date__lte=end_date)
            )

        if g_vars:
            award_qs = award_qs.filter(
                Q(student__grade_config__grade_name__in=g_vars) |
                Q(student__enrollments__grade__in=g_vars)
            ).distinct()

        if s_vars:
            award_qs = award_qs.filter(
                Q(student__current_section__section_letter__in=s_vars) |
                Q(student__enrollments__section__in=s_vars)
            ).distinct()

        # Query 2: Achievement entries
        ach_qs = Achievement.objects.select_related(
            'student', 'student__student', 'student__student__user',
            'student__student__grade_config', 'student__student__current_section'
        )
        if school:
            ach_qs = ach_qs.filter(student__school=school)
        elif not (request.user and getattr(request.user, 'user_type', '') == 'PLATFORM_ADMIN'):
            ach_qs = ach_qs.none()

        if start_date and end_date:
            ach_qs = ach_qs.filter(date_awarded__gte=start_date, date_awarded__lte=end_date)

        if g_vars:
            ach_qs = ach_qs.filter(
                Q(grade__in=g_vars) |
                Q(student__grade__in=g_vars) |
                Q(student__student__grade_config__grade_name__in=g_vars)
            ).distinct()

        if s_vars:
            ach_qs = ach_qs.filter(
                Q(student__section__in=s_vars) |
                Q(student__student__current_section__section_letter__in=s_vars)
            ).distinct()

        combined_list = []

        for a in award_qs:
            st = a.student
            dt = str(a.event_date) if a.event_date else str(a.created_at.date())
            g_name = st.grade_config.grade_name if (st and st.grade_config) else ''
            sec_letter = st.current_section.section_letter if (st and st.current_section) else ''
            cat_display = a.get_category_display() if hasattr(a, 'get_category_display') else a.category
            level_display = a.get_level_display() if hasattr(a, 'get_level_display') else a.level
            combined_list.append({
                'date': dt,
                'grade': g_name,
                'section': sec_letter,
                'student_name': st.full_name_display if st else 'N/A',
                'suid': st.suid if st else 'N/A',
                'title': a.title,
                'category': cat_display,
                'level': level_display,
                'description': a.description or ''
            })

        for ach in ach_qs:
            st = ach.student.student if (ach.student and hasattr(ach.student, 'student')) else None
            dt = str(ach.date_awarded) if ach.date_awarded else ''
            g_name = ach.grade or (ach.student.grade if ach.student else '') or (st.grade_config.grade_name if (st and st.grade_config) else '')
            sec_letter = (ach.student.section if ach.student else '') or (st.current_section.section_letter if (st and st.current_section) else '')
            cat_display = ach.get_category_display() if hasattr(ach, 'get_category_display') else ach.category
            combined_list.append({
                'date': dt,
                'grade': g_name,
                'section': sec_letter,
                'student_name': st.full_name_display if st else 'N/A',
                'suid': st.suid if st else 'N/A',
                'title': ach.title,
                'category': cat_display,
                'level': 'SCHOOL',
                'description': ach.description or ''
            })

        if g_raw:
            combined_list = [
                item for item in combined_list
                if str(item['grade']).strip().lower().replace('grade', '').strip() == g_raw
            ]

        if s_raw:
            combined_list = [
                item for item in combined_list
                if str(item['section']).strip().lower().replace('section', '').strip() == s_raw
            ]

        combined_list.sort(key=lambda x: x['date'], reverse=True)

        if format_type == 'json':
            return Response(combined_list)
            
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="achievements_report_{start_date}_to_{end_date}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date', 'Grade', 'Section', 'Student Name', 'SUID', 'Award/Achievement', 'Category', 'Level', 'Description'])
        
        for item in combined_list:
            writer.writerow([
                item['date'],
                item['grade'],
                item['section'],
                item['student_name'],
                item['suid'],
                item['title'],
                item['category'],
                item['level'],
                item['description']
            ])
            
        return response


class ArtifactViewSet(viewsets.ModelViewSet):
    queryset = StudentArtifact.objects.all()
    serializer_class = StudentArtifactSerializer
    permission_classes = [permissions.IsAuthenticated, AchievementActionPermission]

    def get_queryset(self):
        user = self.request.user
        # Base queryset filtered by school for non-platform admins
        if is_platform_admin(user) or (user and getattr(user, 'user_type', '') == 'STUDENT'):
            queryset = StudentArtifact.objects.all()
        else:
            school = get_user_school(user)
            if school:
                # StudentArtifact.student is FK to StudentEnrollment which has 'school'
                queryset = StudentArtifact.objects.filter(student__school=school)
            else:
                queryset = StudentArtifact.objects.none()

        student_id = self.request.query_params.get('student')
        if student_id:
            from django.db.models import Q
            q_filter = Q(student__student__suid__iexact=student_id)
            if is_valid_uuid(student_id):
                q_filter |= Q(student__student__id=student_id) | Q(student_id=student_id)
            elif str(student_id).isdigit():
                q_filter |= Q(student_id=int(student_id))
            else:
                q_filter |= Q(student__student_id=student_id)
            queryset = queryset.filter(q_filter)


        
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')
        
        return queryset.order_by('-upload_date')