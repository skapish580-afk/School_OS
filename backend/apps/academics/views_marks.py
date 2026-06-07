"""
Professional Marks Management System
Industry-standard workflow for exam creation and marks entry
"""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q, Prefetch, Count
from django.shortcuts import get_object_or_404
from datetime import date

from .models import Exam, Result, Subject, SubjectMapping
from apps.teachers.models import Teacher, TeacherAssignment
from apps.enrollments.models import StudentEnrollment
from apps.students.models import Student
from apps.schools.models import School


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def teacher_exam_list(request):
    """
    Get list of exams where teacher can enter marks
    Only shows exams for subjects teacher teaches
    
    Industry Standard: Teacher sees only PUBLISHED exams for their subjects
    """
    try:
        teacher = Teacher.objects.get(user=request.user)
        
        # Get teacher's assignments (classes they teach)
        assignments = TeacherAssignment.objects.filter(
            teacher=teacher,
            is_active=True
        ).select_related('school')
        
        if not assignments.exists():
            return Response({
                'exams': [],
                'message': 'No teaching assignments found'
            })
        
        # Get all subject mappings for this teacher
        subject_mappings = SubjectMapping.objects.filter(
            teacher=teacher,
            is_active=True
        ).select_related('subject', 'section', 'section__grade')
        
        exams_data = []
        
        for mapping in subject_mappings:
            # Get exams for this subject-section combination
            exams = Exam.objects.filter(
                subject_mapping=mapping,
                academic_year='2025-26'
            ).select_related('section', 'subject_mapping__subject')
            
            for exam in exams:
                # Count how many students have marks entered
                total_students = StudentEnrollment.objects.filter(
                    grade=str(mapping.section.grade.grade_number),
                    section=mapping.section.section_letter,
                    status='ACTIVE'
                ).count()
                
                marks_entered = Result.objects.filter(
                    exam=exam
                ).count()
                
                # Check if teacher has submitted/locked this exam
                all_results = Result.objects.filter(exam=exam)
                has_draft = all_results.filter(moderation_status='DRAFT').exists()
                has_submitted = all_results.filter(moderation_status='SUBMITTED').exists()
                is_approved = all_results.filter(moderation_status='APPROVED').exists()
                is_locked = all_results.filter(moderation_status='LOCKED').exists()
                
                # Determine overall status
                if is_locked:
                    exam_status = 'LOCKED'
                    can_edit = False
                elif is_approved:
                    exam_status = 'APPROVED'
                    can_edit = False
                elif has_submitted:
                    exam_status = 'SUBMITTED'
                    can_edit = False
                elif has_draft or marks_entered > 0:
                    exam_status = 'DRAFT'
                    can_edit = True
                else:
                    exam_status = 'NOT_STARTED'
                    can_edit = True
                
                exams_data.append({
                    'id': str(exam.id),
                    'name': exam.name,
                    'exam_type': exam.exam_type,
                    'subject': mapping.subject.name,
                    'subject_code': mapping.subject.code,
                    'class': f"{mapping.section.grade.grade_number}-{mapping.section.section_letter}",
                    'exam_date': exam.exam_date.isoformat(),
                    'max_marks': exam.max_marks,
                    'passing_marks': exam.passing_marks,
                    'total_students': total_students,
                    'marks_entered': marks_entered,
                    'completion_percentage': round((marks_entered / total_students * 100), 1) if total_students > 0 else 0,
                    'status': exam_status,
                    'can_edit': can_edit,
                })
        
        # Group by exam type for better organization
        grouped_exams = {
            'unit_tests': [e for e in exams_data if e['exam_type'] == 'UNIT_TEST'],
            'midterms': [e for e in exams_data if e['exam_type'] == 'MIDTERM'],
            'finals': [e for e in exams_data if e['exam_type'] == 'FINALS'],
            'periodic': [e for e in exams_data if e['exam_type'] == 'PERIODIC'],
        }
        
        return Response({
            'exams': exams_data,
            'grouped': grouped_exams,
            'total': len(exams_data)
        })
        
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def exam_marks_entry(request, exam_id):
    """
    GET: Fetch students list with current marks for an exam
    POST: Save marks (draft or submit for approval)
    
    Industry Standard: Teachers can only edit DRAFT status marks
    """
    try:
        teacher = Teacher.objects.get(user=request.user)
        exam = get_object_or_404(Exam, id=exam_id)
        
        # Verify teacher has permission to enter marks for this exam
        if exam.subject_mapping.teacher != teacher:
            return Response(
                {'error': 'You do not have permission to enter marks for this exam'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.method == 'GET':
            # Fetch student list with their current marks
            students = StudentEnrollment.objects.filter(
                grade=str(exam.section.grade.grade_number),
                section=exam.section.section_letter,
                status='ACTIVE'
            ).select_related('student', 'student__user').order_by('roll_number')
            
            # Determine exam status and editability
            all_results = Result.objects.filter(exam=exam)
            has_draft = all_results.filter(moderation_status='DRAFT').exists()
            has_submitted = all_results.filter(moderation_status='SUBMITTED').exists()
            is_approved = all_results.filter(moderation_status='APPROVED').exists()
            is_locked = all_results.filter(moderation_status='LOCKED').exists()

            if is_locked:
                exam_status = 'LOCKED'
                exam_can_edit = False
            elif is_approved:
                exam_status = 'APPROVED'
                exam_can_edit = False
            elif has_submitted:
                exam_status = 'SUBMITTED'
                exam_can_edit = False
            elif has_draft or all_results.exists():
                exam_status = 'DRAFT'
                exam_can_edit = True
            else:
                exam_status = 'NOT_STARTED'
                exam_can_edit = True

            students_data = []
            for enrollment in students:
                # Get existing result if any
                result = Result.objects.filter(
                    exam=exam,
                    student=enrollment.student
                ).first()
                
                students_data.append({
                    'student_id': str(enrollment.student.id),
                    'roll_number': enrollment.roll_number,
                    'name': enrollment.student.user.full_name,
                    'suid': enrollment.student.suid,
                    'marks': float(result.marks_obtained) if result and not result.is_absent else None,
                    'is_absent': result.is_absent if result else False,
                    'grade': result.grade if result else None,
                    'remarks': result.remarks if result else '',
                    'status': result.moderation_status if result else 'NOT_ENTERED',
                    'can_edit': result.moderation_status in ['DRAFT', 'NOT_ENTERED'] if result else True,
                })
            
            return Response({
                'exam': {
                    'id': str(exam.id),
                    'name': exam.name,
                    'subject': exam.subject_mapping.subject.name,
                    'class': f"{exam.section.grade.grade_name}-{exam.section.section_letter}",
                    'exam_date': exam.exam_date.isoformat(),
                    'max_marks': exam.max_marks,
                    'passing_marks': exam.passing_marks,
                    'status': exam_status,
                    'can_edit': exam_can_edit,
                },
                'students': students_data,
                'total_students': len(students_data)
            })
        
        elif request.method == 'POST':
            # Save marks (bulk update)
            marks_data = request.data.get('marks', [])
            action_type = request.data.get('action', 'save_draft')  # save_draft or submit
            
            if not marks_data:
                return Response(
                    {'error': 'No marks data provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate and save marks
            saved_count = 0
            errors = []
            
            for entry in marks_data:
                try:
                    student = Student.objects.get(id=entry['student_id'])
                    marks = entry.get('marks')
                    is_absent = entry.get('is_absent', False)
                    remarks = entry.get('remarks', '')
                    
                    # Validation
                    if not is_absent:
                        if marks is None:
                            errors.append(f"Marks missing for {student.user.full_name}")
                            continue
                        if float(marks) > exam.max_marks:
                            errors.append(f"Marks exceed maximum for {student.user.full_name}")
                            continue
                        if float(marks) < 0:
                            errors.append(f"Negative marks not allowed for {student.user.full_name}")
                            continue
                    
                    # Create or update result
                    result, created = Result.objects.update_or_create(
                        exam=exam,
                        student=student,
                        defaults={
                            'marks_obtained': marks if not is_absent else 0,
                            'is_absent': is_absent,
                            'remarks': remarks,
                            'moderation_status': 'SUBMITTED' if action_type == 'submit' else 'DRAFT',
                            'recorded_by': request.user,
                        }
                    )
                    saved_count += 1
                    
                except Student.DoesNotExist:
                    errors.append(f"Student {entry.get('student_id')} not found")
                except Exception as e:
                    errors.append(f"Error processing {entry.get('student_id')}: {str(e)}")
            
            status_message = 'submitted for approval' if action_type == 'submit' else 'saved as draft'
            
            return Response({
                'success': True,
                'message': f'Marks {status_message}',
                'saved_count': saved_count,
                'errors': errors
            })
    
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def marks_summary(request):
    """
    Get summary of marks entry status for teacher's dashboard
    """
    try:
        teacher = Teacher.objects.get(user=request.user)
        
        # Get all exams for teacher's subjects
        subject_mappings = SubjectMapping.objects.filter(
            teacher=teacher,
            is_active=True
        )
        
        total_exams = 0
        pending_entry = 0
        submitted = 0
        approved = 0
        
        for mapping in subject_mappings:
            exams = Exam.objects.filter(
                subject_mapping=mapping,
                academic_year='2025-26'
            )
            
            for exam in exams:
                total_exams += 1
                results = Result.objects.filter(exam=exam)
                
                if not results.exists():
                    pending_entry += 1
                elif results.filter(moderation_status='DRAFT').exists():
                    pending_entry += 1
                elif results.filter(moderation_status='SUBMITTED').exists():
                    submitted += 1
                elif results.filter(moderation_status__in=['APPROVED', 'LOCKED']).exists():
                    approved += 1
        
        return Response({
            'total_exams': total_exams,
            'pending_entry': pending_entry,
            'submitted': submitted,
            'approved': approved
        })
        
    except Teacher.DoesNotExist:
        return Response(
            {'error': 'Teacher profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )


# ============================================================
# PROMOTION & RESULT STATUS APIS
# ============================================================

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def compute_promotion(request, student_id):
    """
    Compute promotion decision for a student (preview, not saved)
    Accessible by teachers/admins to see student status
    """
    try:
        from .promotion_service import PromotionService
        
        student = get_object_or_404(Student, id=student_id)
        academic_year = request.data.get('academic_year', '2026-2027')
        
        service = PromotionService(student, academic_year)
        decision_data = service.compute_decision()
        
        return Response(decision_data)
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to compute promotion: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def finalize_promotion(request, student_id):
    """
    Finalize and lock promotion decision (admin only)
    Creates StudentPromotionDecision record
    """
    try:
        from .promotion_service import PromotionService
        
        # Check if user has permission (admin only)
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(
                {'error': 'Only administrators can finalize promotion decisions'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        student = get_object_or_404(Student, id=student_id)
        academic_year = request.data.get('academic_year', '2026-2027')
        
        service = PromotionService(student, academic_year)
        decision = service.finalize_decision(decided_by_user=request.user)
        
        return Response({
            'success': True,
            'message': 'Promotion decision finalized and locked',
            'decision': {
                'id': str(decision.id),
                'status': decision.overall_status,
                'percentage': float(decision.overall_percentage),
                'remarks': decision.remarks,
                'compartment_subjects': decision.compartment_subjects,
                'failed_subjects': decision.failed_subjects,
            }
        })
        
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to finalize promotion: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_promotion_decision(request, student_id):
    """
    Get existing promotion decision for a student
    """
    try:
        from .models import StudentPromotionDecision
        
        student = get_object_or_404(Student, id=student_id)
        academic_year = request.GET.get('academic_year', '2026-2027')
        
        decision = StudentPromotionDecision.objects.filter(
            student=student,
            academic_year=academic_year
        ).first()
        
        if not decision:
            return Response(
                {'message': 'No promotion decision found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'id': str(decision.id),
            'student_id': str(decision.student.id),
            'student_name': decision.student.user.full_name,
            'academic_year': decision.academic_year,
            'from_grade': str(decision.from_grade.grade_number),
            'to_grade': str(decision.to_grade.grade_number) if decision.to_grade else None,
            'overall_status': decision.overall_status,
            'overall_percentage': float(decision.overall_percentage),
            'subject_wise_status': decision.subject_wise_status,
            'compartment_subjects': decision.compartment_subjects,
            'failed_subjects': decision.failed_subjects,
            'remarks': decision.remarks,
            'is_locked': decision.is_locked,
            'decided_by': decision.decided_by.full_name if decision.decided_by else None,
            'decided_at': decision.decided_at.isoformat() if decision.decided_at else None,
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch decision: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

