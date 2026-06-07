# 📱 School OS Mobile App - Complete Structure

## 🎯 What You're Looking At

This is a **React Native + Expo** mobile app with a **Web version** visible at `http://localhost:8081`

---

## 📂 Folder Structure

```
SchoolOS/
│
├── 📄 index.js                 ← Entry point (imports App component)
├── 📄 App.js                   ← Root component (Navigation setup)
├── 📄 app.json                 ← App configuration (removed Expo Router)
├── 📄 tsconfig.json            ← TypeScript config
├── 📄 package.json             ← Dependencies
│
├── 📁 src/
│   ├── 📁 screens/             ← All UI screens
│   │   ├── LoginScreen.js      ← Login form (email + password)
│   │   ├── StudentDashboardScreen.js
│   │   └── TeacherDashboardScreen.js
│   │
│   ├── 📁 services/            ← API & external services
│   │   └── api.js              ← Axios HTTP client with token refresh
│   │
│   └── 📁 context/             ← React Context (state management)
│       └── AuthContext.js       ← Authentication state
│
├── 📁 assets/
│   └── 📁 images/
│       ├── icon.png
│       ├── favicon.png
│       └── (app icons)
│
├── 📁 node_modules/            ← Installed npm packages
│
└── 📄 FIX_REPORT.md            ← What was fixed
```

---

## 🔄 How the App Works

### 1️⃣ **Entry Point** (`index.js`)
```javascript
import App from './App';

// Just renders the App component with StatusBar
```

### 2️⃣ **Root Component** (`App.js`)
```javascript
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';

// Sets up:
// - AuthProvider (authentication state)
// - NavigationContainer (React Navigation)
// - RootNavigator (handles Login vs Dashboard routing)
```

### 3️⃣ **Authentication Context** (`src/context/AuthContext.js`)
Manages:
- User login/logout
- JWT token storage
- User type (STUDENT vs TEACHER)
- Loading states

### 4️⃣ **API Service** (`src/services/api.js`)
- Axios HTTP client
- Auto-add JWT token to requests
- Handle 401 errors (token refresh)
- Connect to `http://localhost:8000/api/v1`

### 5️⃣ **Screens**
- **LoginScreen**: Shows login form + role toggle
- **StudentDashboardScreen**: Shows student data
- **TeacherDashboardScreen**: Shows teacher data

---

## 🎨 What Should Display on `localhost:8081`

### Login Screen (Initial)
```
┌─────────────────────────────────┐
│                                 │
│      📱 School OS Mobile        │
│                                 │
│  ┌───────────────────────────┐  │
│  │  [Student] [Teacher]      │  │
│  └───────────────────────────┘  │
│                                 │
│  Email:                         │
│  ┌─────────────────────────────┐│
│  │ enter email...              ││
│  └─────────────────────────────┘│
│                                 │
│  Password:                      │
│  ┌─────────────────────────────┐│
│  │ enter password...           ││
│  └─────────────────────────────┘│
│                                 │
│      [   LOGIN BUTTON   ]       │
│                                 │
│  📝 Test Credentials:           │
│  student@greenwood.edu / 123    │
│  teacher@greenwood.edu / 123    │
│                                 │
└─────────────────────────────────┘
```

### Student Dashboard (After Login)
```
┌─────────────────────────────────┐
│ My Dashboard          [LOGOUT]   │ ← Blue Header
├─────────────────────────────────┤
│                                 │
│  Welcome back, Aarav! 👋        │
│  📍 Greenwood School            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📊 Attendance Stats         │ │
│ │ Present: 45/50 (90%)        │ │
│ │ Absent: 5                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📚 Latest Marks             │ │
│ │ English: A (95%)            │ │
│ │ Math: A+ (98%)              │ │
│ │ Science: A (92%)            │ │
│ └─────────────────────────────┘ │
│                                 │
│ Quick Access:                   │
│ [Assignments] [Results] [...]   │
│                                 │
└─────────────────────────────────┘
```

### Teacher Dashboard (After Login)
```
┌─────────────────────────────────┐
│ My Classes              [LOGOUT] │ ← Purple Header
├─────────────────────────────────┤
│                                 │
│  Welcome, John Smith! 👋        │
│  📍 Greenwood School            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ My Classes:                 │ │
│ │ Grade 10-A (45 students)    │ │
│ │ Grade 10-B (42 students)    │ │
│ │ Grade 11-A (38 students)    │ │
│ └─────────────────────────────┘ │
│                                 │
│ Teacher Tools:                  │
│ [Attendance] [Mark Entry]       │
│ [Assignments] [Announcements]   │
│                                 │
└─────────────────────────────────┘
```

---

## 🔑 Test Credentials

### Student Account
```
Email:    aarav.patel0@student.greenwood.edu
Password: student123
```
**Expected**: Student Dashboard with attendance, marks, school info

### Teacher Account
```
Email:    john.smith@greenwood.edu
Password: teacher123
```
**Expected**: Teacher Dashboard with classes, student count

---

## 🔄 Data Flow

```
Browser (localhost:8081)
         ↓
    index.js
         ↓
    App.js (Navigation)
         ↓
    AuthContext (State)
         ↓
    api.js (HTTP)
         ↓
Backend (localhost:8000)
  - POST /auth/token/
  - GET /students/me/
  - GET /teachers/me/
  - GET /attendance/my-attendance/
  - GET /academics/my-marks/
  - etc.
```

---

## 🎯 Key Features Working

✅ **Login System**
- Email/password authentication
- Role-based login (Student/Teacher)
- JWT token management
- Auto token refresh

✅ **Student Features**
- Personal dashboard
- Attendance statistics
- Latest grades/marks
- Pull-to-refresh
- School information

✅ **Teacher Features**
- Teacher dashboard
- Assigned classes list
- Student statistics
- Pull-to-refresh

✅ **API Integration**
- Axios configured
- Token auto-injection
- Error handling
- Loading states

---

## 🛠️ Common Components

### Button Component
```javascript
<TouchableOpacity onPress={handlePress}>
  <Text style={styles.button}>BUTTON TEXT</Text>
</TouchableOpacity>
```

### Input Field
```javascript
<TextInput
  placeholder="Enter text..."
  style={styles.input}
  value={value}
  onChangeText={setValue}
/>
```

### Card Layout
```javascript
<View style={styles.card}>
  <Text style={styles.cardTitle}>Title</Text>
  <Text style={styles.cardContent}>Content</Text>
</View>
```

---

## 📱 How to View Different Screens

1. **Login Screen** (Default)
   - Clear LocalStorage: Right-click → Inspect → Application → LocalStorage → Delete
   - Refresh page

2. **Student Dashboard**
   - Login with student credentials
   - You'll see blue header + student data

3. **Teacher Dashboard**
   - Login with teacher credentials
   - You'll see purple header + teacher data

---

## 🚀 Development Tools

### F12 Browser DevTools
- **Console**: App logs and errors
- **Network**: API calls to backend
- **Application**: LocalStorage (tokens stored here)
- **Elements**: React component structure

### React Navigation Debugger
- Press `j` in terminal while npm start running
- Opens React Navigation debugger in browser

### Expo Logs
- Check terminal for real-time logs
- Press `m` to toggle menu
- Press `r` to reload app

---

## 📚 File Dependency Map

```
index.js
  ↓
App.js
  ├── imports AuthProvider from src/context/AuthContext.js
  ├── imports LoginScreen from src/screens/LoginScreen.js
  ├── imports StudentDashboardScreen from src/screens/StudentDashboardScreen.js
  └── imports TeacherDashboardScreen from src/screens/TeacherDashboardScreen.js

src/context/AuthContext.js
  └── imports api from src/services/api.js

src/services/api.js
  └── Creates Axios instance pointing to localhost:8000

src/screens/LoginScreen.js
  └── imports useAuth from src/context/AuthContext.js

src/screens/StudentDashboardScreen.js
  ├── imports useAuth from src/context/AuthContext.js
  └── imports api from src/services/api.js

src/screens/TeacherDashboardScreen.js
  ├── imports useAuth from src/context/AuthContext.js
  └── imports api from src/services/api.js
```

---

## 🔗 API Endpoints Used

| Method | Endpoint | Purpose | Used By |
|--------|----------|---------|---------|
| POST | `/auth/token/` | Login | AuthContext |
| GET | `/students/me/` | Get student info | StudentDashboardScreen |
| GET | `/teachers/me/` | Get teacher info | TeacherDashboardScreen |
| GET | `/attendance/my-attendance/` | Get attendance | StudentDashboardScreen |
| GET | `/academics/my-marks/` | Get marks | StudentDashboardScreen |
| GET | `/academics/my-sections/` | Get classes | TeacherDashboardScreen |

---

## ✨ Status

- ✅ App structure complete
- ✅ Api configuration fixed
- ✅ Entry point corrected
- ✅ No more Expo Router conflicts
- ✅ Ready on localhost:8081

**Visit: http://localhost:8081** 🎉

