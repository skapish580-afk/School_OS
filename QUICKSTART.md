# 🚀 Quick Start Guide - School OS

## Prerequisites
- Python 3.10+
- Node.js 16+
- pip & npm

## 5-Minute Setup

### Step 1: Backend (Terminal 1)
```bash
cd backend
python -m venv venv
venv\Scripts\activate              # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # Create admin account
python manage.py runserver
```

### Step 2: Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

### Step 3: Access the System
- 🌐 Frontend: http://localhost:3000
- 🔧 Backend API: http://localhost:8000
- 👨‍💼 Admin Panel: http://localhost:8000/admin

## First Login
1. Go to http://localhost:3000/login
2. Use the superuser credentials you created
3. You're in! 🎉

## Quick Tour

### 1. Create Academic Structure
**Academics → Classes**
- Add Grade (e.g., Grade 10)
- Add Sections (A, B, C)

### 2. Add Your First Student
**Students → Add Student**
- Fill in student details
- Upload photo (optional)
- Select grade & section
- Click "Confirm Admission"
- ✅ Student is automatically enrolled!

### 3. Mark Attendance
**Attendance**
- Select grade & section
- Choose date
- Mark students as Present/Absent
- Save attendance session

### 4. Create Invoice
**Finance → Add Invoice**
- Select student
- Choose fee category (or create new)
- Set amount & due date
- Record payments when received

### 5. Issue Gate Pass
**Gate Pass → Create Pass**
- Select student
- Enter reason
- QR code generated automatically
- Use scan feature to check-in/out

### 6. Award Achievements
**Achievements → Add Award**
- Select student
- Choose category (Academic/Sports/Arts)
- Add description
- Date awarded

### 7. Track Behavior
**Discipline**
- **Report Incident** - Document misbehavior
- **Award Karma** - Reward good behavior
- View karma scorecard on student profile

### 8. End-of-Year Promotion
**Year-End → Promotion Engine**
1. Create next academic year (2026-2027)
2. Define promotion rules (10→11, 11→12)
3. Select students for promotion
4. Run batch promotion
5. All students moved to next grade!

## Customization

### Customize Dashboard
**Settings → Dashboard Tab**
- Toggle widgets on/off
- Hide features you don't use
- Changes apply instantly

### Regional Settings
**Settings → General Tab**
- Date format (DD/MM/YYYY or MM/DD/YYYY)
- Academic year format (2025-2026 or 25-26)
- Timezone

### Privacy Controls
**Settings → Privacy Tab**
- Show/hide student photos
- Show/hide parent contact
- Show/hide financial data

## Common Tasks

### Enroll Student in New Section
**Enrollments → Add Enrollment**
- Select existing student
- Choose new grade/section
- Set academic year
- Useful for: promotions, section changes

### Generate Reports
1. **Attendance Report** - Attendance page → View session history
2. **Financial Report** - Finance page → Filter by status
3. **Student Profile** - Click any student → View complete history

### Bulk Operations
- **Attendance** - Mark entire class at once
- **Promotion** - Promote all students in batch
- **Invoices** - Generate fees for entire grade

## Tips & Tricks

### 🔍 Search Everywhere
- Students: Search by name or SUID
- All pages have search/filter capabilities

### ⚡ Keyboard Shortcuts
- `ESC` - Close modals
- `Tab` - Navigate forms quickly

### 📱 Mobile Friendly
- Responsive design works on tablets
- Sidebar auto-hides on mobile

### 🔐 Security
- JWT tokens expire in 24 hours
- All API calls require authentication
- Role-based access control

### 📊 Dashboard Widgets
- Real-time student count
- Today's attendance percentage
- Active gate passes
- Recent karma awards

## Troubleshooting

### "Unauthorized" Error
**Solution:** Login again, token expired

### Student Not Showing
**Solution:** Check if enrolled in a class

### Can't Add Student
**Solution:** Create grades/sections first in Academics

### Widget Not Showing
**Solution:** Check Settings → Dashboard → Enable widget

### Backend Not Running
**Solution:**
```bash
cd backend
venv\Scripts\activate
python manage.py runserver
```

### Frontend Not Running
**Solution:**
```bash
cd frontend
npm run dev
```

## Next Steps

1. ✅ Add all your students
2. ✅ Create class timetables (Academics → Timetable)
3. ✅ Set up fee structure (Finance → Categories)
4. ✅ Configure health profiles (Health page)
5. ✅ Create academic year (Enrollments → Academic Years)
6. ✅ Invite teachers (Teachers page)

## Support

- 📖 Full documentation: See README.md
- 🐛 Found a bug? Check console logs
- 💡 Feature request? Document it!

---

**Enjoy using School OS!** 🎓

Built with ❤️ using Django + Next.js
