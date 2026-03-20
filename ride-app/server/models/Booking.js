const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'driver_assigned', 'driver_en_route', 'arrived', 'completed', 'cancelled'],
    default: 'pending'
  },
  patientLocation: {
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    address: {
      type: String,
      default: ''
    }
  },
  driverLocation: {
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  routeGeoJSON: {
    type: Object,
    default: null
  },
  distanceMetres: {
    type: Number,
    default: 0
  },
  estimatedMinutes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
