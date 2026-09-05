from django.db import models
import uuid

class TimelineMark(models.Model):
    """
    Timeline table recording every mark ever obtained by a student.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_global_id = models.CharField(max_length=50, db_index=True)
    grade = models.CharField(max_length=50)
    subject = models.CharField(max_length=100)
    exam_name = models.CharField(max_length=100)
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    total_marks = models.DecimalField(max_digits=6, decimal_places=2)
    passing_marks = models.DecimalField(max_digits=6, decimal_places=2)
    is_pass = models.BooleanField(default=False)
    is_absent = models.BooleanField(default=False)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    days_present = models.PositiveIntegerField(null=True, blank=True)
    total_days = models.PositiveIntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recorded_at']
        verbose_name = "Timeline Mark"
        verbose_name_plural = "Timeline Marks"

    def __str__(self):
        return f"{self.student_global_id} - {self.subject} ({self.exam_name}): {self.marks_obtained}/{self.total_marks}"


class TimelineRemark(models.Model):
    """
    Timeline table recording behavior, achievements, and karma scores.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_global_id = models.CharField(max_length=50, db_index=True)
    grade = models.CharField(max_length=50)
    record_type = models.CharField(max_length=50)  # "DISCIPLINE", "KARMA", "ACHIEVEMENT", "AWARD"
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    points = models.IntegerField(null=True, blank=True)  # positive/negative karma points
    teacher_name = models.CharField(max_length=200, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recorded_at']
        verbose_name = "Timeline Remark"
        verbose_name_plural = "Timeline Remarks"

    def __str__(self):
        return f"{self.student_global_id} - {self.record_type} ({self.title}) by {self.teacher_name}"


class TimelineHealth(models.Model):
    """
    Timeline table recording student infirmary visits.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_global_id = models.CharField(max_length=50, db_index=True)
    grade = models.CharField(max_length=20, null=True, blank=True)  # Grade config name when recorded
    visit_date = models.DateTimeField()
    symptom = models.CharField(max_length=200)
    treatment_given = models.TextField()
    sent_home = models.BooleanField(default=False)
    recorded_by = models.CharField(max_length=200)  # Name of nurse/recorder
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-visit_date']
        verbose_name = "Timeline Health Log"
        verbose_name_plural = "Timeline Health Logs"

    def __str__(self):
        return f"{self.student_global_id} - {self.symptom} on {self.visit_date.date()}"


class StudentEnrollmentArchive(models.Model):
    """
    Archive table recording students marked as Withdraw or Transfer.
    Stores SUID, status, school name, and full admission details/documents in JSON.

    IMPORTANT: This record is NEVER deleted when another school re-admits the student.
    Instead, re_admitted=True is set and the record remains as a permanent read-only
    historical ledger of the student's time at this school.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_global_id = models.CharField(max_length=50, db_index=True)
    status = models.CharField(max_length=20)  # "WITHDRAWN" or "TRANSFERRED" or "GRADUATED"
    school_name = models.CharField(max_length=200)
    admission_details = models.JSONField()  # Serialized profile details
    documents = models.JSONField()  # Serialized document metadata
    timeline_data = models.JSONField(default=dict, blank=True)  # Archived marks, remarks, and health records
    archived_at = models.DateTimeField(auto_now_add=True)

    # Transfer event timestamps
    transferred_date = models.DateField(null=True, blank=True)  # date school explicitly marked student as transferred

    # Re-admission tracking (filled when another school admits this student)
    re_admitted = models.BooleanField(default=False)
    re_admitted_at = models.DateField(null=True, blank=True)
    re_admitted_to_school_name = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-archived_at']
        verbose_name = "Student Enrollment Archive Record"
        verbose_name_plural = "Student Enrollment Archive Records"

    def __str__(self):
        return f"Archive: {self.student_global_id} - {self.status} ({self.school_name})"
