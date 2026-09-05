from rest_framework import viewsets, response, status, views, permissions
from apps.students.models import Student
from .models import ForumPost, ForumComment
from .serializers import ForumPostSerializer, ForumCommentSerializer, AlumniSerializer
from rest_framework.decorators import action
from django.db.models import Q

class CommunitySchoolsView(views.APIView):
    """
    Get all schools for search dropdown in Community section
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.schools.models import School
        schools = School.objects.all().values('id', 'display_name', 'legal_name', 'code', 'city')
        return response.Response(list(schools))

class AlumniDirectoryView(views.APIView):
    """
    Global Alumni Directory (Cross-School)
    Only shows students with status=GRADUATED and alumni_directory_consent=True
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Student.objects.filter(
            status__in=['ALUMNI', 'GRADUATED', 'PENDING_ALUMNI'],
            alumni_directory_consent=True
        )
        
        # Search functionality
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(user__full_name__icontains=search) | 
                Q(suid__icontains=search)
            )
            
        # Filter by city (from school location)
        city = request.query_params.get('city')
        if city:
            queryset = queryset.filter(school__city__icontains=city)

        # Filter by school
        school_id = request.query_params.get('school_id')
        if school_id:
            queryset = queryset.filter(school_id=school_id)

        serializer = AlumniSerializer(queryset, many=True)
        return response.Response(serializer.data)

class ForumPostViewSet(viewsets.ModelViewSet):
    queryset = ForumPost.objects.all()
    serializer_class = ForumPostSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ForumPost.objects.none()
            
        queryset = ForumPost.objects.all()
        
        # Filtering logic
        scope = self.request.query_params.get('scope', 'all') # 'all', 'global', 'school', 'city'
        
        if scope == 'global':
            queryset = queryset.filter(is_global=True)
        elif scope == 'school' and user.school:
            queryset = queryset.filter(school=user.school)
        elif scope == 'city' and user.school and user.school.city:
            queryset = queryset.filter(city_localized__icontains=user.school.city)
        else:
            # Default: show relevant posts
            queryset = queryset.filter(
                Q(is_global=True) | 
                Q(school=user.school) |
                Q(city_localized=user.school.city if user.school and user.school.city else "NON_EXISTENT")
            ).distinct()
            
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        # Automatically set author and school
        # If it's a parent connect post, it might have city_localized set by frontend or derived
        city = self.request.data.get('city_localized')
        if not city and self.request.user.school:
            city = self.request.user.school.city
            
        serializer.save(
            author=self.request.user, 
            school=self.request.user.school,
            city_localized=city
        )

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        post = self.get_object()
        serializer = ForumCommentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user, post=post)
            return response.Response(serializer.data, status=status.HTTP_201_CREATED)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
