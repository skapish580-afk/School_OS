#!/usr/bin/env python
"""
Database Verification Script
Checks that all interconnected data was created successfully
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models import School
from apps.schools.models_programs import AcademicProgram
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from apps.teachers.models import Teacher, TeacherSchoolAssociation
from apps.features.models import Feature, SchoolFeatureConfig
from apps.platform_admin.models import FeatureAccess, SchoolSubscription as PlatformAdminSubscription
from apps.owner.models import PlatformOwner
from apps.academics.models import Section
from apps.enrollments.models_promotion import AcademicYear

print("=" * 70)
print("🔍 DATABASE INTERCONNECTION VERIFICATION")
print("=" * 70)

# School verification
print("\n📍 SCHOOLS")
schools = School.objects.all()
print(f"  Total schools: {schools.count()} (expected: 2)")
for school in schools:
    print(f"    - {school.display_name} ({school.code})")

# Student verification
print("\n👨‍🎓 STUDENTS")
students = Student.objects.all()
print(f"  Total students: {students.count()} (expected: 32)")
students_per_school = students.values('school').distinct().count()
print(f"  Schools with students: {students_per_school}")

# StudentEnrollment verification
print("\n📋 STUDENT ENROLLMENTS")
enrollments = StudentEnrollment.objects.all()
print(f"  Total enrollments: {enrollments.count()} (expected: 32)")
for school in schools:
    school_enrollments = enrollments.filter(student__school=school).count()
    print(f"    - {school.display_name}: {school_enrollments} enrollments")

# Teacher verification
print("\n👨‍🏫 TEACHERS")
teachers = Teacher.objects.all()
print(f"  Total teachers: {teachers.count()} (expected: 6)")
associations = TeacherSchoolAssociation.objects.all()
print(f"  Teacher-school associations: {associations.count()} (expected: 6)")
for school in schools:
    school_teachers = associations.filter(school=school).count()
    print(f"    - {school.display_name}: {school_teachers} teachers")

# Feature verification
print("\n⚙️  FEATURES")
features = Feature.objects.all()
print(f"  Total features: {features.count()} (expected: 9)")
for feature in features:
    print(f"    - {feature.code}: {feature.name}")

# Feature Access verification
print("\n🔐 FEATURE ACCESS (Platform Admin)")
feature_access = FeatureAccess.objects.all()
print(f"  Total FeatureAccess records: {feature_access.count()} (expected: 18)")
for school in schools:
    access = feature_access.filter(school=school).count()
    print(f"    - {school.display_name}: {access} features accessible")

# SchoolFeatureConfig verification
print("\n🎯 SCHOOL FEATURE CONFIG (Features App)")
sfc = SchoolFeatureConfig.objects.all()
print(f"  Total SchoolFeatureConfig records: {sfc.count()} (expected: 18)")
for school in schools:
    configs = sfc.filter(school=school).count()
    enabled = sfc.filter(school=school, enabled=True).count()
    print(f"    - {school.display_name}: {configs} configs ({enabled} enabled)")

# Subscription verification
print("\n💳 SUBSCRIPTIONS")
subscriptions = PlatformAdminSubscription.objects.all()
print(f"  Total subscriptions: {subscriptions.count()} (expected: 2)")
for sub in subscriptions:
    print(f"    - {sub.school.display_name}: {sub.plan} ({sub.status})")

# Academic structure verification
print("\n📚 ACADEMIC STRUCTURE")
programs = AcademicProgram.objects.all()
print(f"  Total programs: {programs.count()} (expected: 2)")
years = AcademicYear.objects.all()
print(f"  Total academic years: {years.count()} (expected: 2)")
sections = Section.objects.all()
print(f"  Total sections: {sections.count()} (expected: 16)")
for school in schools:
    programs = AcademicProgram.objects.filter(school=school)
    grade_configs = programs.values_list('grades', flat=True)
    school_sections = sections.filter(grade_config__program__school=school).count()
    print(f"    - {school.display_name}: {school_sections} sections")

# Platform owner verification
print("\n👑 PLATFORM OWNER")
owner = PlatformOwner.objects.first()
if owner:
    print(f"  Owner: {owner.user.email}")
    print(f"  Name: {owner.user.full_name}")
else:
    print("  ❌ No platform owner found!")

print("\n" + "=" * 70)
print("✅ VERIFICATION COMPLETE")
print("=" * 70)
