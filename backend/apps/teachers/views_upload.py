from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from .models import Teacher
from .serializers import TeacherSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_photo(request):
    """Upload teacher photo separately - Restricted to Admins"""
    if request.user.user_type not in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
        return Response(
            {'detail': 'Profile photo is view-only and can only be updated by the School Admin in the Teachers module.'},
            status=status.HTTP_403_FORBIDDEN
        )
    try:
        teacher = Teacher.objects.get(user=request.user)
        
        if 'photo' not in request.FILES:
            return Response(
                {'error': 'No photo file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        teacher.photo = request.FILES['photo']
        teacher.save()
        
        serializer = TeacherSerializer(teacher)
        return Response(serializer.data)
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
