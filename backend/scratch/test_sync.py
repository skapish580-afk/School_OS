import os
import sys
import django
from django.core.exceptions import ValidationError
from rest_framework import serializers

# Add backend directory to sys.path
sys.path.append(r'C:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models import School
from apps.teachers.models import Teacher, TeacherAssignment
from apps.academics.models import Section, Subject, SubjectMapping
from apps.enrollments.models_promotion import AcademicYear

def test_sync_and_constraints():
    print("=== STARTING SYNC & CONSTRAINT TESTS ===")
    
    # 1. Fetch school, teachers, section, and subject
    school = School.objects.first()
    if not school:
        print("Error: No school found in DB.")
        return
        
    print(f"Using School: {school.name} (ID: {school.id})")
    
    teachers = Teacher.objects.filter(school_associations__school=school)[:2]
    if len(teachers) < 2:
        print(f"Error: Need at least 2 teachers in school to perform sync tests. Found: {len(teachers)}")
        return
        
    t1, t2 = teachers[0], teachers[1]
    print(f"Teacher 1: {t1.user.full_name} (ID: {t1.id})")
    print(f"Teacher 2: {t2.user.full_name} (ID: {t2.id})")
    
    section = Section.objects.filter(school=school).first()
    if not section:
        print("Error: No section found in DB.")
        return
        
    print(f"Using Section: {section.full_name} (ID: {section.id}, Current Class Teacher: {section.class_teacher})")
    
    # Ensure there is an active AcademicYear config, or create one for 2025-2026
    ay, created = AcademicYear.objects.get_or_create(
        school=school,
        year_code='2025-2026',
        defaults={
            'start_date': '2025-04-01',
            'end_date': '2026-03-31',
            'status': 'ACTIVE'
        }
    )
    if not created and ay.status != 'ACTIVE':
        ay.status = 'ACTIVE'
        ay.save()
    
    print(f"Academic Year 2025-2026 status: {ay.status}")

    # Make sure we clean up any pre-existing class teacher assignments for this section to start clean
    TeacherAssignment.objects.filter(
        school=school,
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        role='CLASS_TEACHER',
        academic_year='2025-2026'
    ).delete()
    
    section.class_teacher = None
    section.save()

    print("\n--- TEST 1: Constraint Verification (Serializers & Model Validation) ---")
    
    # Create first class teacher assignment
    ta1 = TeacherAssignment.objects.create(
        school=school,
        teacher=t1,
        role='CLASS_TEACHER',
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        academic_year='2025-2026',
        is_active=True
    )
    print("First Class Teacher assignment created successfully.")
    
    # Re-fetch Section and verify class_teacher was updated to t1 via signals
    section.refresh_from_db()
    print(f"Section.class_teacher after first assignment: {section.class_teacher} (Expected: {t1})")
    assert section.class_teacher == t1, "Section class teacher should be synced to t1!"

    # Try creating second class teacher assignment for same grade/section/academic_year
    try:
        ta2 = TeacherAssignment(
            school=school,
            teacher=t2,
            role='CLASS_TEACHER',
            grade=section.grade_config.grade_name,
            section=section.section_letter,
            academic_year='2025-2026',
            is_active=True
        )
        ta2.clean()  # Model-level validation
        print("FAIL: Model-level validation did not catch duplicate class teacher assignment.")
    except ValidationError as e:
        print(f"SUCCESS: Model validation caught duplicate: {e}")

    # Verify serializer-level validation
    from apps.teachers.serializers import TeacherAssignmentSerializer
    serializer = TeacherAssignmentSerializer(data={
        'teacher': str(t2.id),
        'role': 'CLASS_TEACHER',
        'grade': section.grade_config.grade_name,
        'section': section.section_letter,
        'academic_year': '2025-2026',
        'is_active': True
    })
    # Set school in serializer validate context
    class DummyRequest:
        def __init__(self, user):
            self.user = user
    
    # Find a user representing platform admin or mock school setting
    from apps.accounts.models import User
    admin_user = User.objects.filter(school=school).first()
    if not admin_user:
        admin_user = User.objects.first()
    
    serializer.context['request'] = DummyRequest(admin_user)
    
    if serializer.is_valid():
        print("FAIL: Serializer validation did not catch duplicate assignment.")
    else:
        print(f"SUCCESS: Serializer validation caught duplicate: {serializer.errors}")

    print("\n--- TEST 2: Assign Class Teacher to different Academic Year is allowed ---")
    try:
        # Create class teacher for next academic year
        ta_next = TeacherAssignment.objects.create(
            school=school,
            teacher=t2,
            role='CLASS_TEACHER',
            grade=section.grade_config.grade_name,
            section=section.section_letter,
            academic_year='2026-2027',
            is_active=True
        )
        print("SUCCESS: Setting class teacher for a different academic year (2026-2027) is allowed!")
        
        # Verify it did NOT overwrite Section.class_teacher since Section represents 2025-2026 (active year)
        section.refresh_from_db()
        print(f"Section.class_teacher remains: {section.class_teacher} (Expected: {t1})")
        assert section.class_teacher == t1, "Section class teacher should still be t1!"
        
        ta_next.delete()
    except Exception as e:
        print(f"FAIL: Failed setting class teacher for next academic year: {e}")

    print("\n--- TEST 3: Deactivating Assignment clears class teacher ---")
    ta1.is_active = False
    ta1.save()
    section.refresh_from_db()
    print(f"Section.class_teacher after deactivating assignment: {section.class_teacher} (Expected: None)")
    assert section.class_teacher is None, "Section class teacher should be cleared!"

    print("\n--- TEST 4: Direct Section updates sync back to TeacherAssignment ---")
    # Setting class teacher directly in Section
    section.class_teacher = t2
    section.save()
    
    # Verify TeacherAssignment was created/activated for t2
    ta2_db = TeacherAssignment.objects.filter(
        school=school,
        teacher=t2,
        role='CLASS_TEACHER',
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        academic_year='2025-2026',
        is_active=True
    ).first()
    print(f"TeacherAssignment for t2 found: {ta2_db} (Expected: Active assignment)")
    assert ta2_db is not None, "TeacherAssignment should have been created/activated!"

    # Verify ta1 (t1) is inactive
    ta1_db = TeacherAssignment.objects.get(id=ta1.id)
    print(f"t1 assignment is_active: {ta1_db.is_active} (Expected: False)")
    assert not ta1_db.is_active, "t1 assignment should be inactive!"

    print("\n--- TEST 5: Subject Teacher synchronization ---")
    # Let's fetch or create a subject
    subject = Subject.objects.filter(school=school).first()
    if not subject:
        subject = Subject.objects.create(school=school, name="Science", code="SCI")
    print(f"Using Subject: {subject.name}")

    # Remove any existing subject assignments or mappings to start clean
    TeacherAssignment.objects.filter(
        school=school,
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        subject=subject.name,
        role='SUBJECT_TEACHER'
    ).delete()
    SubjectMapping.objects.filter(school=school, section=section, subject=subject).delete()

    # Create subject assignment
    ta_sub = TeacherAssignment.objects.create(
        school=school,
        teacher=t1,
        role='SUBJECT_TEACHER',
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        subject=subject.name,
        academic_year='2025-2026',
        is_active=True
    )
    
    # Verify SubjectMapping teacher was updated to t1
    mapping = SubjectMapping.objects.filter(school=school, section=section, subject=subject).first()
    print(f"SubjectMapping teacher: {mapping.teacher if mapping else 'None'} (Expected: {t1})")
    assert mapping is not None and mapping.teacher == t1, "SubjectMapping teacher should be t1!"

    # Update SubjectMapping teacher directly
    mapping.teacher = t2
    mapping.save()

    # Verify assignment for t2 is active and assignment for t1 is inactive
    ta_sub_t2 = TeacherAssignment.objects.filter(
        school=school,
        teacher=t2,
        role='SUBJECT_TEACHER',
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        subject=subject.name,
        academic_year='2025-2026',
        is_active=True
    ).first()
    print(f"t2 subject assignment: {ta_sub_t2} (Expected: Active)")
    assert ta_sub_t2 is not None, "Subject assignment for t2 should have been created/activated!"

    ta_sub_t1 = TeacherAssignment.objects.get(id=ta_sub.id)
    print(f"t1 subject assignment is_active: {ta_sub_t1.is_active} (Expected: False)")
    assert not ta_sub_t1.is_active, "t1 subject assignment should be deactivated!"

    # Clean up test modifications
    TeacherAssignment.objects.filter(
        school=school,
        grade=section.grade_config.grade_name,
        section=section.section_letter,
        academic_year='2025-2026'
    ).delete()
    SubjectMapping.objects.filter(school=school, section=section, subject=subject).delete()
    section.class_teacher = None
    section.save()
    print("Cleanup completed.")
    print("=== ALL TESTS COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    test_sync_and_constraints()
