# Quick Pickup - Testing Prototype

**A local ride and delivery platform for Kailashahar, Dharmanagar, and Kumarghat (Tripura)**

> **⚠️ Testing Prototype Only**: This app is for internal testing and development. Not for public deployment until government approvals are obtained.

## Overview

Quick Pickup is a dual-purpose mobile platform that combines:
- **Quick Ride** 🚗: Local ride-sharing (bike, auto, car)
- **Quick Pickup Express** 📦: Package delivery service

The app features real-time GPS tracking, driver verification, payment processing (mock), SOS emergency alerts, and Bengali language support.

## Project Structure

```
QuckPickPrototype/
├── mobile-app/          # React Native mobile app (Android/iOS)
├── backend/             # Node.js + Express API server
├── admin-dashboard/     # React admin web dashboard
├── firestore.rules      # Firestore security rules
├── storage.rules        # Firebase Storage security rules
└── FIREBASE_SETUP.md    # Firebase setup guide
```

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- React Native development environment
- Firebase account
- Google Maps API key

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with Firebase credentials
npm run dev
```

### Mobile App Setup

```bash
cd mobile-app
npm install
cp .env.example .env
# Edit .env with configuration
npx react-native run-android  # or run-ios
```

## Development Status

### ✅ Phase 1: Foundation (COMPLETED)
- Project structure initialized
- Firebase configuration
- Backend API with authentication
- Mobile app navigation
- Mock test data

### 🚧 Phase 2-6: In Progress
See full implementation plan in `planning.md`

## Mock Data

Seed script creates:
- 1 Admin: `+919876540001`
- 10 Users: `+919876543210` onwards
- 15 Drivers (5 bikes, 5 autos, 5 cars)

Run: `node backend/src/utils/seedData.js`

## License

MIT License - Testing prototype only

---

**Built for Tripura 🇮🇳 | v1.0.0**