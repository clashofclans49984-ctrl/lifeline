# Lifeline — Emergency Ambulance Dispatch

A full-stack emergency ambulance dispatch web application with real-time tracking, Socket.IO communication, and Web Audio siren alerts.

## Tech Stack

- **Backend:** Node.js, Express, MongoDB, Socket.IO, Firebase Admin
- **Frontend:** Vanilla HTML/CSS/JS, Leaflet maps, OSRM routing
- **Auth:** Firebase Google Sign-In, phone OTP, JWT

## Setup Steps

### 1. Install dependencies
```bash
cd server && npm install
```

### 2. Firebase setup
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project "lifeline-app"
3. **Authentication → Sign-in method → Enable Google + Phone**
4. Add `http://localhost:5000` to Authorized domains
5. **Project Settings → Service Accounts → Generate private key** → save as `server/firebase-service-account.json`
6. **Project Settings → General → Your Apps → Add web app** → copy `firebaseConfig` → paste into `client/shared/firebase-config.js`

### 3. Update environment
Edit `server/.env` with your values.

### 4. Start MongoDB
```bash
brew services start mongodb-community@7.0   # Mac
# OR: mongod                                # Windows/Linux
```

### 5. Create first driver account
Open [http://localhost:5000/driver/register.html](http://localhost:5000/driver/register.html) and fill all fields, upload both photos.

### 6. Start server
```bash
cd server && npm run dev
```

### 7. Open app
[http://localhost:5000](http://localhost:5000)

## Testing the Full Flow

1. Open `http://localhost:5000` → "Login as User" → sign in via phone OTP
2. In another tab: `http://localhost:5000/driver/dashboard.html` → Driver login → **Go Online**
3. Back in user tab: click **"Request Emergency Ambulance"**
4. Driver tab: siren plays + request panel appears → click **Accept**
5. User tab: Live Status shows driver photo + nurse photo + ETA
6. User tab: click **"Track Ambulance"** → see red route line on map with ambulance icon moving
7. Driver tab: click **"Mark as Arrived"** → ride completes

## Pages

| # | Page | Path |
|---|------|------|
| 1 | Landing | `/` |
| 2 | User Sign Up | `/signup.html` |
| 3 | OTP Verification | `/otp.html` |
| 4 | User Dashboard | `/dashboard.html` |
| 5 | Live Tracking | `/track.html` |
| 6 | Nearby Hospitals | `/hospitals.html` |
| 7 | Emergency Contacts | `/contacts.html` |
| 8 | Driver Registration | `/driver/register.html` |
| 9 | Driver Login | `/driver/login.html` |
| 10 | Driver Dashboard | `/driver/dashboard.html` |
