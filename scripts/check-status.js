const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lanka-ride');
  
  const users = await mongoose.connection.collection('users').find({ email: 'rmnlakshan@gmail.com' }).toArray();
  const driver = users[0];
  console.log('Driver user:', driver ? {
    _id: driver._id.toString(),
    name: driver.name,
    isOnline: driver.isOnline,
    currentLat: driver.currentLat,
    currentLng: driver.currentLng,
    locationUpdatedAt: driver.locationUpdatedAt,
    vehicleCategory: driver.vehicleCategory,
    isApproved: driver.isApproved
  } : 'Not found');

  if (driver) {
    const activeTrips = await mongoose.connection.collection('bookings').find({ 
      driverId: driver._id, 
      status: { $in: ['CONFIRMED', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PASSENGER_PICKED_UP', 'TRIP_IN_PROGRESS'] } 
    }).toArray();
    console.log('Active trips count:', activeTrips.length);
    console.log('Active trips:', activeTrips.map(t => ({ id: t._id.toString(), ref: t.bookingReference, status: t.status })));
  }

  const latestBookings = await mongoose.connection.collection('bookings').find().sort({ createdAt: -1 }).limit(5).toArray();
  console.log('Latest 5 bookings in DB:');
  for (const b of latestBookings) {
    console.log({
      id: b._id.toString(),
      ref: b.bookingReference,
      status: b.status,
      dispatchStatus: b.dispatchStatus,
      offeredDriverIds: (b.offeredDriverIds || []).map(id => id.toString()),
      vehicleCategory: b.vehicleCategory || b.pickMeDetails?.vehicleCategory,
      createdAt: b.createdAt
    });
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
