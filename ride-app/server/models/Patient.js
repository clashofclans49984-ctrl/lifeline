const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  googleUid: {
    type: String,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    sparse: true
  },
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  photoURL: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'patient'
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Patient', PatientSchema);
