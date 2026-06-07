"""
Promotion Logic Service
Computes student promotion decisions based on exam results and rules
"""
from decimal import Decimal
from typing import Dict, List, Tuple
from django.db.models import Avg, Count, Q
from apps.academics.models import (
    Result, ResultPromotionRule, StudentPromotionDecision, 
    Exam, Subject
)
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment


class PromotionService:
    """Service to compute and finalize promotion decisions"""
    
    def __init__(self, student: Student, academic_year: str):
        self.student = student
        self.academic_year = academic_year
        self.enrollment = self._get_enrollment()
        self.rule = self._get_promotion_rule()
    
    def _get_enrollment(self) -> StudentEnrollment:
        """Get active enrollment for the student"""
        enrollment = StudentEnrollment.objects.filter(
            student=self.student,
            academic_year=self.academic_year,
            status='ACTIVE'
        ).first()
        
        if not enrollment:
            raise ValueError(f"No active enrollment found for {self.student.user.full_name} in {self.academic_year}")
        
        return enrollment
    
    def _get_promotion_rule(self) -> ResultPromotionRule:
        """Get applicable promotion rule for student's grade"""
        from apps.schools.models_programs import GradeConfiguration
        
        # Get grade object
        # Assuming enrollment.grade contains the grade number/order as string
        grade_config = GradeConfiguration.objects.filter(
            grade_order=int(self.enrollment.grade) 
        ).first()
        
        if not grade_config:
            raise ValueError(f"Grade configuration for {self.enrollment.grade} not found")
        
        rule = ResultPromotionRule.objects.filter(
            grade_config=grade_config,
            academic_year=self.academic_year,
            is_active=True
        ).first()
        
        if not rule:
            # Return default rule if none configured
            return self._get_default_rule(grade_config)
        
        return rule
    
    def _get_default_rule(self, grade_config) -> ResultPromotionRule:
        """Create a default rule if none exists"""
        rule = ResultPromotionRule(
            school_id=self.enrollment.school_id,
            grade_config=grade_config,
            academic_year=self.academic_year,
            min_overall_percentage=Decimal('40.00'),
            min_attendance_percentage=Decimal('75.00'),
            max_compartments_allowed=2,
            allow_reexam_for_absent=True,
            allow_reexam_for_fail=True,
            reexam_window_days=30,
            is_active=True
        )
        return rule
    
    def compute_decision(self) -> Dict:
        """
        Compute promotion decision for the student
        Returns dict with decision details (not saved to DB yet)
        """
        # Get all APPROVED/LOCKED results for this student in academic year
        results = Result.objects.filter(
            student=self.student,
            moderation_status__in=['APPROVED', 'LOCKED'],
            exam__academic_year=self.academic_year
        ).select_related('exam', 'exam__subject_mapping__subject')
        
        if not results.exists():
            return {
                'status': 'NO_RESULTS',
                'message': 'No exam results found for this academic year'
            }
        
        # Group results by subject (take latest attempt only)
        subject_results = self._group_by_subject(results)
        
        # Analyze each subject
        subject_analysis = []
        pass_count = 0
        fail_count = 0
        absent_count = 0
        compartment_count = 0
        
        total_marks_obtained = Decimal('0.00')
        total_marks_possible = Decimal('0.00')
        
        for subject_code, result_list in subject_results.items():
            # Get latest attempt
            latest_result = max(result_list, key=lambda r: r.attempt_number)
            
            total_marks_obtained += latest_result.marks_obtained
            total_marks_possible += latest_result.exam.max_marks
            
            subject_info = {
                'subject_code': subject_code,
                'subject_name': latest_result.exam.subject_mapping.subject.name,
                'marks_obtained': float(latest_result.marks_obtained),
                'max_marks': float(latest_result.exam.max_marks),
                'percentage': float((latest_result.marks_obtained / latest_result.exam.max_marks) * 100),
                'status': latest_result.result_status,
                'grade': latest_result.grade,
                'attempt': latest_result.attempt_number,
            }
            
            subject_analysis.append(subject_info)
            
            # Count statuses
            if latest_result.result_status == 'PASS':
                pass_count += 1
            elif latest_result.result_status == 'FAIL':
                fail_count += 1
            elif latest_result.result_status == 'ABSENT':
                absent_count += 1
        
        # Calculate overall percentage
        overall_percentage = (total_marks_obtained / total_marks_possible * 100) if total_marks_possible > 0 else Decimal('0.00')
        
        # Apply promotion logic
        decision = self._apply_promotion_logic(
            subject_analysis,
            overall_percentage,
            fail_count,
            absent_count
        )
        
        return {
            'student_id': str(self.student.id),
            'student_name': self.student.user.full_name,
            'academic_year': self.academic_year,
            'grade': self.enrollment.grade,
            'section': self.enrollment.section,
            'overall_percentage': float(overall_percentage),
            'subjects': subject_analysis,
            'pass_count': pass_count,
            'fail_count': fail_count,
            'absent_count': absent_count,
            'decision': decision,
            'rule_applied': {
                'min_overall_percentage': float(self.rule.min_overall_percentage),
                'max_compartments_allowed': self.rule.max_compartments_allowed,
                'allow_reexam_for_absent': self.rule.allow_reexam_for_absent,
                'allow_reexam_for_fail': self.rule.allow_reexam_for_fail,
            }
        }
    
    def _group_by_subject(self, results) -> Dict[str, List[Result]]:
        """Group results by subject code"""
        grouped = {}
        for result in results:
            subject_code = result.exam.subject_mapping.subject.code
            if subject_code not in grouped:
                grouped[subject_code] = []
            grouped[subject_code].append(result)
        return grouped
    
    def _apply_promotion_logic(self, subject_analysis: List[Dict], overall_percentage: Decimal, 
                                fail_count: int, absent_count: int) -> Dict:
        """
        Apply promotion rules to determine final decision
        
        Key logic:
        - ABSENT does NOT count toward compartment limit (if allow_reexam_for_absent=True)
        - FAIL counts toward compartment limit
        - If fails exceed max_compartments_allowed → DETAINED
        - If fails within limit → COMPARTMENT (eligible for re-exam)
        - If overall % < min → DETAINED
        """
        # Check overall percentage
        if overall_percentage < self.rule.min_overall_percentage:
            return {
                'status': 'DETAINED',
                'reason': f'Overall percentage ({overall_percentage:.2f}%) below minimum ({self.rule.min_overall_percentage}%)',
                'action_required': 'Student must repeat the grade'
            }
        
        # Count subjects eligible for compartment (FAIL only, not ABSENT)
        compartment_eligible = fail_count
        
        # Check if within compartment limit
        if compartment_eligible > self.rule.max_compartments_allowed:
            failed_subjects = [s['subject_name'] for s in subject_analysis if s['status'] == 'FAIL']
            return {
                'status': 'DETAINED',
                'reason': f'Failed in {compartment_eligible} subjects (max allowed: {self.rule.max_compartments_allowed})',
                'failed_subjects': failed_subjects,
                'action_required': 'Student must repeat the grade'
            }
        
        # Check for ABSENT subjects
        if absent_count > 0 and self.rule.allow_reexam_for_absent:
            absent_subjects = [s['subject_name'] for s in subject_analysis if s['status'] == 'ABSENT']
            return {
                'status': 'COMPARTMENT',
                'reason': f'Absent in {absent_count} subject(s)',
                'compartment_subjects': absent_subjects,
                'action_required': 'Re-exam required for absent subjects (does not count toward compartment limit)',
                'reexam_eligible': True
            }
        
        # Check for FAIL within limit
        if compartment_eligible > 0 and self.rule.allow_reexam_for_fail:
            failed_subjects = [s['subject_name'] for s in subject_analysis if s['status'] == 'FAIL']
            return {
                'status': 'COMPARTMENT',
                'reason': f'Failed in {compartment_eligible} subject(s) (within compartment limit)',
                'compartment_subjects': failed_subjects,
                'action_required': 'Re-exam required for failed subjects',
                'reexam_eligible': True
            }
        
        # All clear → PROMOTED
        return {
            'status': 'PROMOTED',
            'reason': 'Passed all subjects with required overall percentage',
            'action_required': None
        }
    
    def finalize_decision(self, decided_by_user) -> StudentPromotionDecision:
        """
        Compute and save the promotion decision to database
        Locks the decision
        """
        decision_data = self.compute_decision()
        
        # Check if we have results to process
        if not decision_data.get('subjects') or len(decision_data.get('subjects', [])) == 0:
            raise ValueError('Cannot finalize decision without exam results')
        
        from apps.schools.models_programs import GradeConfiguration
        from_grade_config = GradeConfiguration.objects.filter(grade_order=int(self.enrollment.grade)).first()
        
        # Determine to_grade based on decision
        to_grade_config = None
        if decision_data['decision']['status'] == 'PROMOTED':
            next_grade_num = int(self.enrollment.grade) + 1
            to_grade_config = GradeConfiguration.objects.filter(grade_order=next_grade_num).first()
        
        # Build subject-wise JSON
        subject_wise = {
            s['subject_code']: {
                'status': s['status'],
                'percentage': s['percentage'],
                'grade': s['grade']
            }
            for s in decision_data['subjects']
        }
        
        # Get compartment/failed subjects
        compartment_subjects = ','.join([
            s['subject_name'] for s in decision_data['subjects'] 
            if s['status'] in ['FAIL', 'ABSENT']
        ])
        
        failed_subjects = ','.join([
            s['subject_name'] for s in decision_data['subjects'] 
            if s['status'] == 'FAIL'
        ])
        
        # Create or update decision
        decision, created = StudentPromotionDecision.objects.update_or_create(
            student=self.student,
            academic_year=self.academic_year,
            defaults={
                'from_grade_config': from_grade_config,
                'to_grade_config': to_grade_config,
                'overall_status': decision_data['decision']['status'],
                'overall_percentage': decision_data['overall_percentage'],
                'subject_wise_status': subject_wise,
                'compartment_subjects': compartment_subjects,
                'failed_subjects': failed_subjects,
                'remarks': decision_data['decision']['reason'],
                'is_locked': True,
                'decided_by': decided_by_user,
            }
        )
        
        from django.utils import timezone
        decision.decided_at = timezone.now()
        decision.save()
        
        return decision
