from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from apps.schools.models import School
from apps.schools.models_programs import Campus, AcademicProgram, GradeConfiguration
from apps.owner.models_onboarding import OnboardingChecklist
from apps.owner.permissions import IsOwner
from .serializers_onboarding import (
    Step1SchoolIdentitySerializer,
    Step2OwnerAdminSerializer,
    Step3CampusSerializer,
    Step4AProgramSerializer,
    Step4BGradeSerializer,
    Step6FeatureSerializer,
    Step10LegalSerializer,
    OnboardingChecklistSerializer,
    OnboardingStatusSerializer,
    CampusSerializer,
    AcademicProgramSerializer,
    GradeConfigurationSerializer,
)


class OnboardingViewSet(viewsets.ViewSet):
    """
    ViewSet for School Onboarding Wizard
    
    Handles all 11 steps of the onboarding process:
    1. School Identity
    2. Owner & Admin
    3. Campus Setup
    4. Academic Programs & Grades
    5. Curriculum (optional)
    6. Feature Enablement
    7. Fees & Payment (optional)
    8. RBAC (optional)
    9. Branding (optional)
    10. Legal & Compliance
    11. Go-Live Checklist
    """
    permission_classes = [IsOwner]
    
    @action(detail=False, methods=['post'], url_path='step1')
    def step1_school_identity(self, request):
        """
        STEP 1: Create School Identity
        
        POST /api/v1/owner/onboarding/step1/
        {
            "legal_name": "ABC International School",
            "display_name": "ABC School",
            "code": "ABC-MUM-01",
            "country": "India",
            "state": "Maharashtra",
            "city": "Mumbai",
            "address": "123 Main Street",
            "timezone": "Asia/Kolkata",
            "default_currency": "INR",
            "academic_year_start_month": 4,
            "primary_language": "English"
        }
        """
        serializer = Step1SchoolIdentitySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            school = serializer.save()
            return Response({
                'success': True,
                'message': 'School identity created successfully',
                'school_id': school.id,
                'school_name': school.display_name,
                'next_step': 2
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='step2')
    def step2_owner_admin(self, request):
        """
        STEP 2: Create Owner & Super Admin
        
        POST /api/v1/owner/onboarding/step2/
        {
            "school_id": "uuid",
            "owner_name": "John Doe",
            "owner_email": "john@abcschool.com",
            "mobile_number": "+919876543210",
            "password": "SecurePass123!",
            "send_invite": false
        }
        """
        serializer = Step2OwnerAdminSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            result = serializer.save()
            response_data = {
                'success': True,
                'message': 'School admin created successfully',
                'user_id': result['user'].id,
                'user_email': result['user'].email,
                'next_step': 3
            }
            if result.get('password'):
                response_data['password'] = result['password']
            return Response(response_data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='step3')
    def step3_campus(self, request):
        """
        STEP 3: Create Campus
        
        POST /api/v1/owner/onboarding/step3/
        {
            "school_id": "uuid",
            "name": "Main Campus",
            "code": "MAIN",
            "address": "123 Main Street, Mumbai",
            "is_primary": true
        }
        """
        serializer = Step3CampusSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            campus = serializer.save()
            return Response({
                'success': True,
                'message': 'Campus created successfully',
                'campus_id': campus.id,
                'campus_name': campus.name,
                'next_step': 4
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='step4a')
    def step4a_program(self, request):
        """
        STEP 4A: Create Academic Program
        
        POST /api/v1/owner/onboarding/step4a/
        {
            "school_id": "uuid",
            "campus_id": "uuid",
            "name": "Primary Wing",
            "code": "PRI",
            "board": "CBSE",
            "education_level": "PRIMARY",
            "medium_of_instruction": "English",
            "evaluation_system": "MARKS",
            "academic_pattern": "ANNUAL"
        }
        """
        serializer = Step4AProgramSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            program = serializer.save()
            return Response({
                'success': True,
                'message': 'Academic program created successfully',
                'program_id': program.id,
                'program_name': program.name,
                'next_step': '4b'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='step4b')
    def step4b_grades(self, request):
        """
        STEP 4B: Add Grades to Program
        
        POST /api/v1/owner/onboarding/step4b/
        {
            "program_id": "uuid",
            "grades": [
                {"grade_name": "LKG", "grade_order": 1, "max_sections": 2, "default_section_names": ["A", "B"]},
                {"grade_name": "UKG", "grade_order": 2, "max_sections": 2, "default_section_names": ["A", "B"]},
                {"grade_name": "1", "grade_order": 3, "max_sections": 3, "default_section_names": ["A", "B", "C"]}
            ]
        }
        """
        serializer = Step4BGradeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            grades = serializer.save()
            return Response({
                'success': True,
                'message': f'{len(grades)} grades added successfully',
                'grades_count': len(grades),
                'next_step': 5
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='step6')
    def step6_features(self, request):
        """
        STEP 6: Enable Features
        
        POST /api/v1/owner/onboarding/step6/
        {
            "school_id": "uuid",
            "features": ["FINANCE", "EXAMS", "TRANSPORT", "LIBRARY"]
        }
        """
        serializer = Step6FeatureSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            toggles = serializer.save()
            return Response({
                'success': True,
                'message': f'{len(toggles)} features enabled successfully',
                'features_count': len(toggles),
                'next_step': 7
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='step10')
    def step10_legal(self, request):
        """
        STEP 10: Legal & Compliance
        
        POST /api/v1/owner/onboarding/step10/
        {
            "school_id": "uuid",
            "registration_number": "REG123456",
            "gst_number": "27AABCU9603R1ZM",
            "agreement_accepted": true
        }
        """
        serializer = Step10LegalSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            school = serializer.save()
            return Response({
                'success': True,
                'message': 'Legal & compliance information saved',
                'school_id': school.id,
                'next_step': 11
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='(?P<school_id>[^/.]+)/status')
    def get_status(self, request, school_id=None):
        """
        Get Onboarding Status
        
        GET /api/v1/owner/onboarding/{school_id}/status/
        """
        school = get_object_or_404(School, id=school_id)
        checklist = get_object_or_404(OnboardingChecklist, school=school)
        
        data = {
            'school_id': school.id,
            'school_name': school.display_name,
            'current_step': school.onboarding_step,
            'onboarding_status': school.onboarding_status,
            'checklist': OnboardingChecklistSerializer(checklist).data,
            'completion_percentage': checklist.completion_percentage,
            'can_go_live': checklist.mandatory_steps_complete
        }
        
        return Response(data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='(?P<school_id>[^/.]+)/checklist')
    def get_checklist(self, request, school_id=None):
        """
        Get Go-Live Checklist (Step 11)
        
        GET /api/v1/owner/onboarding/{school_id}/checklist/
        """
        school = get_object_or_404(School, id=school_id)
        checklist = get_object_or_404(OnboardingChecklist, school=school)
        
        serializer = OnboardingChecklistSerializer(checklist)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='(?P<school_id>[^/.]+)/complete')
    def complete_onboarding(self, request, school_id=None):
        """
        Complete Onboarding & Go Live
        
        POST /api/v1/owner/onboarding/{school_id}/complete/
        """
        school = get_object_or_404(School, id=school_id)
        checklist = get_object_or_404(OnboardingChecklist, school=school)
        
        # Check if mandatory steps are complete
        if not checklist.mandatory_steps_complete:
            return Response({
                'success': False,
                'message': 'Cannot go live. Mandatory steps are not complete.',
                'completion_percentage': checklist.completion_percentage,
                'missing_steps': self._get_missing_steps(checklist)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark as complete
        checklist.mark_complete(user=request.user)
        
        return Response({
            'success': True,
            'message': f'{school.display_name} is now LIVE!',
            'school_id': school.id,
            'school_status': school.onboarding_status,
            'completed_at': checklist.completed_at
        }, status=status.HTTP_200_OK)
    
    def _get_missing_steps(self, checklist):
        """Helper to identify missing mandatory steps"""
        missing = []
        if not checklist.step_1_school_identity:
            missing.append('School Identity')
        if not checklist.step_2_owner_admin:
            missing.append('Owner & Admin')
        if not checklist.step_4_programs:
            missing.append('Academic Programs')
        if not checklist.step_6_features:
            missing.append('Features')
        if not checklist.step_10_legal:
            missing.append('Legal & Compliance')
        if not checklist.admin_created:
            missing.append('Admin User')
        if not checklist.programs_created:
            missing.append('Programs')
        if not checklist.grades_added:
            missing.append('Grades')
        return missing


class CampusViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Campus CRUD operations
    """
    permission_classes = [IsOwner]
    serializer_class = CampusSerializer
    queryset = Campus.objects.all()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get('school_id')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset


class AcademicProgramViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Academic Program CRUD operations
    """
    permission_classes = [IsOwner]
    serializer_class = AcademicProgramSerializer
    queryset = AcademicProgram.objects.all()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get('school_id')
        campus_id = self.request.query_params.get('campus_id')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        if campus_id:
            queryset = queryset.filter(campus_id=campus_id)
        return queryset


class GradeConfigurationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Grade Configuration CRUD operations
    """
    permission_classes = [IsOwner]
    serializer_class = GradeConfigurationSerializer
    queryset = GradeConfiguration.objects.all()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        program_id = self.request.query_params.get('program_id')
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        return queryset.order_by('grade_order')
