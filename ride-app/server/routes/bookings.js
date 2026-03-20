const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// ─── Create Booking ─────────────────────────────────────
router.post('/create', authMiddleware, requireRole('patient'), async (req, res) => {
  try {
    const { patientLat, patientLng, patientAddress } = req.body;

    if (!patientLat || !patientLng) {
      return res.status(400).json({ error: 'Patient coordinates required.' });
    }

    // Find active drivers within 10 km
    const nearbyDrivers = await Driver.find({
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(patientLng), parseFloat(patientLat)]
          },
          $maxDistance: 10000
        }
      }
    });

    const booking = new Booking({
      patientId: req.user.id,
      status: 'pending',
      patientLocation: {
        coordinates: [parseFloat(patientLng), parseFloat(patientLat)],
        address: patientAddress || ''
      }
    });
    await booking.save();

    // Emit to nearby drivers via Socket.io
    const io = req.app.get('io');
    const driverSockets = req.app.get('driverSockets');

    nearbyDrivers.forEach(driver => {
      const driverSocketId = driverSockets.get(driver._id.toString());
      if (driverSocketId) {
        io.to(driverSocketId).emit('new_ambulance_request', {
          bookingId: booking._id,
          patientLat: parseFloat(patientLat),
          patientLng: parseFloat(patientLng),
          patientAddress: patientAddress || 'Unknown location',
          patientName: 'Patient',
          timestamp: new Date().toISOString()
        });
        console.log(`[BOOKING] Notified driver ${driver._id} of emergency request ${booking._id}`);
      }
    });

    console.log(`[BOOKING] Emergency booking ${booking._id} created, ${nearbyDrivers.length} drivers notified`);
    res.status(201).json({
      bookingId: booking._id,
      nearbyDriverCount: nearbyDrivers.length,
      status: 'pending'
    });
  } catch (err) {
    console.error('[BOOKING] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
});

// ─── Accept Booking (atomic) ────────────────────────────
router.post('/:id/accept', authMiddleware, requireRole('driver'), async (req, res) => {
  try {
    // Atomic update prevents double-accept
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      {
        status: 'driver_assigned',
        driverId: req.user.id,
        acceptedAt: new Date()
      },
      { new: true }
    );

    if (!booking) {
      return res.status(409).json({ error: 'Booking already taken or not found.' });
    }

    const driver = await Driver.findById(req.user.id);

    // Fetch OSRM route
    let routeData = null;
    try {
      const driverLng = driver.location.coordinates[0];
      const driverLat = driver.location.coordinates[1];
      const patientLng = booking.patientLocation.coordinates[0];
      const patientLat = booking.patientLocation.coordinates[1];

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${patientLng},${patientLat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();

      if (osrmData.routes && osrmData.routes[0]) {
        routeData = osrmData.routes[0];
        booking.routeGeoJSON = routeData.geometry;
        booking.distanceMetres = Math.round(routeData.distance);
        booking.estimatedMinutes = Math.round(routeData.duration / 60);
        booking.driverLocation = {
          coordinates: [driverLng, driverLat]
        };
        await booking.save();
      }
    } catch (osrmErr) {
      console.error('[BOOKING] OSRM fetch error:', osrmErr.message);
    }

    const io = req.app.get('io');
    const patientSockets = req.app.get('patientSockets');
    const driverSockets = req.app.get('driverSockets');

    // Notify patient with full driver details
    const patientSocketId = patientSockets.get(booking.patientId.toString());
    if (patientSocketId) {
      io.to(patientSocketId).emit('booking_accepted', {
        bookingId: booking._id,
        driverName: driver.name,
        vehicleNumber: driver.vehicleNumber,
        driverLat: driver.location.coordinates[1],
        driverLng: driver.location.coordinates[0],
        routeGeoJSON: booking.routeGeoJSON,
        distanceMetres: booking.distanceMetres,
        estimatedMinutes: booking.estimatedMinutes,
        driverPhoto: driver.driverPhoto,
        assistantName: driver.assistantName,
        assistantPhoto: driver.assistantPhoto
      });
    }

    // Notify other drivers that booking is taken
    for (const [dId, sId] of driverSockets.entries()) {
      if (dId !== req.user.id.toString()) {
        io.to(sId).emit('booking_taken', {
          bookingId: booking._id,
          message: 'Request taken by another driver'
        });
      }
    }

    console.log(`[BOOKING] Booking ${booking._id} accepted by driver ${req.user.id}`);
    res.json({ booking });
  } catch (err) {
    console.error('[BOOKING] Accept error:', err.message);
    res.status(500).json({ error: 'Failed to accept booking.' });
  }
});

// ─── Cancel Booking ─────────────────────────────────────
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    booking.status = 'cancelled';
    await booking.save();

    const io = req.app.get('io');
    const patientSockets = req.app.get('patientSockets');
    const driverSockets = req.app.get('driverSockets');

    const patientSocketId = patientSockets.get(booking.patientId.toString());
    if (patientSocketId) {
      io.to(patientSocketId).emit('booking_cancelled', { bookingId: booking._id });
    }
    if (booking.driverId) {
      const driverSocketId = driverSockets.get(booking.driverId.toString());
      if (driverSocketId) {
        io.to(driverSocketId).emit('booking_cancelled', { bookingId: booking._id });
      }
    }

    console.log(`[BOOKING] Booking ${booking._id} cancelled`);
    res.json({ message: 'Booking cancelled.', booking });
  } catch (err) {
    console.error('[BOOKING] Cancel error:', err.message);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
});

// ─── Complete Booking ───────────────────────────────────
router.post('/:id/complete', authMiddleware, requireRole('driver'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    // Increment driver total rides
    await Driver.findByIdAndUpdate(req.user.id, { $inc: { totalRides: 1 } });

    const io = req.app.get('io');
    const patientSockets = req.app.get('patientSockets');
    const patientSocketId = patientSockets.get(booking.patientId.toString());
    if (patientSocketId) {
      io.to(patientSocketId).emit('ride_completed', {
        bookingId: booking._id,
        message: 'Ambulance has arrived. Help is here.'
      });
    }

    console.log(`[BOOKING] Booking ${booking._id} completed`);
    res.json({ message: 'Ride completed.', booking });
  } catch (err) {
    console.error('[BOOKING] Complete error:', err.message);
    res.status(500).json({ error: 'Failed to complete booking.' });
  }
});

// ─── Get Active Booking ─────────────────────────────────
router.get('/active', authMiddleware, async (req, res) => {
  try {
    let booking;
    if (req.user.role === 'patient') {
      booking = await Booking.findOne({
        patientId: req.user.id,
        status: { $in: ['pending', 'driver_assigned', 'driver_en_route', 'arrived'] }
      }).populate('driverId', 'name vehicleNumber vehicleModel rating driverPhoto assistantName assistantPhoto location phone');
    } else if (req.user.role === 'driver') {
      booking = await Booking.findOne({
        driverId: req.user.id,
        status: { $in: ['driver_assigned', 'driver_en_route', 'arrived'] }
      }).populate('patientId', 'name phone');
    }

    if (!booking) {
      return res.json({ booking: null });
    }

    res.json({ booking });
  } catch (err) {
    console.error('[BOOKING] Active query error:', err.message);
    res.status(500).json({ error: 'Failed to fetch active booking.' });
  }
});

// ─── Get Booking History ────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    let bookings;
    if (req.user.role === 'patient') {
      bookings = await Booking.find({
        patientId: req.user.id,
        status: { $in: ['completed', 'cancelled'] }
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('driverId', 'name vehicleNumber');
    } else if (req.user.role === 'driver') {
      bookings = await Booking.find({
        driverId: req.user.id,
        status: { $in: ['completed', 'cancelled'] }
      })
        .sort({ createdAt: -1 })
        .limit(5);
    }

    res.json({ bookings: bookings || [] });
  } catch (err) {
    console.error('[BOOKING] History error:', err.message);
    res.status(500).json({ error: 'Failed to fetch booking history.' });
  }
});

module.exports = router;
