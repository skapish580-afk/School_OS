# School OS - Complete Management System

A comprehensive school management system built with Django REST Framework and Next.js.

## 🚀 Features

### Core Modules
- **Students** - Complete student lifecycle management with photos, personal details, academic records
- **Teachers** - Teacher profiles, school associations, class assignments
- **Academics** - Classes, subjects, exams, marks entry, results, timetables, syllabus
- **Attendance** - Daily attendance tracking with session locking
- **Finance** - Invoices, payments, fee categories, revenue tracking
- **Health** - Medical records, clinic visits, health profiles
- **Gate Pass** - Entry/exit management with QR codes
- **Achievements** - Student awards, accomplishments, karma system
- **Discipline** - Behavior incidents, karma points, action tracking
- **Enrollments** - Class assignments, academic year management
- **Transfers** - Student transfer requests between schools

### System Features
- **Year-End Promotion** - Automated student promotion engine with batch processing
- **Platform Admin** - Multi-school management, subscriptions, feature access control
- **Settings** - School customization, widget visibility, regional preferences
- **Audit Trail** - Complete activity logging across all modules
- **Authentication** - JWT-based auth with role-based access control

## 📋 Tech Stack

### Backend
- Django 4.2.16
- Django REST Framework 3.15.2
- PostgreSQL/SQLite
- JWT Authentication
- Python 3.10+

### Frontend
- Next.js 14.0.3
- React 18
- TypeScript
- Tailwind CSS 3.3.0
- Recharts (data visualization)
- Lucide Icons

## 🛠️ Installation

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Admin Panel: http://localhost:8000/admin

## 📁 Project Structure

```
School-OS/
├── backend/
│   ├── apps/
│   │   ├── accounts/       # User authentication
│   │   ├── students/       # Student management
│   │   ├── teachers/       # Teacher management
│   │   ├── academics/      # Academic structure
│   │   ├── attendance/     # Attendance tracking
│   │   ├── finance/        # Financial management
│   │   ├── health/         # Health records
│   │   ├── gatepass/       # Gate pass system
│   │   ├── achievements/   # Awards & achievements
│   │   ├── discipline/     # Behavior management
│   │   ├── enrollments/    # Class enrollments
│   │   ├── transfers/      # Transfer requests
│   │   ├── schools/        # School settings
│   │   ├── features/       # Feature management
│   │   ├── platform_admin/ # Multi-school admin
│   │   └── audit/          # Audit logging
│   ├── core/              # Django settings
│   └── manage.py
│
└── frontend/
    ├── app/
    │   ├── dashboard/
    │   │   ├── students/      # Student pages
    │   │   ├── teachers/      # Teacher pages
    │   │   ├── academics/     # Academic pages
    │   │   ├── attendance/    # Attendance pages
    │   │   ├── finance/       # Finance pages
    │   │   ├── health/        # Health pages
    │   │   ├── gatepass/      # Gate pass pages
    │   │   ├── achievements/  # Achievement pages
    │   │   ├── discipline/    # Discipline pages
    │   │   ├── enrollments/   # Enrollment pages
    │   │   ├── transfers/     # Transfer pages
    │   │   ├── settings/      # Settings pages
    │   │   ├── year-end/      # Promotion pages
    │   │   └── admin/         # Platform admin
    │   ├── login/            # Auth pages
    │   └── layout.tsx
    ├── components/           # Reusable components
    ├── lib/                  # Utilities & API client
    └── public/              # Static assets
```

## 🔑 Key Concepts

### Student Admission Flow
1. **Add Student** (`/dashboard/students/add`)
   - Creates user identity (email, phone)
   - Creates student profile (DOB, address, photo)
   - **Automatically creates enrollment** in selected grade/section
   - Use for: New admissions

2. **Create Enrollment** (`/dashboard/enrollments`)
   - Assigns **existing student** to grade/section/year
   - Use for: Promotions, section changes, repeating grades

### Year-End Promotion
1. Create Academic Years (e.g., 2025-2026, 2026-2027)
2. Define Promotion Rules (Grade 10 → Grade 11)
3. Run Promotion Batch
4. Students automatically moved to next grade

### Settings System
- **Widget Visibility** - Hide dashboard cards even if feature is owned
- **Regional Settings** - Date format, timezone, academic year format
- **Notifications** - Email, SMS, push notification preferences
- **Privacy Controls** - Show/hide sensitive data

### Platform Admin vs School Settings
- **Platform Admin** - Controls feature ACCESS (subscriptions, licenses)
- **School Settings** - Controls feature VISIBILITY (dashboard customization)

## 🔐 Default Credentials

After running migrations and creating superuser:
- Superuser: As created
- Default student password: `Student@123`
- School code: Auto-generated (e.g., `PHS001`)

## 📊 API Endpoints

### Authentication
- `POST /api/v1/accounts/register/` - Register new user
- `POST /api/v1/accounts/login/` - Login
- `POST /api/v1/accounts/token/refresh/` - Refresh JWT

### Students
- `GET/POST /api/v1/students/` - List/create students
- `GET/PUT/PATCH /api/v1/students/{id}/` - Retrieve/update student
- `GET /api/v1/students/{id}/profile/` - Student profile with stats

### Enrollments
- `GET/POST /api/v1/enrollments/` - List/create enrollments
- `GET /api/v1/enrollments/academic-years/` - Academic years
- `POST /api/v1/enrollments/promotion-batches/` - Run promotion

### Attendance
- `POST /api/v1/attendance/mark/` - Mark attendance
- `GET /api/v1/attendance/session/` - Get session
- `POST /api/v1/attendance/lock/` - Lock session

### Finance
- `GET/POST /api/v1/finance/invoices/` - List/create invoices
- `POST /api/v1/finance/invoices/{id}/record_payment/` - Record payment
- `GET /api/v1/finance/categories/` - Fee categories

### Gate Pass
- `GET/POST /api/v1/gatepass/` - List/create passes
- `POST /api/v1/gatepass/{id}/check_in/` - Check in
- `POST /api/v1/gatepass/scan/` - Scan QR code

### Discipline
- `GET/POST /api/v1/discipline/` - List/create incidents
- `POST /api/v1/discipline/award_karma/` - Award karma points
- `GET /api/v1/discipline/karma_history/` - Karma history

### Settings
- `GET /api/v1/schools/settings/my_settings/` - Get settings
- `PATCH /api/v1/schools/settings/update_my_settings/` - Update settings

### Platform Admin
- `GET/POST /api/v1/platform-admin/subscriptions/` - Manage subscriptions
- `GET/POST /api/v1/platform-admin/features/` - Manage features
- `GET /api/v1/platform-admin/metrics/usage/` - Usage metrics

## 🧪 Testing

### Backend Tests
```bash
cd backend
python manage.py test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🐛 Common Issues

### Frontend won't start
- Check if port 3000 is in use
- Run `npm install` to ensure dependencies are installed
- Check `.env.local` for correct API URL

### Backend errors
- Ensure migrations are run: `python manage.py migrate`
- Check database connection in `settings.py`
- Verify all apps are in `INSTALLED_APPS`

### Authentication issues
- Check if JWT tokens are being sent in headers
- Verify `localStorage` has `access_token`
- Check token expiry (24 hours default)

### Data not showing
- Verify user belongs to a school
- Check widget visibility in Settings
- Ensure data exists in database

## 🚀 Deployment

### Backend (Django)
1. Set `DEBUG = False` in settings
2. Configure PostgreSQL database
3. Set `ALLOWED_HOSTS`
4. Collect static files: `python manage.py collectstatic`
5. Use Gunicorn: `gunicorn core.wsgi:application`

### Frontend (Next.js)
1. Build: `npm run build`
2. Deploy to Vercel/Netlify
3. Set environment variables (API URL)

## 📝 Future Enhancements

- [ ] Mobile app (React Native)
- [ ] Parent portal
- [ ] Online fee payment gateway
- [ ] SMS/Email notification service
- [ ] Report card generation (PDF)
- [ ] Library management
- [ ] Hostel management
- [ ] Transport management
- [ ] Exam hall allocation
- [ ] Time table auto-generation
- [ ] AI-powered analytics

## 👥 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 📧 Support

For issues or questions, contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Production Ready ✅
