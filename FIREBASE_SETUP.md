# Firebase Setup Instructions

This document provides step-by-step instructions for setting up Firebase for the Quick Pickup application.

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Google Cloud account with billing enabled (for Firebase project)
- Node.js 18+ installed

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `quick-pickup-tripura` (or your preferred name)
4. Enable Google Analytics (optional for testing)
5. Click "Create project"

## Step 2: Enable Firebase Services

### Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Phone** authentication provider
4. Configure reCAPTCHA settings for testing
5. (Optional) Enable **Email/Password** provider for backup authentication

### Enable Firestore Database
1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **Test mode** (we'll deploy rules later)
4. Choose location: `asia-south1` (Mumbai, India - closest to Tripura)
5. Click "Enable"

### Enable Storage
1. Go to **Storage**
2. Click "Get started"
3. Start in **Test mode**
4. Use default location
5. Click "Done"

### Enable Cloud Messaging (FCM)
1. Go to **Cloud Messaging**
2. Note your Server Key and Sender ID (needed for push notifications)

## Step 3: Get Firebase Configuration

### For Backend (Node.js)
1. Go to **Project Settings** (gear icon)
2. Go to **Service accounts** tab
3. Click "Generate new private key"
4. Download the JSON file
5. **IMPORTANT:** Never commit this file to Git!
6. Place it in `backend/` directory as `serviceAccountKey.json`
7. Add to `.gitignore`: `serviceAccountKey.json`

### For Mobile App (React Native)
1. Go to **Project Settings**
2. Scroll to "Your apps" section
3. Click **Android** icon (or **iOS** for iOS)
4. Register app with package name: `com.quickpickup.app`
5. Download `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)
6. Place in appropriate directory:
   - Android: `mobile-app/android/app/google-services.json`
   - iOS: `mobile-app/ios/GoogleService-Info.plist`

### For Admin Dashboard (Web)
1. Go to **Project Settings**
2. Scroll to "Your apps"
3. Click **Web** icon (</>)
4. Register app with nickname: "Quick Pickup Admin"
5. Copy the Firebase config object
6. Create `admin-dashboard/src/config/firebase.js` with the config

## Step 4: Deploy Security Rules

### Deploy Firestore Rules
```bash
cd /path/to/QuckPickPrototype
firebase login
firebase init firestore
# Select existing project
# Accept default firestore.rules and firestore.indexes.json
firebase deploy --only firestore:rules
```

### Deploy Storage Rules
```bash
firebase init storage
# Accept default storage.rules
firebase deploy --only storage
```

## Step 5: Configure Environment Variables

### Backend (.env)
Create `backend/.env` file:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

PORT=3000
NODE_ENV=development

GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Mobile App
Create `mobile-app/.env`:
```env
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Admin Dashboard
Create `admin-dashboard/.env`:
```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

## Step 6: Create Admin User

Since users cannot self-assign admin role, create the first admin manually:

```bash
firebase login
firebase auth:import admin-user.json --project your-project-id
```

Create `admin-user.json`:
```json
{
  "users": [
    {
      "uid": "admin-001",
      "email": "admin@quickpickup.com",
      "phoneNumber": "+919876543210",
      "emailVerified": true,
      "displayName": "Admin User"
    }
  ]
}
```

Then manually add to Firestore `users` collection:
```javascript
{
  uid: "admin-001",
  email: "admin@quickpickup.com",
  phoneNumber: "+919876543210",
  name: "Admin User",
  role: "admin",
  createdAt: Firebase.Timestamp.now(),
  isActive: true
}
```

## Step 7: Enable Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** > **Library**
4. Enable the following APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps JavaScript API
   - Geocoding API
   - Directions API
   - Places API
5. Go to **Credentials**
6. Create API key
7. Restrict the key to your app (bundle ID for mobile, domain for web)

## Step 8: Test Configuration

### Test Backend Connection
```bash
cd backend
npm install
npm run dev
# Should see: "Firebase Admin SDK initialized successfully"
```

### Test Mobile App
```bash
cd mobile-app
npm install
npx react-native run-android  # or run-ios
# App should launch without Firebase errors
```

### Test Admin Dashboard
```bash
cd admin-dashboard
npm install
npm start
# Dashboard should load at http://localhost:3000
```

## Security Checklist

- [ ] Firestore security rules deployed
- [ ] Storage security rules deployed
- [ ] Service account key NOT committed to Git
- [ ] Environment variables configured
- [ ] Google Maps API key restricted
- [ ] Admin user created
- [ ] Test mode disabled (for production)
- [ ] Billing alerts configured

## Troubleshooting

### "Permission denied" errors
- Ensure security rules are deployed correctly
- Check that user is authenticated
- Verify user role in Firestore

### "Firebase not initialized"
- Check environment variables are loaded
- Verify service account key path
- Check Firebase config in code

### "API key invalid"
- Regenerate API key in Google Cloud Console
- Check API key restrictions
- Ensure required APIs are enabled

## Production Deployment Notes

Before public release:
1. Switch Firestore from test mode to production mode
2. Enable Firestore backups
3. Set up Firebase monitoring and alerts
4. Configure custom domain for admin dashboard
5. Enable Firebase App Check for security
6. Set up proper error tracking (Crashlytics)
7. Configure rate limiting on Firebase Functions
8. Review and tighten security rules

## Support

For issues with Firebase setup:
- Firebase Documentation: https://firebase.google.com/docs
- Firebase Support: https://firebase.google.com/support
