const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    trim: true
  },
  vehicleModel: {
    type: String,
    default: ''
  },
  licenseNumber: {
    type: String,
    default: ''
  },
  driverPhoto: {
    type: String,
    default: ''
  },
  assistantName: {
    type: String,
    default: ''
  },
  assistantPhone: {
    type: String,
    default: ''
  },
  assistantQualification: {
    type: String,
    default: ''
  },
  assistantCertNo: {
    type: String,
    default: ''
  },
  assistantPhoto: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: false
  },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  role: {
    type: String,
    default: 'driver'
  },
  totalRides: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5.0
  },
  fcmToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

DriverSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Driver', DriverSchema);
