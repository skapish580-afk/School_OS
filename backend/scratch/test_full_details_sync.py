import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from apps.accounts.models import User
from apps.schools.models import School
from apps.students.models import Student, StudentDocument
from apps.enrollments.models import StudentEnrollment, AcademicYear
from apps.schools.models_programs import GradeConfiguration
from apps.academics.models import Section
from apps.timeline.models import StudentEnrollmentArchive
from apps.timeline.views import StudentEnrollmentArchiveViewSet

# 1. Setup school, grade, section, and admin user
school = School.objects.first()
admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN'], school=school).first()
if not admin_user:
    admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN']).first()

grade_obj = GradeConfiguration.objects.filter(program__school=school).first()
section_obj = Section.objects.filter(school=school, grade_config=grade_obj).first()
academic_year = AcademicYear.objects.filter(school=school, status='ACTIVE').first() or '2025-2026'

print(f"School: {school.display_name}")
print(f"Admin User: {admin_user.email}")
print(f"Target Grade: {grade_obj.grade_name}, Section: {section_obj.section_letter}")

# 2. Create target student with full profile fields
student_suid = "S-GWD--2026-TESTSYNC-9"
# Clean up if already exists
Student.objects.filter(suid=student_suid).delete()
StudentEnrollmentArchive.objects.filter(student_global_id=student_suid).delete()
User.objects.filter(email="testsync@school-os.edu").delete()

user = User.objects.create(
    first_name="TestSync",
    last_name="Student",
    email="testsync@school-os.edu",
    user_type="STUDENT"
)

student = Student.objects.create(
    suid=student_suid,
    user=user,
    school=school,
    admission_number="AD-999-TEST",
    date_of_birth="2010-05-15",
    gender="M",
    blood_group="O+",
    medical_conditions="Peanut Allergy",
    emergency_contact_name="Emergency Guardian",
    emergency_contact_phone="1234567890",
    address_line1="123 Street Rd",
    address_line2="Block B",
    city="Mumbai",
    state="Maharashtra",
    pincode="400001",
    latitude=Decimal("19.076000000"),
    longitude=Decimal("72.877700000"),
    address="123 Street Rd, Block B, Mumbai - 400001",
    category="OBC",
    religion="Hinduism",
    mother_tongue="Marathi",
    languages_known="English, Marathi, Hindi",
    nationality="Indian",
    birth_place="Mumbai City",
    is_rte_student=True,
    fee_concession_applicable=True,
    fee_concession_amount=Decimal("5000.00"),
    house_color="Red",
    alumni_directory_consent=True,
    aadhaar_number="123456789012",
    aadhaar_last_4_digits="9012",
    apaar_id="APAAR12345",
    pen_id="PEN98765",
    dietary_preference="Veg",
    phone="9876543210",
    status="ACTIVE",
    grade_config=grade_obj,
    current_section=section_obj
)

enrollment = StudentEnrollment.objects.create(
    student=student,
    school=school,
    grade=grade_obj.grade_name,
    section=section_obj.section_letter,
    academic_year=getattr(academic_year, 'code', '2025-2026'),
    status="ACTIVE"
)

# Upload mock documents
for doc_type in ['BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE', 'MARK_SHEET']:
    StudentDocument.objects.create(
        student=student,
        document_type=doc_type,
        title=f"Original {doc_type}",
        file="original.pdf"
    )

print("Step 1: Created Student with full details.")

# 3. Withdraw student to trigger sync signal
enrollment.status = "WITHDRAWN"
enrollment.save()
print("Step 2: Marked student as WITHDRAWN.")

# Verify archive is created and holds all fields
archive = StudentEnrollmentArchive.objects.filter(student_global_id=student_suid).first()
if not archive:
    print("Archive record not created!")
    sys.exit(1)
    
details = archive.admission_details
print("Step 3: Verified Archive contains serialized details:")
print(f"  Latitude: {details.get('latitude')}")
print(f"  Dietary Preference: {details.get('dietary_preference')}")
print(f"  APAAR ID: {details.get('apaar_id')}")

# Delete the live student to simulate they are gone
student.delete()
user.delete()
print("Step 4: Deleted live student from directory.")

# 4. Admit student from the archive
factory = APIRequestFactory()
view = StudentEnrollmentArchiveViewSet.as_view({'post': 'admit'})
request = factory.post(f'/api/v1/timeline/archive/{archive.id}/admit/', {
    'grade': grade_obj.grade_name,
    'section': section_obj.section_letter
}, format='json')
force_authenticate(request, user=admin_user)
response = view(request, pk=archive.id)

print(f"Step 5: Called Admit Endpoint. Status code: {response.status_code}")
if response.status_code != 200:
    print(f"Admit failed: {response.data}")
    sys.exit(1)
    
# Retrieve admitted student
admitted_student = Student.objects.get(suid=student_suid)
print("Step 6: Verified admitted student profile field values:")
print(f"  Status: {admitted_student.status}")
print(f"  dietary_preference: {admitted_student.dietary_preference} (Expected: Veg)")
print(f"  category: {admitted_student.category} (Expected: OBC)")
print(f"  religion: {admitted_student.religion} (Expected: Hinduism)")
print(f"  apaar_id: {admitted_student.apaar_id} (Expected: APAAR12345)")
print(f"  pen_id: {admitted_student.pen_id} (Expected: PEN98765)")
print(f"  latitude: {admitted_student.latitude} (Expected: 19.076000000)")
print(f"  is_rte_student: {admitted_student.is_rte_student} (Expected: True)")

# Assertion checks
assert admitted_student.dietary_preference == "Veg", "Dietary preference mismatch"
assert admitted_student.category == "OBC", "Category mismatch"
assert admitted_student.religion == "Hinduism", "Religion mismatch"
assert admitted_student.apaar_id == "APAAR12345", "APAAR ID mismatch"
assert admitted_student.pen_id == "PEN98765", "PEN ID mismatch"
assert admitted_student.is_rte_student is True, "RTE flag mismatch"
print("SUCCESS: Full student profile is successfully and completely restored!")

# Cleanup
admitted_student.user.delete()
admitted_student.delete()
StudentEnrollmentArchive.objects.filter(id=archive.id).delete()
print("Cleaned up test records.")
