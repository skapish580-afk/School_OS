# School OS - Mobile App

A React Native mobile application for students and teachers to access School OS on iOS and Android.

## Features

### Student Features
- 📱 Login with student credentials
- 📊 View academic dashboard
- 📈 Check attendance and percentage
- 📝 View grades and marks
- 👥 See classmates and teachers
- 📢 Receive announcements
- 📚 Access assignments

### Teacher Features
- 📱 Login with teacher credentials
- 📚 View assigned classes and sections
- 👥 Manage student roster
- ✏️ Mark attendance
- 📊 Enter grades and marks
- 📋 Create and manage assignments
- 📢 Send announcements to classes
- 📈 Track class performance

## Tech Stack

- **React Native** - Cross-platform mobile development
- **Expo** - Development platform for React Native
- **React Navigation** - Navigation library
- **Axios** - HTTP client for API calls
- **AsyncStorage** - Local device storage for tokens
- **Context API** - State management for authentication

## Project Structure

```
SchoolOS/
├── src/
│   ├── screens/            # Screen components
│   │   ├── LoginScreen.js
│   │   ├── StudentDashboardScreen.js
│   │   └── TeacherDashboardScreen.js
│   ├── components/         # Reusable components
│   ├── services/           # API services
│   │   └── api.js          # Axios instance and interceptors
│   └── context/            # React Context
│       └── AuthContext.js  # Authentication context
├── App.js                  # Main app component
├── index.js                # Entry point
└── package.json            # Dependencies
```

## Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode (macOS only)
- Android: Android Studio

### Installation Steps

1. **Navigate to mobile app directory**
   ```bash
   cd mobile/SchoolOS
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure API Base URL**
   
   Edit `src/services/api.js` and update the API_BASE URL:
   ```javascript
   const API_BASE = 'http://YOUR_BACKEND_IP:8000/api/v1';
   ```
   
   - For local development on Android emulator: `http://10.0.2.2:8000`
   - For iOS simulator: `http://localhost:8000`
   - For physical device: Use your computer's IP address (find with `ipconfig` on Windows)

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on device/simulator**
   
   **iOS:**
   ```bash
   i
   ```
   
   **Android:**
   ```bash
   a
   ```
   
   **Web:**
   ```bash
   w
   ```

## Login Credentials

### Student Account
- **Email**: `aarav.patel0@student.greenwood.edu`
- **Password**: `student123`
- **School**: Greenwood School

### Teacher Account
- **Email**: `john.smith@greenwood.edu`
- **Password**: `teacher123`
- **School**: Greenwood School

### Alternative Student
- **Email**: `aarav.patel0@student.oxford.edu`
- **Password**: `student123`
- **School**: Oxford Academy

## API Integration

The app communicates with the School OS Django REST API. Key endpoints used:

### Authentication
- `POST /auth/token/` - Login
- `POST /auth/token/refresh/` - Refresh token
- `GET /auth/me/` - Get current user

### Students
- `GET /students/me/` - Get student profile
- `GET /students/my-students/` - Get assigned students (teachers only)
- `GET /attendance/my-attendance/` - Get attendance records
- `GET /academics/my-marks/` - Get grade records

### Teachers
- `GET /teachers/me/` - Get teacher profile
- `GET /academics/my-sections/` - Get assigned sections/classes

## Features Implementation

### Authentication Flow
1. User enters email and password
2. App sends POST request to `/auth/token/`
3. Backend returns access and refresh tokens
4. Tokens stored in AsyncStorage
5. User redirected to appropriate dashboard (Student/Teacher)

### Token Management
- Access tokens automatically added to all API requests via interceptor
- When token expires (401 response), refresh token is used to get new access token
- Tokens stored securely in device AsyncStorage

### Dashboard Features
- **Pull-to-refresh** to update data
- **Loading indicators** while fetching data
- **Error handling** with user-friendly messages
- **Responsive design** for different screen sizes

## Development Tips

### Hot Reload
- Save file changes to automatically reload the app
- Use `r` in Expo CLI to manually reload
- Use `m` to toggle menu

### Debugging
- Use `j` in Expo CLI to open debugger
- Check console logs in Terminal
- Use React Native Debugger for advanced debugging

### Testing Credentials
Multiple test accounts available:
- Students and teachers across 2 schools
- Different experience levels

## Building for Production

### Android APK
```bash
eas build --platform android --profile preview
```

### iOS App
```bash
eas build --platform ios
```

Requires EAS account setup (free).

## Troubleshooting

### API Connection Issues
- Ensure Django server is running on backend
- Verify API_BASE URL is correct for your network
- Check firewall settings allow HTTP traffic
- On Android emulator, use `10.0.2.2` instead of `localhost`

### Token Expiry
- App automatically refreshes expired tokens
- If refresh fails, user is logged out and redirected to login
- Clear app cache if tokens become corrupted

### Performance Issues
- Disable animations in development settings
- Check network latency to backend
- Profile app using React Native Profiler

## File Size & Performance
- Minimal dependencies for fast load times
- Optimized component re-renders
- Lazy loading of data
- Efficient image handling with Expo Image

## Future Enhancements
- [ ] Offline mode with data sync
- [ ] Push notifications
- [ ] Real-time attendance updates
- [ ] Grade calculation display
- [ ] Communication/messaging module
- [ ] Assignment submissions
- [ ] Parent account access
- [ ] Dark mode support
- [ ] Multi-language support
- [ ] Biometric authentication

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation in backend README
3. Check Expo documentation: https://docs.expo.dev/
4. React Navigation docs: https://reactnavigation.org/

## License

School OS Mobile App - 2026
