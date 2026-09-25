const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/lanka-airport-ride');
  
  // Try to find the package named "qqqqqqqq" or any package and publish it
  const db = mongoose.connection.useDb('lanka-airport-ride');
  const result = await db.collection('packages').updateMany(
    {},
    { $set: { status: 'PUBLISHED' } }
  );
  
  console.log(`Updated ${result.modifiedCount} packages to PUBLISHED.`);
  mongoose.disconnect();
}

run();
