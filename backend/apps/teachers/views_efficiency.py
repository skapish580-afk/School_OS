from rest_framework import viewsets, response, status
from rest_framework.decorators import action
from .models import Teacher, TeacherAssignment, Remark, TeacherEfficiency
from .serializers_efficiency import TeacherEfficiencySerializer
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta

class TeacherEfficiencyViewSet(viewsets.ViewSet):
    """
    Aggregation endpoints for Teacher Efficiency Scorecard.
    """
    
    def retrieve(self, request, pk=None):
        try:
            teacher = Teacher.objects.get(id=pk)
        except Teacher.DoesNotExist:
            return response.Response({"error": "Teacher not found"}, status=status.HTTP_404_NOT_FOUND)

        # 1. Attendance Metrics (Placeholder)
        # In a real system, we'd query TeacherAttendance
        
        # 2. Remarks Breakdown
        remarks = Remark.objects.filter(teacher=teacher)
        remarks_count = remarks.count()
        appreciation_count = remarks.filter(category='APPRECIATION').count()
        
        # 3. Workload
        assignments_count = TeacherAssignment.objects.filter(teacher=teacher, is_active=True).count()
        
        # 4. Persistent Metrics (from TeacherEfficiency model)
        efficiency_record, _ = TeacherEfficiency.objects.get_or_create(teacher=teacher)
        
        # 5. Score Calculation
        # (Base: 50) + (Remarks: 20) + (Persistent Metrics: 30)
        base_score = 50
        remarks_score = (appreciation_count / remarks_count * 20) if remarks_count > 0 else 10
        persistent_score = (float(efficiency_record.punctuality_index) / 100 * 15) + (efficiency_record.appraisal_rating * 3)
        
        total_score = min(base_score + remarks_score + persistent_score, 100)
        
        data = {
            "teacher_name": teacher.user.full_name,
            "tuid": teacher.tuid,
            "score": round(total_score, 1),
            "efficiency_grade": self._get_grade(total_score),
            "metrics": {
                "total_remarks": remarks_count,
                "positive_remarks": appreciation_count,
                "active_assignments": assignments_count,
                "punctuality_index": float(efficiency_record.punctuality_index),
                "appraisal_rating": efficiency_record.appraisal_rating,
                "curriculum_completion": float(efficiency_record.curriculum_completion),
                "student_performance_impact": float(efficiency_record.student_performance_impact)
            },
            "last_appraisal_date": efficiency_record.last_appraisal_date,
            "observation_notes": efficiency_record.observation_notes
        }
        
        return response.Response(data)

    def _get_grade(self, score):
        if score >= 90: return 'A+'
        if score >= 80: return 'A'
        if score >= 70: return 'B'
        if score >= 60: return 'C'
        return 'D'

    @action(detail=True, methods=['post'])
    def update_metrics(self, request, pk=None):
        """Admin only: update appraisal and notes"""
        teacher = Teacher.objects.get(id=pk)
        efficiency_record, _ = TeacherEfficiency.objects.get_or_create(teacher=teacher)
        
        serializer = TeacherEfficiencySerializer(efficiency_record, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return response.Response(serializer.data)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
