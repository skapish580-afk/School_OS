# ✅ Quick Start Checklist

## What Was Wrong?
- ❌ Missing npm packages (axios, async-storage, react-navigation)
- ❌ expo-router conflicting with React Navigation
- ❌ Wrong package.json entry point
- ❌ API base URL not configured correctly

## What's Fixed?
- ✅ Installed missing dependencies
- ✅ Removed expo-router conflict
- ✅ Fixed entry point in package.json
- ✅ Set API_BASE to localhost for local testing

---

## 🚀 To Run the App Now:

### Terminal 1: Backend
```bash
cd backend
python manage.py runserver
```
**Should see**: `Starting development server at http://127.0.0.1:8000/`

### Terminal 2: Mobile App
```bash
cd mobile/SchoolOS
npm start
```
**Should see**:
```
› Metro waiting on exp://192.168.x.x:8081
› Web is waiting on http://localhost:8081
```

### Browser: Open
```
http://localhost:8081
```

---

## 🧪 Test Credentials

### Student
- Email: `aarav.patel0@student.greenwood.edu`
- Password: `student123`

### Teacher
- Email: `john.smith@greenwood.edu`
- Password: `teacher123`

---

## 📱 What You'll See

**Login Screen**: Form to choose Student/Teacher and login

**Student Dashboard**: 
- Personal info
- Attendance stats
- Latest grades
- Quick action buttons

**Teacher Dashboard**:
- Teacher info
- Assigned classes
- Student stats
- Tools menu

---

## 🆘 If It Doesn't Work

1. **Blank page on localhost:8081?**
   - Refresh browser (F5)
   - Check npm start is still running
   - Check browser console (F12) for errors

2. **Login fails?**
   - Check backend is running on 8000
   - Check API_BASE in src/services/api.js
   - Verify credentials are exact

3. **Module not found?**
   - Run: `npm install` again
   - Run: `npm start -- --reset-cache`

4. **Port already in use?**
   - Expo will use 8082 instead - check terminal
   - Or Kill node: `Get-Process node | Stop-Process -Force`

---

## 📂 Files Changed

| File | What Changed |
|------|--------------|
| `package.json` | Added 3 missing packages + fixed entry point |
| `app.json` | Removed expo-router plugin |
| `src/services/api.js` | Updated API_BASE to localhost:8000 |

---

**Status**: ✅ APP READY TO USE!

Visit: `http://localhost:8081` 🎉
