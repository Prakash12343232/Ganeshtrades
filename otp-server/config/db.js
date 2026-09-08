const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    if (process.env.NODE_ENV === 'test') {
      console.warn('[DB WARNING] MONGODB_URI not provided in test mode.');
      return null;
    }
    console.error('❌ [DB ERROR] MONGODB_URI environment variable is missing.');
    throw new Error('MONGODB_URI is required for production database connection.');
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`✅ [DB CONNECTED] MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`❌ [DB ERROR] MongoDB Connection Error: ${error.message}`);
    isConnected = false;
    throw error;
  }
};

module.exports = connectDB;
