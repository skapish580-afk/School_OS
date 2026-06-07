# School-OS Backend API Documentation

## 🎯 Complete API Endpoints

All endpoints prefixed with `/api/v1/`

### 🔐 Authentication & Dashboard
- `POST /auth/register/` - Register new user
- `POST /auth/login/` - Login
- `POST /auth/logout/` - Logout
- `GET /dashboard/summary/` - Dashboard statistics

---

### 🏫 Core Entities

#### Schools
- `GET /schools/` - List all schools
- `POST /schools/` - Create school
- `GET /schools/{id}/` - Get school details
- `PUT /schools/{id}/` - Update school
- `DELETE /schools/{id}/` - Delete school

#### Students
- `GET /students/` - List students
  - Filter: `?school=1`, `?grade=10`, `?section=A`
- `POST /students/` - Add new student
- `GET /students/{id}/` - Get student details
- `PUT /students/{id}/` - Update student
- `DELETE /students/{id}/` - Delete student

#### Teachers
- `GET /teachers/profiles/` - List teachers
  - Filter: `?school=1`
- `POST /teachers/profiles/` - Add teacher
- `GET /teachers/profiles/{id}/` - Get teacher details
- `PUT /teachers/profiles/{id}/` - Update teacher
- `DELETE /teachers/profiles/{id}/` - Delete teacher

#### Teacher Assignments
- `GET /teachers/assignments/` - List assignments
  - Filter: `?school=1`, `?grade=10`, `?section=A`, `?role=CLASS_TEACHER`
- `POST /teachers/assignments/` - Create assignment
- `GET /teachers/assignments/{id}/` - Get assignment
- `PUT /teachers/assignments/{id}/` - Update assignment
- `DELETE /teachers/assignments/{id}/` - Delete assignment

#### Enrollments
- `GET /enrollments/` - List enrollments
  - Filter: `?student=1`, `?school=1`, `?grade=10`, `?section=A`, `?status=ACTIVE`
- `POST /enrollments/` - Create enrollment
- `GET /enrollments/{id}/` - Get enrollment
- `PUT /enrollments/{id}/` - Update enrollment
- `DELETE /enrollments/{id}/` - Delete enrollment
- `GET /enrollments/class_strength/` - Get student count by class
- `POST /enrollments/{id}/promote/` - Promote student to next grade

---

### 📚 Academic Features

#### Academics (Grades, Sections, Subjects, Syllabus)
- `GET /academics/grades/` - List grades
- `GET /academics/sections/` - List sections
- `GET /academics/subjects/` - List subjects
- `GET /academics/syllabus/` - List syllabus
- `POST /academics/syllabus/` - Create syllabus entry
- `PUT /academics/syllabus/{id}/` - Update syllabus

#### Attendance
- `GET /attendance/` - List attendance sessions
  - Filter: `?grade=10`, `?section=A`, `?date=2026-01-21`
- `POST /attendance/` - Create attendance session
- `GET /attendance/{id}/` - Get session details
- `PUT /attendance/{id}/` - Update session
- `POST /attendance/{id}/mark_all/` - Bulk mark attendance

---

### 🎓 Student Lifecycle

#### Transfers
- `GET /transfers/` - List transfer requests
  - Filter: `?student=1`, `?status=PENDING`, `?target_school=1`
- `POST /transfers/` - Create transfer request
- `GET /transfers/{id}/` - Get transfer details
- `POST /transfers/{id}/approve/` - Approve transfer
- `POST /transfers/{id}/reject/` - Reject transfer

#### Discipline
- `GET /discipline/` - List discipline records
  - Filter: `?student=1`, `?severity=CRITICAL`, `?category=BULLYING`
- `POST /discipline/` - Create discipline record
- `GET /discipline/{id}/` - Get record details
- `PUT /discipline/{id}/` - Update record
- `DELETE /discipline/{id}/` - Delete record
- `GET /discipline/summary/?student=1` - Get student discipline summary

#### Achievements
- `GET /achievements/awards/` - List achievements
  - Filter: `?student=1`, `?category=ACADEMIC`
- `POST /achievements/awards/` - Add achievement
- `GET /achievements/awards/{id}/` - Get achievement
- `PUT /achievements/awards/{id}/` - Update achievement
- `DELETE /achievements/awards/{id}/` - Delete achievement
- `GET /achievements/awards/by_category/?student=1` - Achievement summary

#### Artifacts (Student Portfolio)
- `GET /achievements/artifacts/` - List artifacts
  - Filter: `?student=1`, `?is_public=true`
- `POST /achievements/artifacts/` - Upload artifact
- `GET /achievements/artifacts/{id}/` - Get artifact
- `PUT /achievements/artifacts/{id}/` - Update artifact
- `DELETE /achievements/artifacts/{id}/` - Delete artifact

---

### 🏥 Operations

#### Gate Pass
- `GET /gatepass/` - List gate passes
  - Filter: `?student=1`, `?status=ACTIVE`
- `POST /gatepass/` - Issue gate pass
- `GET /gatepass/{id}/` - Get pass details
- `POST /gatepass/{id}/scan/` - Scan gate pass (mark as used)
- `GET /gatepass/active/` - Get all active passes

#### Health
- `GET /health/profiles/` - List health profiles
  - Filter: `?student=1`
- `POST /health/profiles/` - Create health profile
- `GET /health/profiles/{id}/` - Get profile
- `PUT /health/profiles/{id}/` - Update profile

#### Clinic Visits
- `GET /health/visits/` - List clinic visits
  - Filter: `?student=1`
- `POST /health/visits/` - Log clinic visit
- `GET /health/visits/{id}/` - Get visit details
- `GET /health/visits/recent/` - Get visits from last 30 days
- `GET /health/visits/sent_home_today/` - Students sent home today

#### Finance

##### Fee Schedules (Payment Frequency)
- `GET /finance/schedules/` - List fee schedules
  - Filter: `?school=1`, `?is_active=true`
- `POST /finance/schedules/` - Create schedule (Quarterly, Half-Yearly, etc.)
- `GET /finance/schedules/{id}/` - Get schedule details
- `PUT /finance/schedules/{id}/` - Update schedule
- `POST /finance/schedules/{id}/set_default/` - Set as default schedule

##### Fee Structures (Grade-wise Fees)
- `GET /finance/structures/` - List fee structures
  - Filter: `?school=1`, `?grade=uuid`, `?academic_year=2025-2026`
- `POST /finance/structures/` - Create fee structure for grade
- `GET /finance/structures/{id}/` - Get structure details
- `PUT /finance/structures/{id}/` - Update structure
- `POST /finance/structures/{id}/apply_hike/` - Apply % hike to structure
- `POST /finance/structures/copy_to_next_year/` - Copy structures to new year with hike

##### Student Fee Assignments
- `GET /finance/assignments/` - List student fee assignments
  - Filter: `?school=1`, `?student=uuid`, `?academic_year=2025-2026`, `?status=ACTIVE`
- `POST /finance/assignments/` - Assign fee to individual student
- `GET /finance/assignments/{id}/` - Get assignment details with installments
- `PUT /finance/assignments/{id}/` - Update assignment (discounts, etc.)
- `POST /finance/assignments/bulk_assign/` - **Bulk assign fees to students**
  - Body: `{ "fee_structure_id": "uuid", "fee_schedule_id": "uuid", "academic_year": "2025-2026", "grade_id": "uuid" (optional), "override_existing": false }`
- `POST /finance/assignments/{id}/approve/` - Approve special fee assignment
- `POST /finance/assignments/{id}/generate_invoice/` - Generate invoice for installment

##### Fee Installments
- `GET /finance/installments/` - List installments
  - Filter: `?assignment=uuid`, `?status=PENDING`, `?overdue=true`
- `GET /finance/installments/{id}/` - Get installment details
- `POST /finance/installments/check_overdue/` - Mark overdue installments

##### Fee Hike Configuration
- `GET /finance/hike-configs/` - List hike configurations
  - Filter: `?school=1`
- `POST /finance/hike-configs/` - Create hike config for next year
- `GET /finance/hike-configs/{id}/` - Get hike details
- `POST /finance/hike-configs/{id}/apply_hike/` - Apply hike to all structures

##### Bulk Assignments History
- `GET /finance/bulk-assignments/` - List bulk assignment operations
  - Filter: `?school=1`
- `GET /finance/bulk-assignments/{id}/` - Get bulk assignment details

##### Invoices
- `GET /finance/invoices/` - List invoices
  - Filter: `?student=uuid`, `?school=1`, `?status=UNPAID`, `?academic_year=2025-2026`
- `POST /finance/invoices/` - Create invoice
- `GET /finance/invoices/{id}/` - Get invoice details with transactions
- `PUT /finance/invoices/{id}/` - Update invoice
- `POST /finance/invoices/{id}/record_payment/` - Record payment
  - Body: `{ "amount": 5000, "mode": "CASH|UPI|CHEQUE|BANK_TRANSFER|CARD", "reference": "..." }`
- `GET /finance/invoices/dashboard_stats/` - Get finance dashboard statistics

##### Fee Categories
- `GET /finance/categories/` - List fee categories
  - Filter: `?school=1`, `?is_active=true`
- `POST /finance/categories/` - Create category
- `GET /finance/categories/{id}/` - Get category details
- `PUT /finance/categories/{id}/` - Update category

---

## 🔧 Feature Categories

### ✅ Core Features (Always Active)
1. Student Identity (SUID)
2. Teacher Identity (TUID)
3. School Management
4. Grades & Sections
5. Enrollments
6. Basic Academics

### 🎚️ Standard Features (Admin Toggle)
1. **Academics**
   - Attendance Tracking
   - Syllabus Management
   - Marks Entry
   
2. **Student Lifecycle**
   - Discipline Records
   - Achievements & Awards
   - Transfer Requests
   
3. **Operations**
   - Gate Pass System
   - Health Records
   - Finance & Invoices

### 🔐 Premium Features (Future)
1. Smart Systems
   - Auto timetable generation
   - AI predictions
   - Anomaly detection

2. Compliance
   - Uniform tracking
   - Gate entry logs
   - Parent alerts

3. Network Platform
   - Inter-school transfers
   - Central benchmarking

---

## 📊 Common Query Parameters

All list endpoints support:
- **Filtering**: `?field=value`
- **Search**: `?search=query`
- **Ordering**: `?ordering=field` or `?ordering=-field` (desc)
- **Pagination**: `?page=1&page_size=50`

---

## 🎯 Feature Toggle Model

```json
{
  "school_id": 1,
  "features": {
    "CORE": {
      "students": true,
      "teachers": true,
      "enrollments": true
    },
    "STANDARD": {
      "attendance": true,
      "discipline": true,
      "gatepass": false,
      "health": true,
      "finance": true,
      "achievements": true
    },
    "PREMIUM": {
      "auto_timetable": false,
      "ai_predictions": false,
      "network": false
    }
  }
}
```

---

## 🚀 Quick Start

1. **Backend**: `python manage.py runserver`
2. **Frontend**: `npm run dev`
3. **Login**: http://localhost:3000/login
4. **Dashboard**: http://localhost:3000/dashboard

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Status**: ✅ All 7 Core Apps Complete
