# Mobile App - FIXED & READY TO USE! 🎉

## ✅ What Was Fixed

1. **Missing Dependencies**: Added `axios`, `@react-native-async-storage/async-storage`, and `@react-navigation/native-stack` to package.json
2. **Configuration Mismatch**: Removed `expo-router` from app.json (we use React Navigation)
3. **Entry Point**: Fixed package.json main entry from `expo-router/entry` to `index.js`

## 🚀 How to Run

### Start the Server
```bash
cd mobile/SchoolOS
npm start
```

You'll see output like:
```
› Metro waiting on exp://192.168.x.x:8081 (or 8082 if 8081 is busy)
› Web is waiting on http://localhost:8081
```

### Access the Web Version
**In your browser, go to: `http://localhost:8081`** (or 8082 if you see that port in the terminal)

## 📱 Test Credentials

### Student Login
```
Email: aarav.patel0@student.greenwood.edu
Password: student123
```

### Teacher Login  
```
Email: john.smith@greenwood.edu
Password: teacher123
```

## ⚠️ Important: Configure Backend URL

Before logging in, you MUST configure the backend API URL:

**File**: `src/services/api.js`  
**Line 4**: Update `API_BASE` value

### For Different Environments:
- **Windows/Mac local machine**: `http://localhost:8000/api/v1`
- **Android Emulator**: `http://10.0.2.2:8000/api/v1` 
- **iOS Simulator**: `http://localhost:8000/api/v1`
- **Physical Device**: `http://{YOUR_COMPUTER_IP}:8000/api/v1`

Example (find your IP):
```bash
# Windows: In PowerShell
ipconfig | Select-String IPv4
```

Replace `{YOUR_IP}` in `api.js`:
```javascript
const API_BASE = 'http://192.168.x.x:8000/api/v1'; // Use YOUR IP
```

## 🔧 Troubleshooting

### "Port 8081 is already in use"
The app automatically switches to 8082. Check your terminal output for the actual port.

### "Metro waiting but nothing loads"
1. Check that `API_BASE` in `src/services/api.js` is configured
2. Verify backend is running: `python manage.py runserver` in the backend folder
3. Make sure your firewall allows connections on port 8000

### App shows login screen but login doesn't work
- Verify `API_BASE` URL is correct
- Ensure backend server is running
- Check "Response Interceptor" section in `src/services/api.js`

### "Can't find module" errors
Run `npm install` to ensure all dependencies are installed:
```bash
npm install
```

## 🧪 What to Test

1. **Login Screen**
   - Toggle between Student/Teacher
   - Try wrong credentials (should show error)
   - Login with correct credentials

2. **Student Dashboard**
   - Should show student name and school
   - Attendance stats should load
   - Latest marks should display
   - Pull to refresh should work

3. **Teacher Dashboard**
   - Should show teacher name and qualifications  
   - Assigned classes should list
   - Student count should display
   - Pull to refresh should work

## 📂 Project Structure
```
mobile/SchoolOS/
├── src/
│   ├── context/          # Authentication state (AuthContext.js)
│   ├── services/         # API client (api.js)
│   ├── screens/          # React components (Login, Dashboards)
│   └── components/       # Reusable UI components
├── App.js                # Root navigation
├── index.js              # Entry point
├── package.json          # Dependencies
├── app.json              # Expo configuration
└── QUICKSTART.md         # Original guide
```

## 🔌 API Endpoints Used

### Authentication
- `POST /auth/token/` - Login (returns access_token, refresh_token)
- `POST /auth/token/refresh/` - Token refresh

### Student Endpoints
- `GET /students/me/` - Current student profile
- `GET /attendance/my-attendance/` - Attendance records
- `GET /academics/my-marks/` - Grades/marks

### Teacher Endpoints
- `GET /teachers/me/` - Current teacher profile
- `GET /academics/my-sections/` - Assigned classes
- `GET /students/my-students/` - Class roster

## ✨ Features

✅ Cross-platform (iOS, Android, Web)  
✅ JWT authentication with token refresh  
✅ Role-based dashboards (Student vs Teacher)  
✅ Pull-to-refresh data  
✅ Automatic token injection in API calls  
✅ Error handling and loading states  
✅ AsyncStorage for persistent token storage  

## 🎯 Next Steps

1. **Configure API_BASE** in `src/services/api.js`
2. **Start backend**: `python manage.py runserver`
3. **Start mobile app**: `npm start`
4. **Open in browser**: `http://localhost:8081`
5. **Login** and explore!

## 📞 Need Help?

- Check MOBILE_README.md for detailed documentation
- Verify backend is running on http://localhost:8000
- Check terminal logs for specific error messages
- Try `npm install` if you see module errors

---

**Status: ✅ READY TO USE!**

*The app is now configured correctly and should work seamlessly with your backend API.*
