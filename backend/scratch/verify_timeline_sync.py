import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.students.models import Student, StudentDocument, Guardian
from apps.academics.models_result_system import StudentMark, SubjectExam
from apps.discipline.models import DisciplineRecord, KarmaActivity, StudentKarma
from apps.achievements.models import Achievement, StudentYearlyAward
from apps.health.models import ClinicVisit
from apps.enrollments.models import StudentEnrollment
from apps.timeline.models import TimelineMark, TimelineRemark, TimelineHealth, StudentEnrollmentArchive
from decimal import Decimal
from django.utils import timezone
# Get a student
student = Student.objects.first()
if not student:
    print("No students in database!")
    exit(1)
print(f"Found student: {student.full_name_display} (SUID: {student.suid})")
# Let's ensure the student has at least one document and guardian for testing the archive
guardian, _ = Guardian.objects.get_or_create(
    student=student,
    name="Test Guardian",
    relationship="FATHER",
    phone="1234567890",
    is_primary=True
)

# Test 1: ClinicVisit -> TimelineHealth
print("\n--- Test 1: ClinicVisit -> TimelineHealth ---")
visit = ClinicVisit.objects.create(
    student=student,
    nurse=student.user, # use student's user as nurse for test simplicity
    symptom="Test Symptom Headache",
    treatment_given="Test Treatment Paracetamol",
    sent_home=True
)
# Check
health_logs = TimelineHealth.objects.filter(student_global_id=student.suid, symptom="Test Symptom Headache")
if health_logs.exists():
    log = health_logs.first()
    print(f"SUCCESS: TimelineHealth created! Recorded by: {log.recorded_by}, Symptom: {log.symptom}")
else:
    print("FAILED: TimelineHealth not created.")

# Test 2: StudentMark -> TimelineMark
print("\n--- Test 2: StudentMark -> TimelineMark ---")
exam = SubjectExam.objects.first()
if not exam:
    try:
        from apps.academics.models import Subject
        from apps.schools.models_programs import GradeConfiguration
        from apps.academics.models_result_system import ExamTerm
        
        school = student.school
        grade = student.grade_config or GradeConfiguration.objects.filter(program__school=school).first()
        subject, _ = Subject.objects.get_or_create(
            school=school,
            name="Test Subject Science",
            code="TS-SCI",
            defaults={'is_active': True}
        )
        term, _ = ExamTerm.objects.get_or_create(
            school=school,
            term_name="Test Term 1",
            academic_year="2025-2026",
            defaults={
                'term_type': 'UNIT',
                'weightage_percentage': 20.00,
                'start_date': timezone.now().date(),
                'end_date': timezone.now().date(),
            }
        )
        exam = SubjectExam.objects.create(
            school=school,
            term=term,
            subject=subject,
            grade=grade,
            exam_date=timezone.now().date(),
            duration_minutes=60,
            total_marks=100.00,
            passing_marks=40.00
        )
    except Exception as e:
        print(f"Error creating test SubjectExam: {e}")

if exam:
    mark, _ = StudentMark.objects.update_or_create(
        exam=exam,
        student=student,
        defaults={
            'school': student.school,
            'marks_obtained': Decimal('85.00'),
            'is_absent': False
        }
    )
    # Check
    timeline_marks = TimelineMark.objects.filter(student_global_id=student.suid, subject=exam.subject.name)
    if timeline_marks.exists():
        tm = timeline_marks.first()
        print(f"SUCCESS: TimelineMark created! Subject: {tm.subject}, Marks: {tm.marks_obtained}/{tm.total_marks}")
    else:
        print("FAILED: TimelineMark not created.")
else:
    print("SKIP: Could not find or create SubjectExam to test StudentMark.")

# Test 3: DisciplineRecord -> TimelineRemark
print("\n--- Test 3: DisciplineRecord -> TimelineRemark ---")
discipline = DisciplineRecord.objects.create(
    student=student,
    reported_by=student.user,
    category="LATE",
    description="Test Late disruption",
    severity="LOW",
    points_deducted=5
)
# Check
discipline_remarks = TimelineRemark.objects.filter(student_global_id=student.suid, record_type="DISCIPLINE", title="LATE")
if discipline_remarks.exists():
    rem = discipline_remarks.first()
    print(f"SUCCESS: TimelineRemark (DISCIPLINE) created! Title: {rem.title}, Points: {rem.points}")
else:
    print("FAILED: TimelineRemark (DISCIPLINE) not created.")

# Test 4: KarmaActivity -> TimelineRemark
print("\n--- Test 4: KarmaActivity -> TimelineRemark ---")
karma_act = KarmaActivity.objects.create(
    student=student,
    awarded_by=student.user,
    title="Helping peer",
    points=10,
    description="Test helping peer with math homework"
)
# Check
karma_remarks = TimelineRemark.objects.filter(student_global_id=student.suid, record_type="KARMA", title="Helping peer")
if karma_remarks.exists():
    rem = karma_remarks.first()
    print(f"SUCCESS: TimelineRemark (KARMA) created! Title: {rem.title}, Points: {rem.points}")
else:
    print("FAILED: TimelineRemark (KARMA) not created.")

# Test 5: Achievement -> TimelineRemark
print("\n--- Test 5: Achievement -> TimelineRemark ---")
enrollment = StudentEnrollment.objects.filter(student=student).first()
if enrollment:
    achievement = Achievement.objects.create(
        student=enrollment,
        title="Science Olympiad Gold",
        description="Won gold in district science olympiad",
        category="ACADEMIC",
        date_awarded=timezone.now().date()
    )
    # Check
    ach_remarks = TimelineRemark.objects.filter(student_global_id=student.suid, record_type="ACHIEVEMENT", title="Science Olympiad Gold")
    if ach_remarks.exists():
        rem = ach_remarks.first()
        print(f"SUCCESS: TimelineRemark (ACHIEVEMENT) created! Title: {rem.title}")
    else:
        print("FAILED: TimelineRemark (ACHIEVEMENT) not created.")
else:
    print("SKIP: No enrollment found for student to test Achievement.")

# Test 6: StudentEnrollment status change -> StudentEnrollmentArchive
print("\n--- Test 6: StudentEnrollment status change -> StudentEnrollmentArchive ---")
if enrollment:
    # Save original status to restore later
    orig_status = enrollment.status
    print(f"Original enrollment status: {orig_status}")
    print("Setting enrollment status to WITHDRAWN...")
    enrollment.status = "WITHDRAWN"
    enrollment.save()
    
    # Check Student status was synced
    student.refresh_from_db()
    print(f"Synced Student status: {student.status}")
    if student.status == "WITHDRAWN":
        print("SUCCESS: Student status synced to WITHDRAWN!")
    else:
        print(f"FAILED: Student status is {student.status}, expected WITHDRAWN.")
        
    # Check Archive was created
    archives = StudentEnrollmentArchive.objects.filter(student_global_id=student.suid, status="WITHDRAWN")
    if archives.exists():
        arch = archives.first()
        print(f"SUCCESS: StudentEnrollmentArchive created! School: {arch.school_name}, Status: {arch.status}")
        print("Archived profile SUID:", arch.admission_details.get('suid'))
        print("Archived guardians count:", len(arch.admission_details.get('guardians', [])))
        
        # Check timeline_data is present in the archive
        timeline_data = arch.timeline_data or {}
        archived_marks = timeline_data.get('marks', [])
        archived_remarks = timeline_data.get('remarks', [])
        archived_health = timeline_data.get('health', [])
        
        print(f"Archived marks count: {len(archived_marks)}")
        print(f"Archived remarks count: {len(archived_remarks)}")
        print(f"Archived health count: {len(archived_health)}")
        
        if len(archived_marks) > 0 and len(archived_remarks) > 0 and len(archived_health) > 0:
            print("SUCCESS: Timeline data successfully archived inside JSONField!")
        else:
            print("FAILED: Timeline data not found or empty in archive JSONField.")
            
        # Verify active tables are cleared (moved, not copied)
        active_marks_count = TimelineMark.objects.filter(student_global_id=student.suid).count()
        active_remarks_count = TimelineRemark.objects.filter(student_global_id=student.suid).count()
        active_health_count = TimelineHealth.objects.filter(student_global_id=student.suid).count()
        
        print(f"Active marks count remaining: {active_marks_count}")
        print(f"Active remarks count remaining: {active_remarks_count}")
        print(f"Active health count remaining: {active_health_count}")
        
        if active_marks_count == 0 and active_remarks_count == 0 and active_health_count == 0:
            print("SUCCESS: Live timeline records deleted from active database tables (moved successfully)!")
        else:
            print("FAILED: Live timeline records still present in active tables.")
    else:
        print("FAILED: StudentEnrollmentArchive not created.")
        
    # Restore original status
    print("Restoring original enrollment status...")
    enrollment.status = orig_status
    enrollment.save()
    student.status = "ACTIVE"
    student.save()
else:
    print("SKIP: No enrollment found to test archiving.")
