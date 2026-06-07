
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import PromotionBatch, PromotionAssignment, AcademicHistory
from apps.students.models import StudentHistory
from .serializers import PromotionBatchSerializer, PromotionAssignmentSerializer, AcademicHistorySerializer
from .utils import generate_promotion_suggestions, commit_promotions
from rest_framework import filters
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated


class PromotionBatchViewSet(viewsets.ModelViewSet):
    queryset = PromotionBatch.objects.all()
    serializer_class = PromotionBatchSerializer

    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        batch = self.get_object()
        updated = generate_promotion_suggestions(batch)
        ser = PromotionAssignmentSerializer(updated, many=True)
        return Response({'updated': ser.data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def commit(self, request, pk=None):
        batch = self.get_object()
        result = commit_promotions(batch, user=request.user)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def revert(self, request, pk=None):
        batch = self.get_object()
        from .utils import revert_promotions
        result = revert_promotions(batch, user=request.user)
        return Response(result, status=status.HTTP_200_OK)


class PromotionAssignmentViewSet(viewsets.ModelViewSet):
    queryset = PromotionAssignment.objects.all()
    serializer_class = PromotionAssignmentSerializer


class AcademicHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """List academic history records. Supports filtering by `academic_year` (year_code)
    and `student` (student id) query params."""
    queryset = AcademicHistory.objects.all().order_by('-archived_at')
    serializer_class = AcademicHistorySerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['student__id', 'academic_year', 'student__first_name', 'student__last_name']

    def get_queryset(self):
        qs = super().get_queryset()
        academic_year = self.request.query_params.get('academic_year')
        student = self.request.query_params.get('student')
        if academic_year:
            qs = qs.filter(academic_year=academic_year)
        if student:
            try:
                sid = int(student)
                qs = qs.filter(student__id=sid)
            except ValueError:
                pass
        return qs


class MergedAcademicHistoryAPIView(APIView):
    """Return merged previous/current academic history per student for a given academic_year.

    Query params:
    - academic_year: year_code (e.g. '2025-2026')
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year_param = request.query_params.get('academic_year')
        if not year_param:
            return Response({'error': 'academic_year is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve academic_year if an ID was passed instead of year_code
        year_code = year_param
        try:
            from apps.enrollments.models_promotion import AcademicYear as AY
            ay = AY.objects.filter(id=year_param).first()
            if ay:
                year_code = ay.year_code
        except Exception:
            # If enrollments app or model not available, assume year_param is a year_code
            pass

        # fetch current-year records (latest archive first per student)
        curr_qs = AcademicHistory.objects.filter(academic_year=year_code).select_related('student').order_by('student__id', '-archived_at')

        rows = {}

        # gather student ids for current-year records
        student_ids = []
        for r in curr_qs:
            sid = getattr(r.student, 'id', None) or r.student_id
            if sid not in student_ids:
                student_ids.append(sid)

        # fetch most recent prior AcademicHistory for these students in one query (exclude current year)
        prior_qs = AcademicHistory.objects.filter(student__id__in=student_ids).exclude(academic_year=year_code).order_by('student__id', '-archived_at').select_related('student')
        prior_map = {}
        for p in prior_qs:
            sid = getattr(p.student, 'id', None) or p.student_id
            if sid not in prior_map:
                prior_map[sid] = p

        # build rows using current records and prior_map (fast, avoids per-row queries)
        for r in curr_qs:
            sid = getattr(r.student, 'id', None) or r.student_id
            if sid in rows:
                continue

            student_name = f"{getattr(r.student, 'first_name', '')} {getattr(r.student, 'last_name', '')}".strip() or str(r.student)

            prev_grade = '-'
            prev_section = '-'

            prior = prior_map.get(sid)
            if prior:
                prev_grade = prior.class_name or '-'
                prev_section = prior.section or '-'
            else:
                # fallback to StudentHistory if no AcademicHistory prior exists
                try:
                    sh = StudentHistory.objects.filter(student=r.student).exclude(academic_year_name=year_code).order_by('-academic_year_name').first()
                    if sh:
                        prev_grade = sh.grade_name or '-'
                        prev_section = sh.section_name or '-'
                except Exception:
                    pass

            rows[sid] = {
                'student': sid,
                'student_name': student_name,
                'previous_grade': prev_grade,
                'previous_section': prev_section,
                'current_grade': r.class_name or '-',
                'current_section': r.section or '-',
                'promoted_at': r.archived_at.isoformat() if r.archived_at else None,
            }

        data = list(rows.values())
        # If there are no AcademicHistory records for the requested year, fall back to StudentHistory
        if len(data) == 0:
            sh_qs = StudentHistory.objects.filter(academic_year_name=year_code).select_related('student').order_by('student__id')
            rows = {}
            for sh in sh_qs:
                sid = getattr(sh.student, 'id', None) or sh.student_id
                student_name = f"{getattr(sh.student.user, 'first_name', '')} {getattr(sh.student.user, 'last_name', '')}".strip() or str(sh.student)
                prev_grade = '-'
                prev_section = '-'
                prior_sh = StudentHistory.objects.filter(student=sh.student).exclude(academic_year_name=year_code).order_by('-academic_year_name').first()
                if prior_sh:
                    prev_grade = prior_sh.grade_name or '-'
                    prev_section = prior_sh.section_name or '-'

                rows[sid] = {
                    'student': sid,
                    'student_name': student_name,
                    'previous_grade': prev_grade,
                    'previous_section': prev_section,
                    'current_grade': sh.grade_name or '-',
                    'current_section': sh.section_name or '-',
                    'promoted_at': sh.created_at.isoformat() if getattr(sh, 'created_at', None) else None,
                }

            data = list(rows.values())
        # sort
        data.sort(key=lambda x: x.get('student_name') or str(x.get('student')))
        return Response(data)


class AllocationAPIView(APIView):
    def post(self, request, batch_pk):
        batch = get_object_or_404(PromotionBatch, pk=batch_pk)
        updated = generate_promotion_suggestions(batch)
        ser = PromotionAssignmentSerializer(updated, many=True)
        return Response({'updated': ser.data})


class CommitAPIView(APIView):
    def post(self, request, batch_pk):
        batch = get_object_or_404(PromotionBatch, pk=batch_pk)
        result = commit_promotions(batch, user=request.user)
        return Response(result)
