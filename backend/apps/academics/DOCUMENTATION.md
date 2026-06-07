"""
SCHOOL-OS: ACADEMIC MODULE DOCUMENTATION

This document describes the 6-module academic system for School-OS.

🎯 PRINCIPLE: Each module is isolated. Each module does ONE thing well.

================================================
MODULE 1: CLASSES & SECTIONS
================================================

PURPOSE: Define the academic structure (grades & sections)

MODELS:
- Grade: Grade level (1-12)
- Section: Class/section within a grade (A, B, C)

FEATURES:
✓ Create grades (LKG → X / XII)
✓ Create sections (A, B, C…)
✓ Assign primary + co-class teacher
✓ Set max strength & room number
✓ Lock capacity (prevent enrollment changes)

API ENDPOINTS:
- GET    /api/v1/academics/grades/
- POST   /api/v1/academics/grades/
- GET    /api/v1/academics/grades/{id}/
- PATCH  /api/v1/academics/grades/{id}/
- DELETE /api/v1/academics/grades/{id}/

- GET    /api/v1/academics/sections/
- POST   /api/v1/academics/sections/
- GET    /api/v1/academics/sections/{id}/
- PATCH  /api/v1/academics/sections/{id}/
- DELETE /api/v1/academics/sections/{id}/

PERMISSIONS:
- Create/Edit: School Admin (Principal)
- View: Teacher, Student (own section)
- Delete: Admin Only

AUDIT:
✓ All creates, updates, deletes logged
✓ Capacity lock changes logged

ADMIN CONTROLS:
- Lock section capacity
- Assign/change co-teacher
- Set room number

================================================
MODULE 2: SUBJECTS (RULE ENGINE)
================================================

PURPOSE: Define subjects and set academic rules

MODELS:
- Subject: Subject definition (Code, Type, Rules)
- SubjectMapping: Subject → Section + Teacher assignment

FEATURES:
✓ Subject creation (Code, Type: Core/Elective/Activity)
✓ Assign to grades and sections
✓ Define passing marks
✓ Teacher mapping (primary + co-teacher)
✓ Rules: affects_promotion, included_in_board_report

API ENDPOINTS:
- GET    /api/v1/academics/subjects/
- POST   /api/v1/academics/subjects/
- GET    /api/v1/academics/subjects/{id}/
- PATCH  /api/v1/academics/subjects/{id}/
- DELETE /api/v1/academics/subjects/{id}/

- GET    /api/v1/academics/subject-mappings/
- POST   /api/v1/academics/subject-mappings/
- GET    /api/v1/academics/subject-mappings/{id}/
- PATCH  /api/v1/academics/subject-mappings/{id}/
- DELETE /api/v1/academics/subject-mappings/{id}/

SUBJECT RULES:
- is_core: Bool - Legacy compatibility
- subject_type: Core/Elective/Activity
- passing_marks: Minimum marks to pass
- affects_promotion: Bool - Does it block promotion?
- included_in_board_report: Bool - Show on official report?

PERMISSIONS:
- Create/Edit: School Admin
- View: Teacher, Student
- Delete: Admin Only

================================================
MODULE 3: TIMETABLE (DISCIPLINE ENGINE)
================================================

PURPOSE: Schedule classes and manage teacher assignments

MODELS:
- Timetable: Master schedule for a section
- Period: Individual class period (time slot)
- TemporarySubstitution: Temp teacher changes

FEATURES:
✓ Period structure (start, end, breaks)
✓ Class-wise timetable
✓ Teacher-wise timetable view
✓ Room allocation
✓ Lock timetable (prevent changes)
✓ Temporary substitutions

API ENDPOINTS:
- GET    /api/v1/academics/timetables/
- POST   /api/v1/academics/timetables/
- GET    /api/v1/academics/timetables/{id}/
- PATCH  /api/v1/academics/timetables/{id}/

- GET    /api/v1/academics/periods/
- POST   /api/v1/academics/periods/
- PATCH  /api/v1/academics/periods/{id}/
- DELETE /api/v1/academics/periods/{id}/

- POST   /api/v1/academics/substitutions/
- PATCH  /api/v1/academics/substitutions/{id}/
- DELETE /api/v1/academics/substitutions/{id}/

CONTROLS:
- is_locked: Bool - Locked? (Admin only can modify)
- locked_by: User - Who locked it?

RULES:
✓ No teacher clashes (smart validation)
✓ Max periods per teacher/day
✓ Period overlaps validation

ADMIN ACTIONS:
- Lock timetable (Principal only)
- Emergency override (Principal)
- Approve substitutions

================================================
MODULE 4: SYLLABUS (ACCOUNTABILITY)
================================================

PURPOSE: Track syllabus planning and execution

MODELS:
- Syllabus: Syllabus document for subject + section
- Chapter: Chapter/unit within syllabus

FEATURES:
✓ Define syllabus per subject + grade
✓ Break into units & chapters
✓ Expected completion dates
✓ Status tracking: Planned/In Progress/Completed
✓ Teacher pacing comparison
✓ Syllabus lag alerts

API ENDPOINTS:
- GET    /api/v1/academics/syllabuses/
- POST   /api/v1/academics/syllabuses/
- GET    /api/v1/academics/syllabuses/{id}/
- PATCH  /api/v1/academics/syllabuses/{id}/

- GET    /api/v1/academics/chapters/
- POST   /api/v1/academics/chapters/
- PATCH  /api/v1/academics/chapters/{id}/
- DELETE /api/v1/academics/chapters/{id}/

TEACHER WORKFLOW:
- Update chapter status: NOT_STARTED → IN_PROGRESS → COMPLETED
- Set actual_completion_date
- System tracks last_updated_by

ADMIN INSIGHTS:
- progress_percentage: % of completed chapters
- Lag alerts when behind schedule
- Pacing comparison across teachers

================================================
MODULE 5: EXAMS (CONTROL & DISCIPLINE)
================================================

PURPOSE: Examination scheduling and compliance

MODELS:
- Exam: Exam definition and schedule
- Result: Student result/marks
- ExamAbsenteeLog: Absence and re-exam eligibility
- MalpracticeIncident: Cheating/discipline incidents

FEATURES:
✓ Exam types: Unit Test, Midterm, Finals, Periodic
✓ Schedule: Date, Duration, Room
✓ Invigilator assignment
✓ Min attendance eligibility %
✓ Subject-wise marks split
✓ Grace marks (Admin only)
✓ Absentee marking
✓ Re-exam flagging
✓ Malpractice incident log

API ENDPOINTS:
- GET    /api/v1/academics/exams/
- POST   /api/v1/academics/exams/
- GET    /api/v1/academics/exams/{id}/
- PATCH  /api/v1/academics/exams/{id}/
- DELETE /api/v1/academics/exams/{id}/

- GET    /api/v1/academics/results/
- POST   /api/v1/academics/results/
- PATCH  /api/v1/academics/results/{id}/

- POST   /api/v1/academics/malpractice-incidents/
- GET    /api/v1/academics/malpractice-incidents/
- PATCH  /api/v1/academics/malpractice-incidents/{id}/

EXAM CONTROLS:
- min_attendance_percentage: Default 75%
- grace_marks: Admin-only override
- exam_room: Physical location
- invigilators: List of teachers

RESULT DISCIPLINE:
- is_absent: Bool
- is_eligible_for_reexam: Auto-determined
- moderation_status: DRAFT → SUBMITTED → APPROVED → LOCKED

MALPRACTICE TRACKING:
- severity: Minor/Major/Severe
- description: Detailed incident report
- action_taken: Disciplinary outcome
- approved_by: Admin approval

================================================
MODULE 6: RESULTS (OUTPUT & TRUST)
================================================

PURPOSE: Marks, report cards, academic history

MODELS:
- Result: Individual marks (see Module 5)
- ReportCard: Term/year summary and storage

FEATURES:
✓ Marks entry (teacher)
✓ Moderation (HOD/Admin approval)
✓ Result locking (finalize)
✓ Auto grade calculation (A+, A, B, C, D, F)
✓ Report card generation
✓ Year-wise storage
✓ Alumni access

API ENDPOINTS:
- GET    /api/v1/academics/report-cards/
- POST   /api/v1/academics/report-cards/
- GET    /api/v1/academics/report-cards/{id}/

RESULT WORKFLOW:
1. Teacher enters marks (DRAFT)
2. Teacher submits (SUBMITTED)
3. HOD/Admin reviews and approves (APPROVED)
4. System locks (LOCKED) - no changes

MODERATION FIELDS:
- moderation_status: DRAFT/SUBMITTED/APPROVED/LOCKED
- moderation_by: User who approved
- moderation_remarks: Notes from reviewer

GRADING LOGIC (Auto-calculated):
- >= 90%: A+ (4.0)
- >= 80%: A (3.7)
- >= 70%: B (3.0)
- >= 60%: C (2.0)
- >= 50%: D (1.0)
- < 50%: F (0.0)
- Absent: AB (0.0)

REPORT CARD:
- total_marks_obtained: Sum of all subject marks
- percentage: (total_obtained / total_possible) × 100
- grade_awarded: Highest grade or overall grade
- rank: Position in class (optional)
- is_locked: Final state
- Alumni can access after graduation

================================================
FEATURE TOGGLES (EXTENSIBILITY)
================================================

Every module checks: has_feature(school, 'FEATURE_CODE')

CORE FEATURES (Cannot disable):
- MODULE_CLASSES_SECTIONS
- MODULE_SUBJECTS
- MODULE_TIMETABLE
- MODULE_SYLLABUS
- MODULE_EXAMS
- MODULE_RESULTS

STANDARD FEATURES (Can disable):
- FEATURE_CO_CLASS_TEACHER
- FEATURE_SECTION_CAPACITY_LOCK
- FEATURE_BULK_STUDENT_PROMOTION
- FEATURE_SUBJECT_ELECTIVES
- FEATURE_CO_TEACHER_ASSIGNMENT
- FEATURE_TIMETABLE_LOCK
- FEATURE_TEMPORARY_SUBSTITUTIONS
- FEATURE_SYLLABUS_LAG_ALERTS
- FEATURE_EXAM_INVIGILATORS
- FEATURE_GRACE_MARKS
- FEATURE_MALPRACTICE_LOGGING
- FEATURE_RESULT_MODERATION
- FEATURE_RESULT_LOCKING

ADVANCED FEATURES (Default off):
- FEATURE_TIMETABLE_CLASH_DETECTION
- FEATURE_TEACHER_PACING_COMPARISON
- FEATURE_REEXAM_MANAGEMENT
- FEATURE_SMART_RANKING
- FEATURE_ALUMNI_ACCESS

================================================
AUDIT & SECURITY
================================================

LOGGING:
✓ Every create, update, delete logged
✓ Logged to apps.audit.models.AuditLog
✓ Includes: actor, action, object, details, timestamp

PERMISSIONS:
- Admin/Principal: Full control
- Teacher: Read own class, Edit own subject marks
- Student: Read own results, Syllabus progress
- Parent: (if enabled) Read child's results

LOCKED DATA CONTROLS:
- Timetable locked: Teacher cannot edit periods
- Result locked: Cannot change marks
- Report card locked: Cannot regenerate
- Exception: Principal/Admin can override if needed

================================================
USAGE EXAMPLES
================================================

CREATE GRADE:
POST /api/v1/academics/grades/
{
    "school": "uuid",
    "grade_number": 10,
    "grade_name": "Grade 10",
    "is_active": true
}

CREATE SECTION:
POST /api/v1/academics/sections/
{
    "school": "uuid",
    "grade": "grade-uuid",
    "section_letter": "A",
    "capacity": 50,
    "room_number": "10-A",
    "class_teacher": "teacher-uuid",
    "co_class_teacher": "teacher-uuid-2",
    "capacity_locked": false
}

CREATE EXAM:
POST /api/v1/academics/exams/
{
    "school": "uuid",
    "section": "section-uuid",
    "subject_mapping": "mapping-uuid",
    "name": "Midterm 2025",
    "exam_type": "MIDTERM",
    "exam_date": "2026-02-15",
    "duration_minutes": 120,
    "max_marks": 100,
    "passing_marks": 40,
    "exam_room": "Lab-1",
    "min_attendance_percentage": 75,
    "grace_marks": 0,
    "academic_year": "2025-2026",
    "invigilators": ["teacher-uuid"]
}

ENTER RESULT:
POST /api/v1/academics/results/
{
    "exam": "exam-uuid",
    "student": "student-uuid",
    "marks_obtained": 85.5,
    "is_absent": false,
    "remarks": "Good performance"
}

APPROVE RESULT:
PATCH /api/v1/academics/results/{id}/
{
    "moderation_status": "APPROVED",
    "moderation_remarks": "Approved by HOD"
}

================================================
"""
