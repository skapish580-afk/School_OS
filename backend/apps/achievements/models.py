from django.db import models
from apps.enrollments.models import StudentEnrollment
from apps.students.models import Student, StudentHistory
import uuid

class Achievement(models.Model):
    """
    Positive recognition: Awards, Sports Medals, Olympiad Ranks.
    """
    CATEGORY_CHOICES = [
        ('ACADEMIC', 'Academic'),
        ('SPORTS', 'Sports'),
        ('CULTURAL', 'Cultural/Arts'),
        ('LEADERSHIP', 'Leadership'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentEnrollment, on_delete=models.CASCADE, related_name='achievements')
    
    title = models.CharField(max_length=200) # e.g. "Gold Medal - 100m Dash"
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date_awarded = models.DateField()
    
    certificate_image = models.ImageField(upload_to='achievements/', blank=True, null=True)

    def __str__(self):
        return f"{self.title} - {self.student.student.user.full_name}"


class StudentYearlyAward(models.Model):
    """
    Awards/Achievements/Certificates linked to a specific academic year.
    This is the USP - tracking student achievements year by year.
    """
    AWARD_TYPE_CHOICES = [
        ('CERTIFICATE', 'Certificate'),
        ('AWARD', 'Award'),
        ('MEDAL', 'Medal'),
        ('TROPHY', 'Trophy'),
        ('CASH_PRIZE', 'Cash Prize'),
        ('SCHOLARSHIP', 'Scholarship'),
        ('APPRECIATION', 'Appreciation'),
        ('OTHER', 'Other'),
    ]
    
    CATEGORY_CHOICES = [
        ('ACADEMIC', 'Academic Excellence'),
        ('SPORTS', 'Sports'),
        ('CULTURAL', 'Cultural/Arts'),
        ('OLYMPIAD', 'Olympiad/Competition'),
        ('LEADERSHIP', 'Leadership'),
        ('ATTENDANCE', 'Perfect Attendance'),
        ('DISCIPLINE', 'Good Conduct'),
        ('CREATIVITY', 'Creativity/Innovation'),
        ('COMMUNITY', 'Community Service'),
        ('OTHER', 'Other'),
    ]
    
    LEVEL_CHOICES = [
        ('CLASS', 'Class Level'),
        ('SCHOOL', 'School Level'),
        ('INTER_SCHOOL', 'Inter-School'),
        ('DISTRICT', 'District Level'),
        ('STATE', 'State Level'),
        ('NATIONAL', 'National Level'),
        ('INTERNATIONAL', 'International'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to student and history
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='yearly_awards')
    student_history = models.ForeignKey(StudentHistory, on_delete=models.CASCADE, related_name='awards', null=True, blank=True)
    academic_year = models.CharField(max_length=20, help_text="e.g. 2024-2025")
    
    # Award details
    title = models.CharField(max_length=300)  # "1st Place - Inter-School Science Fair"
    description = models.TextField(blank=True)
    award_type = models.CharField(max_length=20, choices=AWARD_TYPE_CHOICES)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='SCHOOL')
    
    # For competitions
    position = models.CharField(max_length=50, blank=True, null=True)  # "1st", "Gold", "Winner"
    
    # Cash prize if any
    cash_prize_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cash_prize_currency = models.CharField(max_length=10, default='INR')
    
    # Certificate/Evidence
    certificate_image = models.ImageField(upload_to='yearly_awards/', blank=True, null=True)
    
    # Event details
    event_name = models.CharField(max_length=200, blank=True, null=True)
    event_date = models.DateField(null=True, blank=True)
    awarded_by = models.CharField(max_length=200, blank=True, null=True)  # "Principal", "District Collector"
    
    # Audit
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='awards_created')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-event_date', '-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.student.full_name_display} ({self.academic_year})"


class StudentArtifact(models.Model):
    """
    The 'Memory' of the student: Essays, Poems, Drawings, Projects.
    This builds their creative portfolio over time.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentEnrollment, on_delete=models.CASCADE, related_name='artifacts')
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='artifacts/') # Can be PDF, JPG, Doc
    upload_date = models.DateField(auto_now_add=True)
    
    is_public = models.BooleanField(default=False, help_text="Can this be shown on public profile?")

    def __str__(self):
        return self.title

class DisciplineRecord(models.Model):
    """
    Negative records: Suspensions, Warnings.
    Access to this should be STRICTLY controlled.
    """
    SEVERITY_CHOICES = [
        ('LOW', 'Verbal Warning'),
        ('MEDIUM', 'Written Warning'),
        ('HIGH', 'Suspension'),
        ('CRITICAL', 'Expulsion'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(StudentEnrollment, on_delete=models.CASCADE, related_name='discipline_records')
    
    title = models.CharField(max_length=200) # e.g. "Fought in cafeteria"
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    date_incident = models.DateField()
    
    action_taken = models.TextField(help_text="e.g. Parents called, 2 day suspension")

    def __str__(self):
        return f"{self.severity}: {self.title}"