from django.db import models
from django.conf import settings
import uuid
from apps.schools.models import School


class OnboardingChecklist(models.Model):
    """
    Onboarding Checklist - STEP 11 of Onboarding
    
    Tracks completion of each onboarding step and go-live requirements.
    System-controlled checklist to ensure schools are properly set up.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='onboarding_checklist')
    
    # Step Completion Tracking (Steps 1-10)
    step_1_school_identity = models.BooleanField(default=False, help_text="School identity configured")
    step_2_owner_admin = models.BooleanField(default=False, help_text="Owner & super admin created")
    step_3_campus = models.BooleanField(default=False, help_text="Campus setup completed")
    step_4_programs = models.BooleanField(default=False, help_text="Academic programs configured")
    step_5_curriculum = models.BooleanField(default=False, help_text="Curriculum & subjects mapped")
    step_6_features = models.BooleanField(default=False, help_text="Features enabled")
    step_7_fees = models.BooleanField(default=False, help_text="Fees & payment configured")
    step_8_rbac = models.BooleanField(default=False, help_text="Roles & permissions set up")
    step_9_branding = models.BooleanField(default=False, help_text="Branding & communication configured")
    step_10_legal = models.BooleanField(default=False, help_text="Legal & compliance completed")
    
    # Go-Live Checklist (Step 11)
    admin_created = models.BooleanField(default=False, help_text="At least one admin created")
    programs_created = models.BooleanField(default=False, help_text="At least one program created")
    grades_added = models.BooleanField(default=False, help_text="Grades added to programs")
    teachers_added = models.BooleanField(default=False, help_text="At least one teacher added")
    students_uploaded = models.BooleanField(default=False, help_text="Students uploaded")
    fees_configured = models.BooleanField(default=False, help_text="Fee structure configured")
    
    # Completion Tracking
    is_complete = models.BooleanField(default=False, help_text="All steps completed")
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_onboardings'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Onboarding Checklist - {self.school.display_name}"
    
    @property
    def completion_percentage(self):
        """Calculate completion percentage based on all steps"""
        total_steps = 16  # 10 wizard steps + 6 go-live items
        completed_steps = sum([
            self.step_1_school_identity,
            self.step_2_owner_admin,
            self.step_3_campus,
            self.step_4_programs,
            self.step_5_curriculum,
            self.step_6_features,
            self.step_7_fees,
            self.step_8_rbac,
            self.step_9_branding,
            self.step_10_legal,
            self.admin_created,
            self.programs_created,
            self.grades_added,
            self.teachers_added,
            self.students_uploaded,
            self.fees_configured,
        ])
        return round((completed_steps / total_steps) * 100)
    
    @property
    def mandatory_steps_complete(self):
        """Check if all mandatory steps are complete"""
        return all([
            self.step_1_school_identity,
            self.step_2_owner_admin,
            self.step_4_programs,
            self.step_6_features,
            self.step_10_legal,
            self.admin_created,
            self.programs_created,
            self.grades_added,
        ])
    
    def mark_complete(self, user=None):
        """Mark onboarding as complete"""
        from django.utils import timezone
        self.is_complete = True
        self.completed_at = timezone.now()
        if user:
            self.completed_by = user
        self.save()
        
        # Update school status to LIVE
        self.school.onboarding_status = 'LIVE'
        self.school.save()
    
    class Meta:
        verbose_name = "Onboarding Checklist"
        verbose_name_plural = "Onboarding Checklists"
