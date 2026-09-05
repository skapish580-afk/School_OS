from django.db import models
import uuid


class SchoolTenure(models.Model):
    """
    Permanent, immutable record of a student's time at ONE school.
    Each time a student leaves a school (transfer, withdrawal, graduation),
    a frozen snapshot of ALL their records at that school is stored here.
    This record is NEVER deleted — it is the student's academic passport.

    When School2 admits the student, a new SchoolTenure is created for School2.
    School1's tenure snapshot remains frozen and read-only forever.
    School2's snapshot is only populated when School2 archives the student.
    """

    STATUS_CHOICES = [
        ('ACTIVE', 'Currently Enrolled'),
        ('TRANSFERRED', 'Transferred Out'),
        ('WITHDRAWN', 'Withdrawn'),
        ('GRADUATED', 'Graduated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Cross-school identifier — the SUID never changes
    student_global_id = models.CharField(max_length=50, db_index=True)

    # School reference — name snapshot survives school deletion
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='student_tenures'
    )
    school_name = models.CharField(max_length=200)  # immutable snapshot

    # Timeline at this school
    admitted_date = models.DateField()
    transferred_date = models.DateField(null=True, blank=True)  # date marked transferred by this school
    grade_from = models.CharField(max_length=20, blank=True)     # first grade at this school
    grade_to = models.CharField(max_length=20, blank=True)       # last grade at this school

    # Status of this tenure
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    # Which school admitted the student next (only filled when status != ACTIVE)
    admitted_to_school_name = models.CharField(max_length=200, blank=True)
    admitted_to_date = models.DateField(null=True, blank=True)

    # Frozen snapshot — only populated when student leaves this school
    # Contains: marks, remarks, health, history, report_cards (identical structure to archive.timeline_data)
    timeline_snapshot = models.JSONField(null=True, blank=True)

    # Full profile snapshot at time of leaving
    profile_snapshot = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['admitted_date']
        verbose_name = 'School Tenure'
        verbose_name_plural = 'School Tenures'

    def __str__(self):
        return f"{self.student_global_id} @ {self.school_name} ({self.admitted_date} → {self.transferred_date or 'present'})"
