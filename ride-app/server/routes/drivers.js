const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// ─── Update Driver Location ────────────────────────────
router.post('/update-location', authMiddleware, requireRole('driver'), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude required.' });
    }

    await Driver.findByIdAndUpdate(req.user.id, {
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      }
    });

    // If driver has an active booking, fetch OSRM route and emit to patient
    const activeBooking = await Booking.findOne({
      driverId: req.user.id,
      status: { $in: ['driver_assigned', 'driver_en_route'] }
    });

    if (activeBooking) {
      let routeGeoJSON = null;
      let distanceMetres = 0;
      let estimatedMinutes = 0;

      try {
        const patientLng = activeBooking.patientLocation.coordinates[0];
        const patientLat = activeBooking.patientLocation.coordinates[1];
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${parseFloat(lng)},${parseFloat(lat)};${patientLng},${patientLat}?overview=full&geometries=geojson`;
        const osrmRes = await fetch(osrmUrl);
        const osrmData = await osrmRes.json();

        if (osrmData.routes && osrmData.routes[0]) {
          routeGeoJSON = osrmData.routes[0].geometry;
          distanceMetres = Math.round(osrmData.routes[0].distance);
          estimatedMinutes = Math.round(osrmData.routes[0].duration / 60);

          activeBooking.routeGeoJSON = routeGeoJSON;
          activeBooking.distanceMetres = distanceMetres;
          activeBooking.estimatedMinutes = estimatedMinutes;
          activeBooking.driverLocation = {
            coordinates: [parseFloat(lng), parseFloat(lat)]
          };
          await activeBooking.save();
        }
      } catch (osrmErr) {
        console.error('[DRIVER] OSRM error:', osrmErr.message);
      }

      const io = req.app.get('io');
      const patientSockets = req.app.get('patientSockets');
      const patientSocketId = patientSockets.get(activeBooking.patientId.toString());
      if (patientSocketId) {
        io.to(patientSocketId).emit('driver_moving', {
          driverLat: parseFloat(lat),
          driverLng: parseFloat(lng),
          routeGeoJSON,
          distanceMetres,
          estimatedMinutes
        });
      }
    }

    res.json({ message: 'Location updated.' });
  } catch (err) {
    console.error('[DRIVER] Location update error:', err.message);
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

// ─── Toggle Driver Status ──────────────────────────────
router.post('/toggle-status', authMiddleware, requireRole('driver'), async (req, res) => {
  try {
    const { isActive } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.user.id,
      { isActive: !!isActive },
      { new: true }
    );

    console.log(`[DRIVER] ${driver.name} is now ${isActive ? 'ONLINE' : 'OFFLINE'}`);
    res.json({ message: `Driver is now ${isActive ? 'online' : 'offline'}.`, isActive: driver.isActive });
  } catch (err) {
    console.error('[DRIVER] Status toggle error:', err.message);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

module.exports = router;
