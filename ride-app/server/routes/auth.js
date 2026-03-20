const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Driver = require('../models/Driver');

// ─── Google Auth ────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'ID token required.' });
    }

    let decodedToken;
    try {
      const admin = require('firebase-admin');
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseErr) {
      console.error('[AUTH] Firebase verify error:', firebaseErr.message);
      return res.status(401).json({ error: 'Invalid Google token.' });
    }

    const { uid, name, email, picture } = decodedToken;

    let patient = await Patient.findOne({ googleUid: uid });
    if (!patient) {
      patient = new Patient({
        googleUid: uid,
        name: name || '',
        email: email || '',
        photoURL: picture || '',
        role: 'patient'
      });
      await patient.save();
      console.log(`[AUTH] New patient created via Google: ${email}`);
    }

    const token = jwt.sign(
      { id: patient._id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        photoURL: patient.photoURL,
        role: 'patient'
      }
    });
  } catch (err) {
    console.error('[AUTH] Google auth error:', err.message);
    res.status(500).json({ error: 'Server error during Google auth.' });
  }
});

// ─── Phone: Send OTP ────────────────────────────────────
router.post('/phone/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required.' });
    }

    // Generate 7-digit OTP
    const otp = Math.floor(1000000 + Math.random() * 9000000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    let patient = await Patient.findOne({ phone });
    if (!patient) {
      patient = new Patient({ phone, role: 'patient' });
    }
    patient.otp = otp;
    patient.otpExpiry = otpExpiry;
    await patient.save();

    console.log(`[AUTH] OTP for ${phone}: ${otp}`);

    // In production: send SMS via Twilio/MSG91
    // For development: return OTP in response
    res.json({
      message: 'OTP sent successfully.',
      otpForDev: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (err) {
    console.error('[AUTH] Send OTP error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// ─── Phone: Verify OTP ─────────────────────────────────
router.post('/phone/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required.' });
    }

    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Phone number not found. Please sign up first.' });
    }

    if (!patient.otp || patient.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    if (patient.otpExpiry && new Date() > patient.otpExpiry) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Clear OTP after successful verification
    patient.otp = null;
    patient.otpExpiry = null;
    await patient.save();

    const token = jwt.sign(
      { id: patient._id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AUTH] Patient verified via OTP: ${phone}`);
    res.json({
      token,
      user: {
        id: patient._id,
        name: patient.name,
        phone: patient.phone,
        role: 'patient'
      }
    });
  } catch (err) {
    console.error('[AUTH] Verify OTP error:', err.message);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// ─── Driver Register ────────────────────────────────────
router.post('/driver/register', async (req, res) => {
  try {
    const {
      name, email, password, phone,
      vehicleNumber, vehicleModel, licenseNumber,
      driverPhoto,
      assistantName, assistantPhone,
      assistantQualification, assistantCertNo, assistantPhoto
    } = req.body;

    if (!name || !email || !password || !vehicleNumber) {
      return res.status(400).json({ error: 'Name, email, password, and vehicle number are required.' });
    }

    const existing = await Driver.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const driver = new Driver({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone: phone || '',
      vehicleNumber,
      vehicleModel: vehicleModel || '',
      licenseNumber: licenseNumber || '',
      driverPhoto: driverPhoto || '',
      assistantName: assistantName || '',
      assistantPhone: assistantPhone || '',
      assistantQualification: assistantQualification || '',
      assistantCertNo: assistantCertNo || '',
      assistantPhoto: assistantPhoto || '',
      role: 'driver'
    });
    await driver.save();

    const token = jwt.sign(
      { id: driver._id, role: 'driver' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AUTH] Driver registered: ${email}`);
    res.status(201).json({
      message: 'Driver registered successfully.',
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        role: 'driver',
        vehicleNumber: driver.vehicleNumber,
        vehicleModel: driver.vehicleModel,
        driverPhoto: driver.driverPhoto,
        assistantName: driver.assistantName,
        assistantPhoto: driver.assistantPhoto
      }
    });
  } catch (err) {
    console.error('[AUTH] Driver register error:', err.message);
    res.status(500).json({ error: 'Server error during driver registration.' });
  }
});

// ─── Driver Login ───────────────────────────────────────
router.post('/driver/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: driver._id, role: 'driver' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AUTH] Driver logged in: ${email}`);
    res.json({
      token,
      user: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        role: 'driver',
        vehicleNumber: driver.vehicleNumber,
        vehicleModel: driver.vehicleModel,
        driverPhoto: driver.driverPhoto,
        assistantName: driver.assistantName,
        assistantPhoto: driver.assistantPhoto,
        rating: driver.rating,
        totalRides: driver.totalRides
      }
    });
  } catch (err) {
    console.error('[AUTH] Driver login error:', err.message);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

module.exports = router;
