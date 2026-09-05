"""
Signal handlers for automatic report card calculation
"""
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import Result, ReportCard, Section, SubjectMapping
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from decimal import Decimal
from django.db import transaction


def _get_student_active_year(student):
    """
    Resolve the active academic year string for a student.
    Tries school settings -> AcademicYear model -> enrollment -> fallback.
    """
    try:
        from apps.schools.models_settings import SchoolSettings
        school = None
        enrollment = StudentEnrollment.objects.filter(student=student, status='ACTIVE').first()
        if enrollment and hasattr(enrollment, 'school'):
            school = enrollment.school
        if school is None:
            # Try to reach school via student.user
            from apps.schools.models import School
            school = School.objects.filter(students=student).first()
        if school:
            settings_obj = SchoolSettings.objects.filter(school=school).first()
            if settings_obj and settings_obj.current_academic_year:
                return settings_obj.current_academic_year
    except Exception:
        pass

    try:
        from apps.enrollments.models_promotion import AcademicYear
        # Try to find any school and get its active year
        active_year = AcademicYear.objects.filter(status='ACTIVE').order_by('-created_at').first()
        if active_year:
            return active_year.year_code
    except Exception:
        pass

    # Fall back to enrollment academic year
    try:
        enrollment = StudentEnrollment.objects.filter(student=student, status='ACTIVE').first()
        if enrollment and enrollment.academic_year and enrollment.academic_year != '--':
            return enrollment.academic_year
    except Exception:
        pass

    return ''


def calculate_grade(percentage):
    """Calculate letter grade from percentage"""
    if percentage >= 90:
        return 'A+'
    elif percentage >= 80:
        return 'A'
    elif percentage >= 70:
        return 'B'
    elif percentage >= 60:
        return 'C'
    elif percentage >= 50:
        return 'D'
    else:
        return 'F'


def recalculate_student_report_card(student_id):
    """
    Recalculate report card for a single student based on their approved results
    """
    try:
        student = Student.objects.get(id=student_id)
        
        # Get all APPROVED/LOCKED results for this student
        results = Result.objects.filter(
            student=student,
            moderation_status__in=['APPROVED', 'LOCKED'],
            is_absent=False
        ).select_related('exam')
        
        if not results.exists():
            # No approved results yet, skip
            return
            
        # Calculate totals
        total_obtained = Decimal('0.00')
        total_possible = Decimal('0.00')
        
        for result in results:
            total_obtained += Decimal(str(result.marks_obtained))
            total_possible += Decimal(str(result.exam.max_marks))
        
        if total_possible == 0:
            return
            
        # Calculate percentage
        percentage = (total_obtained / total_possible) * Decimal('100.00')
        percentage = round(percentage, 2)
        
        # Calculate grade
        grade = calculate_grade(float(percentage))
        
        # Resolve active academic year dynamically
        academic_year = _get_student_active_year(student)
        
        # Update or create report card
        with transaction.atomic():
            report_card, created = ReportCard.objects.update_or_create(
                student=student,
                academic_year=academic_year,
                term_name=academic_year,
                defaults={
                    'total_marks_obtained': total_obtained,
                    'total_marks_possible': total_possible,
                    'percentage': percentage,
                    'grade_awarded': grade,
                }
            )
            
            # Recalculate rankings for the student's class
            recalculate_class_rankings(student, academic_year)
            
    except Student.DoesNotExist:
        pass
    except Exception as e:
        print(f"Error recalculating report card for student {student_id}: {e}")


def recalculate_class_rankings(student, academic_year=None):
    """
    Recalculate rankings for all students in the same class
    """
    try:
        # Get student's enrollment
        enrollment = StudentEnrollment.objects.filter(
            student=student,
            status='ACTIVE'
        ).first()
        
        if not enrollment:
            return

        if not academic_year:
            academic_year = _get_student_active_year(student)
            
        # Get all students in the same class
        same_class_students = StudentEnrollment.objects.filter(
            grade=enrollment.grade,
            section=enrollment.section,
            status='ACTIVE'
        ).values_list('student_id', flat=True)
        
        # Get all report cards for students in this class
        report_cards = ReportCard.objects.filter(
            student_id__in=same_class_students,
            academic_year=academic_year,
            term_name=academic_year
        ).order_by('-percentage', 'student__user__first_name')
        
        # Assign ranks
        rank = 1
        for report_card in report_cards:
            if report_card.rank != rank:
                report_card.rank = rank
                report_card.save(update_fields=['rank'])
            rank += 1
            
    except Exception as e:
        print(f"Error recalculating rankings: {e}")


@receiver(post_save, sender=Result)
def result_saved(sender, instance, created, **kwargs):
    """
    Automatically recalculate report card when result is saved
    Only trigger for APPROVED or LOCKED results
    """
    if instance.moderation_status in ['APPROVED', 'LOCKED']:
        recalculate_student_report_card(instance.student.id)


@receiver(post_delete, sender=Result)
def result_deleted(sender, instance, **kwargs):
    """
    Recalculate report card when a result is deleted
    """
    if instance.moderation_status in ['APPROVED', 'LOCKED']:
        recalculate_student_report_card(instance.student.id)


# --- INBOUND SYNC FROM ACADEMICS TO TEACHERS ---

def get_active_academic_year_code(school):
    """
    Retrieves the current active academic year for a school.
    Falls back to latest assignment or '2025-2026'.
    """
    try:
        from apps.enrollments.models_promotion import AcademicYear
        active_year = AcademicYear.objects.filter(school=school, status='ACTIVE').first()
        if active_year:
            return active_year.year_code
    except Exception:
        pass

    try:
        from apps.teachers.models import TeacherAssignment
        latest_ta = TeacherAssignment.objects.filter(school=school).order_by('-created_at').first()
        if latest_ta:
            return latest_ta.academic_year
    except Exception:
        pass

    return '2025-2026'


@receiver(pre_save, sender=Section)
def section_pre_save(sender, instance, **kwargs):
    if instance.id:
        try:
            old_instance = Section.objects.get(id=instance.id)
            instance._old_grade_name = old_instance.grade_config.grade_name
            instance._old_section_letter = old_instance.section_letter
            instance._old_class_teacher = old_instance.class_teacher
            instance._old_room_number = old_instance.room_number
        except Section.DoesNotExist:
            pass


@receiver(post_save, sender=Section)
def sync_section_to_teachers(sender, instance, created, **kwargs):
    # Prevent recursive signal loops
    if getattr(instance, '_syncing_from_teachers', False) or getattr(instance, '_syncing_to_teachers', False):
        return

    instance._syncing_to_teachers = True
    try:
        from apps.teachers.models import TeacherAssignment
        grade_name = instance.grade_config.grade_name
        section_letter = instance.section_letter
        school = instance.school
        academic_year = get_active_academic_year_code(school)
        
        old_grade_name = getattr(instance, '_old_grade_name', None)
        old_section_letter = getattr(instance, '_old_section_letter', None)
        
        # If the grade or section letter changed, handle student migration and old section recreation
        if (old_grade_name and old_grade_name != grade_name) or (old_section_letter and old_section_letter != section_letter):
            from apps.students.models import Student
            from apps.enrollments.models import StudentEnrollment
            
            # Find student IDs enrolled in the old class/section
            old_enrolled_student_ids = StudentEnrollment.objects.filter(
                school=school,
                grade=old_grade_name,
                section__iexact=old_section_letter,
                status='ACTIVE'
            ).values_list('student_id', flat=True)
            
            # Students currently pointing to this instance who are in that old enrollment list
            old_students = Student.objects.filter(
                current_section=instance,
                id__in=old_enrolled_student_ids
            )
            
            move_students = getattr(instance, '_move_students', False)
            
            if old_students.exists():
                if move_students:
                    # Update their active enrollments to the new grade and section
                    StudentEnrollment.objects.filter(
                        student_id__in=old_students.values_list('id', flat=True),
                        academic_year=academic_year,
                        status='ACTIVE'
                    ).update(
                        grade=grade_name,
                        section=section_letter
                    )
                    # Point students to the new card
                    old_students.update(
                        current_section=instance,
                        grade_config=instance.grade_config
                    )
                else:
                    # Recreate a Section card for the old class and section
                    from apps.schools.models_programs import GradeConfiguration
                    old_grade_config = GradeConfiguration.objects.filter(
                        program__school=school,
                        grade_name=old_grade_name
                    ).first()
                    
                    if old_grade_config:
                        new_section, new_created = Section.objects.get_or_create(
                            school=school,
                            grade_config=old_grade_config,
                            section_letter=old_section_letter,
                            defaults={
                                'capacity': instance.capacity,
                                'room_number': getattr(instance, '_old_room_number', instance.room_number),
                                'class_teacher': getattr(instance, '_old_class_teacher', None),
                                'is_active': True
                            }
                        )
                        # Update students to point to this new section card
                        old_students.update(
                            current_section=new_section,
                            grade_config=old_grade_config
                        )
            else:
                # If no students are in the old class/section, deactivate its class teacher assignment
                if getattr(instance, '_old_class_teacher', None):
                    TeacherAssignment.objects.filter(
                        school=school,
                        teacher=instance._old_class_teacher,
                        role='CLASS_TEACHER',
                        grade__iexact=old_grade_name,
                        section__iexact=old_section_letter,
                        academic_year=academic_year,
                        is_active=True
                    ).update(is_active=False)
                    
            # For any students pointing to this instance who do NOT belong to the new class/section either,
            # clear their current_section
            new_enrolled_student_ids = StudentEnrollment.objects.filter(
                school=school,
                grade=grade_name,
                section__iexact=section_letter,
                status='ACTIVE'
            ).values_list('student_id', flat=True)
            
            Student.objects.filter(current_section=instance).exclude(id__in=new_enrolled_student_ids).update(current_section=None)

        # Always auto-link active students whose enrollment matches this new/updated section card
        from apps.enrollments.models import StudentEnrollment
        from apps.students.models import Student
        active_student_ids = StudentEnrollment.objects.filter(
            school=school,
            grade=grade_name,
            section__iexact=section_letter,
            status='ACTIVE'
        ).values_list('student_id', flat=True)
        
        if active_student_ids:
            Student.objects.filter(id__in=active_student_ids).update(
                current_section=instance,
                grade_config=instance.grade_config
            )
        
        if instance.class_teacher:
            # Check if there is an active TeacherAssignment for this class teacher
            assignment = TeacherAssignment.objects.filter(
                school=school,
                teacher=instance.class_teacher,
                role='CLASS_TEACHER',
                grade__iexact=grade_name,
                section__iexact=section_letter,
                academic_year=academic_year
            ).first()
            
            if assignment:
                if not assignment.is_active:
                    assignment._syncing_from_academics = True
                    assignment.is_active = True
                    assignment.save(update_fields=['is_active'])
            else:
                # Create a new active assignment
                TeacherAssignment.objects.create(
                    school=school,
                    teacher=instance.class_teacher,
                    role='CLASS_TEACHER',
                    grade=grade_name,
                    section=section_letter,
                    academic_year=academic_year,
                    is_active=True
                )
            
            # Deactivate all OTHER active class teacher assignments for this section
            other_assignments = TeacherAssignment.objects.filter(
                school=school,
                role='CLASS_TEACHER',
                grade__iexact=grade_name,
                section__iexact=section_letter,
                academic_year=academic_year,
                is_active=True
            ).exclude(teacher=instance.class_teacher)
            
            for oa in other_assignments:
                oa._syncing_from_academics = True
                oa.is_active = False
                oa.save(update_fields=['is_active'])
        else:
            # class_teacher is None, so deactivate all active class teacher assignments for this section
            assignments = TeacherAssignment.objects.filter(
                school=school,
                role='CLASS_TEACHER',
                grade__iexact=grade_name,
                section__iexact=section_letter,
                academic_year=academic_year,
                is_active=True
            )
            for a in assignments:
                a._syncing_from_academics = True
                a.is_active = False
                a.save(update_fields=['is_active'])
    finally:
        if hasattr(instance, '_syncing_to_teachers'):
            del instance._syncing_to_teachers


@receiver(post_save, sender=SubjectMapping)
def sync_subject_mapping_to_teachers(sender, instance, created, **kwargs):
    if getattr(instance, '_syncing_from_teachers', False) or getattr(instance, '_syncing_to_teachers', False):
        return

    instance._syncing_to_teachers = True
    try:
        from apps.teachers.models import TeacherAssignment
        grade_name = instance.section.grade_config.grade_name
        section_letter = instance.section.section_letter
        subject_name = instance.subject.name
        school = instance.school
        academic_year = get_active_academic_year_code(school)
        
        if instance.teacher:
            # Check if there is an active TeacherAssignment for this teacher
            assignment = TeacherAssignment.objects.filter(
                school=school,
                teacher=instance.teacher,
                role='SUBJECT_TEACHER',
                grade__iexact=grade_name,
                section__iexact=section_letter,
                subject__iexact=subject_name,
                academic_year=academic_year
            ).first()
            
            if assignment:
                if not assignment.is_active:
                    assignment._syncing_from_academics = True
                    assignment.is_active = True
                    assignment.save(update_fields=['is_active'])
            else:
                TeacherAssignment.objects.create(
                    school=school,
                    teacher=instance.teacher,
                    role='SUBJECT_TEACHER',
                    grade=grade_name,
                    section=section_letter,
                    subject=subject_name,
                    academic_year=academic_year,
                    is_active=True
                )
        else:
            # If teacher is None, deactivate active assignments for that section & subject.
            assignments = TeacherAssignment.objects.filter(
                school=school,
                role='SUBJECT_TEACHER',
                grade__iexact=grade_name,
                section__iexact=section_letter,
                subject__iexact=subject_name,
                is_active=True
            )
            for a in assignments:
                a._syncing_from_academics = True
                a.is_active = False
                a.save(update_fields=['is_active'])
    finally:
        if hasattr(instance, '_syncing_to_teachers'):
            del instance._syncing_to_teachers



@receiver(post_delete, sender=Section)
def sync_section_delete_to_teachers(sender, instance, **kwargs):
    if getattr(instance, '_syncing_from_teachers', False) or getattr(instance, '_syncing_to_teachers', False):
        return

    instance._syncing_to_teachers = True
    try:
        from apps.teachers.models import TeacherAssignment
        grade_name = instance.grade_config.grade_name
        section_letter = instance.section_letter
        school = instance.school
        academic_year = get_active_academic_year_code(school)
        
        # Delete class teacher assignments to strip off the class teacher role/assignment
        TeacherAssignment.objects.filter(
            school=school,
            role='CLASS_TEACHER',
            grade__iexact=grade_name,
            section__iexact=section_letter,
            academic_year=academic_year
        ).delete()
    finally:
        if hasattr(instance, '_syncing_to_teachers'):
            del instance._syncing_to_teachers


@receiver(post_delete, sender=SubjectMapping)
def sync_subject_mapping_delete_to_teachers(sender, instance, **kwargs):
    if getattr(instance, '_syncing_from_teachers', False) or getattr(instance, '_syncing_to_teachers', False):
        return

    instance._syncing_to_teachers = True
    try:
        from apps.teachers.models import TeacherAssignment
        grade_name = instance.section.grade_config.grade_name
        section_letter = instance.section.section_letter
        subject_name = instance.subject.name
        school = instance.school
        academic_year = get_active_academic_year_code(school)
        
        # Deactivate subject teacher assignments
        TeacherAssignment.objects.filter(
            school=school,
            role='SUBJECT_TEACHER',
            grade__iexact=grade_name,
            section__iexact=section_letter,
            subject__iexact=subject_name,
            academic_year=academic_year,
            is_active=True
        ).update(is_active=False)
    finally:
        if hasattr(instance, '_syncing_to_teachers'):
            del instance._syncing_to_teachers
