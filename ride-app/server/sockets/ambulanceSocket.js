const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const fetch = require('node-fetch');

module.exports = function setupAmbulanceSocket(io, patientSockets, driverSockets) {

  io.on('connection', (socket) => {
    console.log(`[SOCKET] New connection: ${socket.id}`);

    // ─── Patient Connected ──────────────────────────────
    socket.on('register_patient', (data) => {
      const { patientId } = data;
      if (patientId) {
        patientSockets.set(patientId, socket.id);
        console.log(`[SOCKET] Patient ${patientId} registered on socket ${socket.id}`);
      }
    });

    // ─── Driver Connected ───────────────────────────────
    socket.on('register_driver', (data) => {
      const { driverId } = data;
      if (driverId) {
        driverSockets.set(driverId, socket.id);
        console.log(`[SOCKET] Driver ${driverId} registered on socket ${socket.id}`);
      }
    });

    // ─── Driver Go Online ───────────────────────────────
    socket.on('driver_online', async (data) => {
      try {
        const { driverId, lat, lng } = data;
        const updateData = { isActive: true };
        if (lat !== undefined && lng !== undefined) {
          updateData.location = {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          };
        }
        await Driver.findByIdAndUpdate(driverId, updateData);
        driverSockets.set(driverId, socket.id);
        console.log(`[SOCKET] Driver ${driverId} went ONLINE`);
      } catch (err) {
        console.error('[SOCKET] driver_online error:', err.message);
      }
    });

    // ─── Driver Go Offline ──────────────────────────────
    socket.on('driver_offline', async (data) => {
      try {
        const { driverId } = data;
        await Driver.findByIdAndUpdate(driverId, { isActive: false });
        console.log(`[SOCKET] Driver ${driverId} went OFFLINE`);
      } catch (err) {
        console.error('[SOCKET] driver_offline error:', err.message);
      }
    });

    // ─── Driver Location Update ─────────────────────────
    socket.on('driver_location_update', async (data) => {
      try {
        const { driverId, lat, lng, bookingId } = data;

        await Driver.findByIdAndUpdate(driverId, {
          location: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          }
        });

        if (bookingId) {
          const booking = await Booking.findById(bookingId);
          if (booking && booking.patientId) {
            let routeGeoJSON = null;
            let distanceMetres = 0;
            let estimatedMinutes = 0;

            try {
              const patientLng = booking.patientLocation.coordinates[0];
              const patientLat = booking.patientLocation.coordinates[1];
              const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${parseFloat(lng)},${parseFloat(lat)};${patientLng},${patientLat}?overview=full&geometries=geojson`;
              const osrmRes = await fetch(osrmUrl);
              const osrmData = await osrmRes.json();

              if (osrmData.routes && osrmData.routes[0]) {
                routeGeoJSON = osrmData.routes[0].geometry;
                distanceMetres = Math.round(osrmData.routes[0].distance);
                estimatedMinutes = Math.round(osrmData.routes[0].duration / 60);
              }
            } catch (osrmErr) {
              // OSRM may fail — continue without route
            }

            const patientSocketId = patientSockets.get(booking.patientId.toString());
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
        }
      } catch (err) {
        console.error('[SOCKET] driver_location_update error:', err.message);
      }
    });

    // ─── Disconnect ─────────────────────────────────────
    socket.on('disconnect', async () => {
      // Check patient sockets
      for (const [pid, sid] of patientSockets.entries()) {
        if (sid === socket.id) {
          patientSockets.delete(pid);
          console.log(`[SOCKET] Patient ${pid} disconnected`);
          break;
        }
      }

      // Check driver sockets — set offline
      for (const [did, sid] of driverSockets.entries()) {
        if (sid === socket.id) {
          driverSockets.delete(did);
          try {
            await Driver.findByIdAndUpdate(did, { isActive: false });
            console.log(`[SOCKET] Driver ${did} disconnected → set OFFLINE`);
          } catch (e) {
            console.error('[SOCKET] Disconnect driver update error:', e.message);
          }
          break;
        }
      }
    });
  });
};
