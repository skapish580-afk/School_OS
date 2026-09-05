from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.teachers.models import TeacherAssignment
from apps.academics.models import Section, Subject, SubjectMapping
from apps.accounts.permission_utils import clear_permission_cache

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
        latest_ta = TeacherAssignment.objects.filter(school=school).order_by('-created_at').first()
        if latest_ta and latest_ta.academic_year:
            return latest_ta.academic_year
    except Exception:
        pass

    return '2025-2026'

def find_matching_section(school, grade_str, section_letter):
    """
    Find section by school, matching grade (normalized) and section letter.
    """
    if not school or not grade_str or not section_letter:
        return None
    clean = str(grade_str).lower().replace('grade', '').replace('class', '').strip()
    sections = Section.objects.filter(school=school, section_letter__iexact=str(section_letter).strip())
    for sec in sections:
        if not sec.grade_config:
            continue
        g_clean = str(sec.grade_config.grade_name).lower().replace('grade', '').replace('class', '').strip()
        if g_clean == clean:
            return sec
    return None

@receiver(post_save, sender=TeacherAssignment)
def sync_assignment_to_academics(sender, instance, created, **kwargs):
    # Prevent recursive signal loops
    if getattr(instance, '_syncing_from_academics', False) or getattr(instance, '_syncing_to_academics', False):
        return

    # Invalidate permission cache for the teacher immediately
    if instance.teacher and getattr(instance.teacher, 'user', None):
        clear_permission_cache(instance.teacher.user, instance.school)

    instance._syncing_to_academics = True
    try:
        section = find_matching_section(instance.school, instance.grade, instance.section)
        
        if instance.role == 'CLASS_TEACHER':
            if section:
                if instance.is_active:
                    if section.class_teacher != instance.teacher:
                        section._syncing_from_teachers = True
                        section.class_teacher = instance.teacher
                        section.save(update_fields=['class_teacher'])
                else:
                    if section.class_teacher == instance.teacher:
                        section._syncing_from_teachers = True
                        section.class_teacher = None
                        section.save(update_fields=['class_teacher'])
                        
        elif instance.role == 'SUBJECT_TEACHER':
            if instance.subject:
                subject = Subject.objects.filter(
                    school=instance.school,
                    name__iexact=instance.subject.strip()
                ).first()
                
                if section and subject:
                    mapping, _ = SubjectMapping.objects.get_or_create(
                        school=instance.school,
                        section=section,
                        subject=subject
                    )
                    
                    if instance.is_active:
                        if mapping.teacher != instance.teacher:
                            mapping._syncing_from_teachers = True
                            mapping.teacher = instance.teacher
                            mapping.save(update_fields=['teacher'])
                    else:
                        if mapping.teacher == instance.teacher:
                            mapping._syncing_from_teachers = True
                            mapping.teacher = None
                            mapping.save(update_fields=['teacher'])
    finally:
        if hasattr(instance, '_syncing_to_academics'):
            del instance._syncing_to_academics

@receiver(post_delete, sender=TeacherAssignment)
def sync_assignment_delete_to_academics(sender, instance, **kwargs):
    if getattr(instance, '_syncing_from_academics', False) or getattr(instance, '_syncing_to_academics', False):
        return

    # Invalidate permission cache for the teacher immediately
    if instance.teacher and getattr(instance.teacher, 'user', None):
        clear_permission_cache(instance.teacher.user, instance.school)

    instance._syncing_to_academics = True
    try:
        section = find_matching_section(instance.school, instance.grade, instance.section)
        if instance.role == 'CLASS_TEACHER':
            if section and section.class_teacher == instance.teacher:
                section._syncing_from_teachers = True
                section.class_teacher = None
                section.save(update_fields=['class_teacher'])
                
        elif instance.role == 'SUBJECT_TEACHER':
            if instance.subject and section:
                subject = Subject.objects.filter(
                    school=instance.school,
                    name__iexact=instance.subject.strip()
                ).first()
                if subject:
                    mapping = SubjectMapping.objects.filter(
                        school=instance.school,
                        section=section,
                        subject=subject
                    ).first()
                    if mapping and mapping.teacher == instance.teacher:
                        mapping._syncing_from_teachers = True
                        mapping.teacher = None
                        mapping.save(update_fields=['teacher'])
    finally:
        if hasattr(instance, '_syncing_to_academics'):
            del instance._syncing_to_academics
