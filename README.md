# Driving School — Firebase Integrated

## Firebase Project
- Project: complisight-uat
- Database: driving_school_students (Firestore collection)

## Setup & Run

### Step 1 — Install
```bash
cd frontend
npm install
```

### Step 2 — Run on Android
```bash
npx expo start --android
```
(Android Studio + emulator OR Expo Go app on phone)

### Step 3 — First Run
App automatically:
1. Connects to Firebase Firestore
2. Seeds 3 demo students if empty
3. All data syncs real-time!

## How It Works
- Data → Firebase Firestore (real-time sync)
- Offline → Falls back to demo data
- All 3 roles work without login/auth

## Roles (Tap to enter)
| Role | Access |
|------|--------|
| 🏫 School Owner | Students, fees, staff, add |
| 🧑‍🏫 Instructor | Schedule, fees view, add student |
| 🎓 Student | Own progress, fees, license |

## Firestore Collection
`driving_school_students` — student records stored here
Real-time updates across all devices!

## Build APK
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```
