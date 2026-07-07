const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Try connecting to the configured MongoDB URI first
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`⚠️  Could not connect to MongoDB at ${process.env.MONGODB_URI}`);
    console.log('📦 Starting in-memory MongoDB server...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`✅ In-Memory MongoDB Connected: ${conn.connection.host}`);
      console.log('⚠️  Data will be lost when server restarts. Use a real MongoDB for persistence.');

      // Auto-seed when using in-memory DB
      await seedInMemory();
    } catch (memError) {
      console.error(`❌ MongoDB Connection Error: ${memError.message}`);
      process.exit(1);
    }
  }
};

async function seedInMemory() {
  const User = require('../models/User');
  const Product = require('../models/Product');
  const bcrypt = require('bcryptjs');

  const userCount = await User.countDocuments();
  if (userCount > 0) return; // Already seeded

  console.log('🌱 Seeding in-memory database...');

  // Create admin
  await User.create({
    name: 'Ganesh Admin', mobile: '9999999999', email: 'admin@ganeshtrades.com',
    password: 'admin123', role: 'admin', customerType: 'public',
    address: { street: 'Main Road', area: 'Market Area', city: 'Local', pincode: '500001' }
  });

  // Create manager
  await User.create({
    name: 'Manager User', mobile: '8888888888', email: 'manager@ganeshtrades.com',
    password: 'manager123', role: 'manager', customerType: 'public'
  });

  // Create sample customers
  await User.insertMany([
    { name: 'Rahul Kumar', mobile: '7777777777', password: await bcrypt.hash('pass123', 12), customerType: 'public', address: { street: '12 Park Street', area: 'Gandhi Nagar', city: 'Local', pincode: '500002' } },
    { name: 'Hotel Paradise', mobile: '6666666666', password: await bcrypt.hash('pass123', 12), customerType: 'hotel', address: { street: '5 MG Road', area: 'Commercial Area', city: 'Local', pincode: '500003' } },
    { name: 'PG Comfort Stay', mobile: '9555555555', password: await bcrypt.hash('pass123', 12), customerType: 'pg_hostel', address: { street: '8 College Road', area: 'University Area', city: 'Local', pincode: '500004' } },
  ]);

  // Create products
  await Product.insertMany([
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
  ]);

  console.log('✅ In-memory database seeded with demo data!');
  console.log('   Admin: 9999999999 / admin123');
  console.log('   Manager: 8888888888 / manager123');
  console.log('   Customer: 7777777777 / pass123');
}

module.exports = connectDB;
