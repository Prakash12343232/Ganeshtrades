const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const Settings = require('../models/Settings');

const seedDB = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to MongoDB Atlas');
    } catch (e) {
      console.error(`❌ Atlas connection failed: ${e.message}`);
      console.warn('⚠️ Falling back to in-memory DB for seeding to prevent crash...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      console.log('✅ Connected to In-Memory DB');
    }

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Settings.deleteMany({});

    // Create default settings (Ganesh Trades, Pune - Plus Code: HW4C+XJ)
    await Settings.create({
      shopName: 'Ganesh Trades',
      shopAddress: 'HW4C+XJ Pune, Maharashtra, India',
      shopPlusCode: 'HW4C+XJ',
      shopLocation: { lat: 18.5574375, lng: 73.9215625 },
      deliveryRadiusKm: 15,
      isDeliveryRestrictionActive: true,
      deliveryFeePerKm: 0,
      freeDeliveryWithinKm: 5
    });

    const adminPassword = process.env.ADMIN_PASSWORD || 'SecureAdmin@123';

    // Create Founder Admin
    await User.create({
      name: 'Founder', 
      mobile: '8010412539', 
      email: 'founder@ganeshtrades.com',
      password: adminPassword, 
      role: 'admin', 
      customerType: 'public',
      address: { street: 'Main Road', area: 'Market Area', city: 'Local', pincode: '500001' }
    });

    // Create Shop Owner Admin
    await User.create({
      name: 'Shop Owner', 
      mobile: '8898289887', 
      email: 'owner@ganeshtrades.com',
      password: adminPassword, 
      role: 'admin', 
      customerType: 'public',
      address: { street: 'Main Road', area: 'Market Area', city: 'Local', pincode: '500001' }
    });

    // Create products
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

    console.log('✅ Database seeded successfully!');
    console.log(`Admin accounts created for 8010412539 and 8898289887.`);
    console.log(`Default Password: ${adminPassword}`);
    console.log(`Please change passwords after first login!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedDB();
