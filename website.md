# Driving School - Web Application Design Document

## 1. Project Overview
**Name**: Driving School
**Purpose**: A comprehensive management platform for driving schools, allowing seamless coordination between school owners, drivers (instructors), and students.
**Database**: Firebase Firestore (Real-time syncing)

---

## 2. Brand Identity & Styling
- **Primary Color**: `#2563eb` (Royal Blue - conveys trust and professionalism)
- **Secondary Color**: `#0f2044` (Deep Navy - used for headers and primary backgrounds)
- **Accent Color**: `#f59e0b` (Amber - used for alerts, pending statuses, and call-to-actions)
- **Background Color**: `#f8fafc` (Light Gray - clean and modern background)
- **Typography**: Inter or Roboto (Modern, clean sans-serif)

---

## 3. User Roles & Access Hierarchy


### 🏫 School Owner
- **Dashboard**: Specific to their individual driving school.
- **Features**:
  - Subscription management & payments.
  - Manage staff (Add/Remove instructors).
  - Manage students (Enrollments, fee tracking).
  - View school-specific analytics.

### 🧑‍🏫 Instructor (Driver)
- **Dashboard**: Daily schedule and student progress.
- **Features**:
  - View assigned students and their contact info.
  - Update student training progress (Classes attended).
  - Add new students on the go.

### 🎓 Student
- **Dashboard**: Personal progress and fee status.
- **Features**:
  - View attendance and classes completed (e.g., "5/15 Classes").
  - Check fee payment status (Paid/Pending).
  - Access driving license status.
  - Contact support or instructor directly via WhatsApp.

---

## 4. UI/UX Layouts (Web)

### A. Login Screen (Global Entry Point)
- **Layout**: Split screen. Left side with a driving school illustration/hero image. Right side with the login form.
- **Form**: Phone number input with role selection (School, Driver, Student).
- **Style**: Glassmorphism effect on the login card, centered on a deep navy background.

### B. Dashboard Layout (Standardized across roles)
- **Top Navbar**: Logo on the left, User Profile and Logout button on the right.
- **Sidebar (Collapsible)**:
  - Home / Dashboard
  - Users / Students
  - Payments / Fees
  - Settings
- **Main Content Area**:
  - **Top Row**: KPI Cards (e.g., Total Students, Pending Fees).
  - **Middle Row**: Data Tables or Lists (e.g., Recent Enrollments) with Search and Filter capabilities.
  - **Bottom Row**: Quick action buttons (Add Student, Mark Attendance).

### C. Modals & Interactions
- **Face Scan / Registration**: A clean modal that utilizes the device camera for student verification.
- **Payment Gateway**: A secure-looking overlay for subscription payments.
- **Notifications**: Toast notifications at the top right for success/error messages (e.g., "Student added successfully").

---

## 5. Technical Architecture (Frontend Web)
- **Framework**: React Native Web (Expo) / React.js
- **Routing**: React Navigation (Web configuration)
- **State Management**: React Context API (`AuthContext`, `DataContext`)
- **Real-time Sync**: Firebase Firestore snapshot listeners (`onSnapshot`)
- **Hosting**: Firebase Hosting or Vercel

---

## 6. Next Steps for Implementation
1. **Responsive Design**: Ensure the current Expo web views are fully responsive using CSS media queries or React Native `useWindowDimensions`.
2. **Web-Specific Components**: Replace native-only components (like native pickers) with web-friendly alternatives if necessary.
3. **SEO & Meta Tags**: Add appropriate meta tags in `public/index.html` for better web presence.
4. **Deploy**: Build using `expo export:web` and deploy to a web host.
