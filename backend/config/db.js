const mongoose = require('mongoose');
const crypto = require('crypto');

const connectDB = async () => {
  if (process.env.NODE_ENV === 'test') return;
  
  try {
    console.log('Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // fail fast if Atlas is unreachable
    });
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      console.error('Production database connection failed. Refusing to start with an in-memory fallback.');
      process.exit(1);
    }

    console.warn('⚠️ Atlas is unreachable. Falling back to an in-memory database for local development only...');
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`✅ Automatic Fix Applied: In-Memory MongoDB Connected at ${conn.connection.host}`);
      
      // Auto-seed so sandbox works
      await seedInMemory();
    } catch (memError) {
      console.error(`❌ Critical Database Failure: ${memError.message}`);
      process.exit(1);
    }
  }
};

async function seedInMemory() {
  const User = require('../models/User');
  const Product = require('../models/Product');
  const Settings = require('../models/Settings');
  const bcrypt = require('bcryptjs');

  const userCount = await User.countDocuments();
  if (userCount > 0) return; // Already seeded

  console.log('🌱 Seeding in-memory database...');

  await Settings.create({ shopLocation: { lat: 28.6139, lng: 77.2090 }, deliveryRadiusKm: 15 });

  const demoPassword = process.env.DEMO_ADMIN_PASSWORD && process.env.DEMO_ADMIN_PASSWORD.length >= 8
    ? process.env.DEMO_ADMIN_PASSWORD
    : 'admin123';

  await User.create({
    name: 'Ganesh Admin', mobile: '9999999999', email: 'admin@ganeshtrades.com',
    password: demoPassword, role: 'admin', customerType: 'public',
    address: { street: 'Main Road', area: 'Market Area', city: 'Local', pincode: '500001' }
  });

  await User.create({
    name: 'Manager User', mobile: '8888888888', email: 'manager@ganeshtrades.com',
    password: 'manager123', role: 'manager', customerType: 'public'
  });

  await User.insertMany([
    { name: 'Rahul Kumar', mobile: '7777777777', password: await bcrypt.hash('pass123', 12), customerType: 'public', address: { street: '12 Park Street', area: 'Gandhi Nagar', city: 'Local', pincode: '500002' } },
    { name: 'Hotel Paradise', mobile: '6666666666', password: await bcrypt.hash('pass123', 12), customerType: 'hotel', address: { street: '5 MG Road', area: 'Commercial Area', city: 'Local', pincode: '500003' } },
    { name: 'PG Comfort Stay', mobile: '6555555555', password: await bcrypt.hash('pass123', 12), customerType: 'pg_hostel', address: { street: '8 College Road', area: 'University Area', city: 'Local', pincode: '500004' } },
  ]);

  const products = [
    { name: 'Basmati Rice (Premium)', category: 'rice_grains', price: 120, wholesalePrice: 105, stock: 200, minStock: 20, unit: 'kg', description: 'Premium quality aged basmati rice' },
    { name: 'Sona Masoori Rice', category: 'rice_grains', price: 55, wholesalePrice: 48, stock: 300, minStock: 30, unit: 'kg', description: 'Daily use rice, light and fluffy' },
    { name: 'Toor Dal', category: 'dal_pulses', price: 140, wholesalePrice: 125, stock: 150, minStock: 15, unit: 'kg', description: 'Fresh toor dal for daily cooking' },
    { name: 'Moong Dal', category: 'dal_pulses', price: 120, wholesalePrice: 108, stock: 100, minStock: 10, unit: 'kg', description: 'Yellow moong dal, cleaned' },
    { name: 'Chana Dal', category: 'dal_pulses', price: 85, wholesalePrice: 75, stock: 120, minStock: 12, unit: 'kg', description: 'Premium chana dal' },
    { name: 'Turmeric Powder', category: 'spices', price: 220, wholesalePrice: 195, stock: 80, minStock: 8, unit: 'kg', description: 'Pure turmeric powder' },
    { name: 'Red Chilli Powder', category: 'spices', price: 280, wholesalePrice: 250, stock: 60, minStock: 8, unit: 'kg', description: 'Premium red chilli powder' },
    { name: 'Cumin Seeds', category: 'spices', price: 350, wholesalePrice: 310, stock: 40, minStock: 5, unit: 'kg', description: 'Whole cumin seeds' },
    { name: 'Sunflower Oil', category: 'oil_ghee', price: 150, wholesalePrice: 135, stock: 100, minStock: 10, unit: 'l', description: 'Refined sunflower oil' },
    { name: 'Pure Ghee', category: 'oil_ghee', price: 550, wholesalePrice: 500, stock: 50, minStock: 5, unit: 'kg', description: 'Pure cow ghee' },
    { name: 'Wheat Flour (Atta)', category: 'flour', price: 45, wholesalePrice: 38, stock: 250, minStock: 25, unit: 'kg', description: 'Fresh wheat atta' },
    { name: 'Sugar', category: 'sugar_jaggery', price: 42, wholesalePrice: 38, stock: 300, minStock: 30, unit: 'kg', description: 'White crystal sugar' },
    { name: 'Jaggery (Gud)', category: 'sugar_jaggery', price: 60, wholesalePrice: 52, stock: 100, minStock: 10, unit: 'kg', description: 'Organic jaggery' },
    { name: 'Tea Powder (Brooke Bond)', category: 'tea_coffee', price: 420, wholesalePrice: 380, stock: 70, minStock: 7, unit: 'kg', description: 'Premium tea powder' },
    { name: 'Coffee Powder', category: 'tea_coffee', price: 380, wholesalePrice: 340, stock: 40, minStock: 5, unit: 'kg', description: 'Filter coffee powder' },
    { name: 'Cashew Nuts', category: 'dry_fruits', price: 850, wholesalePrice: 780, stock: 30, minStock: 5, unit: 'kg', description: 'Whole cashew nuts W320' },
    { name: 'Almonds', category: 'dry_fruits', price: 750, wholesalePrice: 680, stock: 25, minStock: 5, unit: 'kg', description: 'California almonds' },
    { name: 'Surf Excel Powder', category: 'cleaning', price: 180, wholesalePrice: 160, stock: 80, minStock: 8, unit: 'kg', description: 'Washing powder' },
    { name: 'Vim Dishwash Bar', category: 'cleaning', price: 25, wholesalePrice: 22, stock: 200, minStock: 20, unit: 'piece', description: 'Dishwash bar 200g' },
    { name: 'Maggi Noodles', category: 'packaged_food', price: 14, wholesalePrice: 12, stock: 500, minStock: 50, unit: 'packet', description: 'Instant noodles 70g' },
  ];

  await Product.insertMany(products);

  console.log('✅ In-memory database seeded with demo data!');
}

module.exports = connectDB;
