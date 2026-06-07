# School OS Mobile App - Quick Start Guide

## 🚀 Fast Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd mobile/SchoolOS
npm install
```

### Step 2: Configure Backend URL

Edit `src/services/api.js` line 4:

**For Windows Development:**
```javascript
const API_BASE = 'http://192.168.1.100:8000/api/v1'; // Replace with your IP
```

To find your IP:
```bash
ipconfig
# Look for "IPv4 Address" under your network adapter
```

**For Android Emulator:**
```javascript
const API_BASE = 'http://10.0.2.2:8000/api/v1';
```

**For iOS Simulator:**
```javascript
const API_BASE = 'http://localhost:8000/api/v1';
```

### Step 3: Start Backend
In a separate terminal:
```bash
cd backend
python manage.py runserver
```

### Step 4: Start Mobile App
```bash
npm start
```

Press:
- **`a`** for Android emulator
- **`i`** for iOS simulator
- **`w`** for web browser
- **`q`** to quit

### Step 5: Login

**Student Test Account:**
- Email: `aarav.patel0@student.greenwood.edu`
- Password: `student123`

**Teacher Test Account:**
- Email: `john.smith@greenwood.edu`
- Password: `teacher123`

---

## 📱 App Walkthrough

### Login Screen
1. Select **Student** or **Teacher**
2. Enter email and password
3. Tap **Login**
4. Redirected to appropriate dashboard

### Student Dashboard
- **Academic Info**: School name, status, admission date
- **Attendance**: Present/Absent/Percentage
- **Latest Marks**: Recent grades
- **Quick Links**: Assignments, Results, Announcements, Teachers

### Teacher Dashboard
- **Teacher Info**: School, experience, gender
- **My Classes**: Assigned sections with capacity
- **Students**: Total and active student count
- **Teacher Tools**: Attendance, Marks, Assignments, Announcements

---

## 🔧 Troubleshooting

### "Cannot connect to API"
1. Check Django is running: `python manage.py runserver`
2. Verify IP address in `api.js`
3. On Android emulator, use `10.0.2.2` instead of `localhost`

### "Login failed"
1. Ensure backend is running
2. Verify credentials are correct
3. Check network connectivity

### App crashes on startup
1. Clear cache: `npx expo start -c`
2. Delete `node_modules` and reinstall: `npm install`
3. Check for JavaScript errors in console

### Blank screen after login
1. Check console for errors (press `j` in Expo)
2. Verify API endpoints exist in backend
3. Check that user has correct user_type (STUDENT/TEACHER)

---

## 📊 Project Structure

```
mobile/
└── SchoolOS/
    ├── src/
    │   ├── screens/
    │   │   ├── LoginScreen.js        ← Login UI
    │   │   ├── StudentDashboardScreen.js
    │   │   └── TeacherDashboardScreen.js
    │   ├── services/
    │   │   └── api.js                 ← API configuration
    │   └── context/
    │       └── AuthContext.js         ← Auth state
    ├── App.js                         ← Main navigation
    ├── index.js                       ← Entry point
    └── package.json                   ← Dependencies
```

---

## 🎯 Key Features

### Authentication
- ✅ Email/password login
- ✅ JWT token management
- ✅ Automatic token refresh
- ✅ Secure token storage

### Student Features
- ✅ View personal dashboard
- ✅ Check attendance
- ✅ View marks/grades
- ✅ See class info

### Teacher Features
- ✅ View assigned classes
- ✅ See student roster
- ✅ Access class management tools
- ✅ Quick action menu

---

## 📝 Adding New Features

### Add a new screen:
1. Create file in `src/screens/`
2. Export component
3. Add to navigation in `App.js`

### Add API call:
```javascript
import api from '../services/api';

const fetchData = async () => {
  const response = await api.get('/endpoint/');
  return response.data;
};
```

### Add state management:
Use existing AuthContext as template in `src/context/`

---

## 🚢 Building for Production

### Android APK:
```bash
eas build --platform android --profile preview
```

### iOS App:
```bash
eas build --platform ios
```

Requires free EAS account.

---

## 💡 Tips

- **Hot reload**: Save file, app auto-updates
- **Debug**: Press `j` in Expo for debugger
- **Logs**: Check Terminal for console.log output
- **Network**: Toggle network in Expo menu (`m`)

---

## 📞 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| API 404 errors | Check endpoint exists in backend `/api/v1/` |
| 401 Unauthorized | Verify credentials, check token refresh logic |
| Blank dashboard | Check API response in debugger, verify data structure |
| Network timeout | Ensure backend server is running |
| Module not found | Run `npm install` again |

---

## 🎓 Learning Resources

- Expo docs: https://docs.expo.dev/
- React Native: https://reactnative.dev/
- React Navigation: https://reactnavigation.org/
- Axios: https://axios-http.com/

---

**Happy coding! 🎉**
