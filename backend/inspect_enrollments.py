import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models_programs import GradeConfiguration
from apps.academics.models import Section
from apps.enrollments.models_promotion import AcademicYear
from apps.students.models import Student
from apps.schools.models import School

def inspect():
    schools = School.objects.all()
    print(f"Schools: {schools.count()}")
    for s in schools:
        print(f"  - {s.name} ({s.id})")
        
    grades = GradeConfiguration.objects.all()
    print(f"\nGrades: {grades.count()}")
    for g in grades:
        print(f"  - {g.grade_name} (School: {g.program.school.name})")
        
    sections = Section.objects.all()
    print(f"\nSections: {sections.count()}")
    for sec in sections:
        print(f"  - {sec.section_letter} (Grade: {sec.grade_config.grade_name}, School: {sec.school.name})")
        
    years = AcademicYear.objects.all()
    print(f"\nAcademic Years: {years.count()}")
    for y in years:
        print(f"  - {y.year_code} (School: {y.school.name}, Status: {y.status})")
        
    students = Student.objects.all()
    print(f"\nStudents: {students.count()}")
    for st in students:
        print(f"  - {st.user.full_name} (School: {st.school.name if st.school else 'None'})")

if __name__ == "__main__":
    inspect()
