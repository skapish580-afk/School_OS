from collections import defaultdict
from django.db import transaction
from apps.academics.models import Section
from apps.schools.models_programs import GradeConfiguration
from .models import PromotionBatch, PromotionAssignment, PromotionAudit, AcademicHistory


def _infer_next_class_name(current_class: str):
    # Try to infer numeric grade and increment; fallback to append ' (next)'
    try:
        # Extract first integer in the string
        import re
        m = re.search(r"(\d+)", current_class)
        if m:
            num = int(m.group(1))
            return str(num + 1)
    except Exception:
        pass
    return current_class + ' (next)'


def generate_promotion_suggestions(batch: PromotionBatch, tie_break='rank_asc'):
    """Generate suggested section allocations for a PromotionBatch.

    Strategy:
    - Group assignments by target `promoted_to_class` (infer if missing).
    - For each target class, order students by `rank` (ascending) then by id.
    - Fill available sections for the school's grade in capacity order.
    - Mark assigned students with `promoted_to_division` and status 'SUGGESTED'.
    - Return list of updated assignments.
    """
    school = batch.school
    assignments = list(batch.assignments.select_related('student').all())

    # Build buckets: target_class -> list[PromotionAssignment]
    buckets = defaultdict(list)
    for a in assignments:
        target = a.promoted_to_class or _infer_next_class_name(a.current_class)
        buckets[target].append(a)

    updated = []

    for target_class, assns in buckets.items():
        # Try to locate Grade by grade_number or name
        grade_obj = None
        try:
            if target_class.isdigit():
                grade_obj = Grade.objects.filter(school=school, grade_number=int(target_class)).first()
            if not grade_obj:
                grade_obj = Grade.objects.filter(school=school, grade_name__icontains=target_class).first()
        except Exception:
            grade_obj = None

        # Gather target sections and available slots
        sections = []
        if grade_obj:
            sections = list(Section.objects.filter(school=school, grade=grade_obj, is_active=True))

        # Sort sections by remaining capacity descending
        sections = sorted(sections, key=lambda s: (s.capacity - s.student_count), reverse=True)

        # Sort students by rank
        assns_sorted = sorted(assns, key=lambda x: (x.rank if x.rank is not None else 999999, x.id))

        sec_idx = 0
        for a in assns_sorted:
            placed = False
            # try to find a section with space
            for sec in sections:
                if sec.student_count < sec.capacity:
                    a.promoted_to_division = sec.section_letter
                    a.promoted_to_class = grade_obj.grade_name if grade_obj else target_class
                    a.status = 'SUGGESTED'
                    a.save(update_fields=['promoted_to_division', 'promoted_to_class', 'status'])
                    updated.append(a)
                    placed = True
                    break
            if not placed:
                # no capacity: mark retained
                a.promoted_to_division = None
                a.status = 'RETAINED'
                a.save(update_fields=['promoted_to_division', 'status'])
                updated.append(a)

    # Record audit
    try:
        PromotionAudit.objects.create(batch=batch, action='GENERATE_SUGGESTIONS', payload={'count': len(updated)})
    except Exception:
        pass

    return updated


def commit_promotions(batch: PromotionBatch, user=None):
    """Commit promotions transactionally:
    - Create AcademicHistory entries for promoted students
    - Update PromotionAssignment statuses to 'PROMOTED'
    - Mark batch as COMMITTED
    - Create PromotionAudit
    """
    with transaction.atomic():
        assignments = list(batch.assignments.select_related('student').all())
        created_hist = []
        for a in assignments:
            if a.status in ('SUGGESTED', 'APPROVED') and a.promoted_to_class:
                # Archive current year
                AcademicHistory.objects.create(
                    student=a.student,
                    academic_year=batch.year_from,
                    class_name=a.current_class,
                    section=a.current_section,
                    summary=f"Promoted to {a.promoted_to_class}-{a.promoted_to_division}",
                )
                a.status = 'PROMOTED'
                a.save(update_fields=['status'])
                created_hist.append(a.student.id)

        batch.status = 'COMMITTED'
        batch.save(update_fields=['status'])

        PromotionAudit.objects.create(batch=batch, user=user, action='COMMIT', payload={'promoted_students': created_hist})

    return {'promoted_count': len(created_hist)}


def revert_promotions(batch: PromotionBatch, user=None):
    """Revert a committed promotion batch.

    - Deletes AcademicHistory entries created for this batch's `year_from` that match promotion summaries.
    - Sets PromotionAssignment statuses back to 'SUGGESTED' for further review.
    - Marks batch status back to 'REVIEW'.
    - Records a PromotionAudit entry.
    """
    if batch.status != 'COMMITTED':
        return {'reverted_count': 0, 'reason': 'Batch not committed'}

    with transaction.atomic():
        assignments = list(batch.assignments.select_related('student').all())
        reverted = []
        deleted_history = []
        for a in assignments:
            if a.status == 'PROMOTED':
                # find relevant AcademicHistory entries
                histories = AcademicHistory.objects.filter(student=a.student, academic_year=batch.year_from, summary__icontains='Promoted to')
                for h in histories:
                    deleted_history.append(h.id)
                histories.delete()

                a.status = 'SUGGESTED'
                a.save(update_fields=['status'])
                reverted.append(a.student.id)

        batch.status = 'REVIEW'
        batch.save(update_fields=['status'])

        PromotionAudit.objects.create(batch=batch, user=user, action='REVERT', payload={'reverted_students': reverted, 'deleted_history_ids': deleted_history})

    return {'reverted_count': len(reverted)}
