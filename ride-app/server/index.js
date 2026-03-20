require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const driverRoutes = require('./routes/drivers');
const setupAmbulanceSocket = require('./sockets/ambulanceSocket');
const Driver = require('./models/Driver');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Middleware ──────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Socket Maps ────────────────────────────────────────
const patientSockets = new Map();
const driverSockets = new Map();
app.set('io', io);
app.set('patientSockets', patientSockets);
app.set('driverSockets', driverSockets);

// ─── API Routes (BEFORE static) ─────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/drivers', driverRoutes);

// ─── Health Check ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve Client (AFTER api routes) ────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ─── Setup Socket.io ────────────────────────────────────
setupAmbulanceSocket(io, patientSockets, driverSockets);

// ─── Firebase Admin Init ────────────────────────────────
try {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const fs = require('fs');
    const saPath = path.resolve(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json');
    if (fs.existsSync(saPath)) {
      const serviceAccount = require(saPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('🔥 Firebase Admin initialized');
    } else {
      console.log('⚠️  Firebase service account not found — Google auth will not work');
    }
  }
} catch (err) {
  console.log('⚠️  Firebase Admin init skipped:', err.message);
}

// ─── Connect to MongoDB & Start Server ──────────────────
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lifeline';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Set all drivers offline on server restart
    try {
      const result = await Driver.updateMany({}, { isActive: false });
      console.log(`🔄 Reset ${result.modifiedCount} drivers to offline`);
    } catch (e) {
      console.log('⚠️  Could not reset drivers:', e.message);
    }

    server.listen(PORT, () => {
      console.log(`🚑 Lifeline server running on http://localhost:${PORT}`);
      console.log(`📂 Client served from ${path.join(__dirname, '../client')}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Starting server without MongoDB for testing...');
    server.listen(PORT, () => {
      console.log(`🚑 Lifeline server running on http://localhost:${PORT} (NO DB)`);
    });
  });

module.exports = { app, server, io };
