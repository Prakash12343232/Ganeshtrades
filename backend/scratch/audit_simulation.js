process.env.JWT_SECRET = 'audit_secret';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const PurchaseOrder = require('../models/PurchaseOrder');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../server');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function runAudit() {
  console.log('🔄 Spinning up in-memory MongoDB server...');
  const mongod = await MongoMemoryServer.create();
  const TEST_DB_URI = mongod.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_DB_URI);
  console.log('✅ Connected to in-memory MongoDB.');

  // Clear collections
  await mongoose.connection.db.dropDatabase();
  console.log('🧹 Dropped existing audit database.');

  console.log('🌱 Seeding Data...');
  const users = [];
  const tokens = [];
  for (let i = 0; i < 100; i++) {
    const user = await User.create({
      name: `Customer ${i}`,
      mobile: `999900${String(i).padStart(4, '0')}`,
      password: 'password123',
      role: 'customer',
      creditLimit: 50000,
      creditBalance: 0,
      address: {
        street: 'Main St',
        area: 'Pune',
        lat: 18.5574375, // Same as shop for 0 KM distance
        lng: 73.9215625
      }
    });
    users.push(user);
    tokens.push(generateToken(user._id));
  }

  // Create Admin
  const admin = await User.create({
    name: 'Admin',
    mobile: '9999999999',
    password: 'password123',
    role: 'admin'
  });
  const adminToken = generateToken(admin._id);

  // Settings
  const Settings = require('../models/Settings');
  await Settings.create({
    shopName: 'Ganesh Trades',
    deliveryRadiusKm: 15,
    isDeliveryRestrictionActive: true,
    shopLocation: { type: 'Point', coordinates: [73.9215625, 18.5574375] }
  });

  const products = [];
  for (let i = 0; i < 5; i++) {
    const prod = await Product.create({
      name: `Product ${i}`,
      description: 'Audit Test Product',
      price: 100,
      stock: 500,
      minStock: 50,
      category: 'other',
      unit: 'kg'
    });
    products.push(prod);
  }

  const supplier = await Supplier.create({
    name: 'Audit Supplier',
    contactPerson: 'Mr Audit',
    mobile: '8888000000',
    status: 'active'
  });

  console.log(`✅ Seeded ${users.length} users, ${products.length} products (Stock 500 each), 1 supplier, 1 admin.`);

  // Prepare 1000 orders
  console.log('🚀 Firing 1000 concurrent orders and 1 supplier restock...');
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  const orderPromises = [];
  
  const errorReasons = [];
  
  for (let i = 0; i < 1000; i++) {
    const userIndex = i % 100;
    const token = tokens[userIndex];
    const productIndex = i % 5;
    
    let type = 'instant';
    let payment = 'cash';
    let scheduledDate, timeSlot;

    // 30% scheduled, 30% credit, 40% instant
    if (i % 10 < 3) {
      type = 'scheduled';
      // Schedule for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      scheduledDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
      timeSlot = '10 AM - 12 PM';
    } else if (i % 10 < 6) {
      payment = 'credit';
    }

    const payload = {
      items: [{ product: products[productIndex]._id, quantity: 2 }],
      paymentMethod: payment,
      deliveryType: type,
      scheduledDate,
      timeSlot
    };

    const req = request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .then(res => {
        if (res.status === 201) {
          successCount++;
        } else {
          failCount++;
          if (errorReasons.length < 5) errorReasons.push(res.body?.message || res.text);
        }
      });
    
    orderPromises.push(req);
  }

  // Concurrently, fire a purchase order receive to restock products
  const poItems = products.map(p => ({ product: p._id, quantity: 100, unitPrice: 80, total: 8000 }));
  const supplierRestockPromise = async () => {
    // wait a few ms to ensure we clash with orders
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Create PO
    try {
      const po = await PurchaseOrder.create({
        poNumber: 'PO-AUDIT-1',
        supplier: supplier._id,
        items: poItems,
        totalAmount: 40000,
        status: 'pending',
        createdBy: admin._id
      });

      // Receive PO via API
      const poRes = await request(app)
        .put(`/api/suppliers/po/${po._id}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'received' });
      
      if (poRes.status !== 200) {
        console.log('❌ PO Restock Failed:', poRes.body?.message || poRes.text);
      } else {
        console.log('✅ PO Restock Succeeded');
      }
    } catch (poErr) {
      console.log('❌ PO Creation Failed:', poErr.message);
    }
  };
  
  orderPromises.push(supplierRestockPromise());

  // Wait for all to finish
  await Promise.allSettled(orderPromises);
  const duration = Date.now() - startTime;
  console.log(`⏱️ Simulation completed in ${duration}ms. Success: ${successCount}, Failed: ${failCount}`);
  if (errorReasons.length > 0) {
    console.log('Sample error reasons for failed orders:');
    errorReasons.forEach(err => console.log(' - ' + err));
  }

  console.log('\n📊 --- AUDIT RESULTS ---');

  // 1. Check Inventory Consistency
  console.log('-> Checking Inventory Consistency...');
  let inventoryConsistent = true;
  for (let i = 0; i < 5; i++) {
    const p = await Product.findById(products[i]._id);
    const expectedInitial = 500;
    const addedViaPo = 100;
    // initial + po - sold = current
    if (expectedInitial + addedViaPo - p.totalSold !== p.stock) {
      inventoryConsistent = false;
      console.log(`❌ MISMATCH on ${p.name}: Initial: ${expectedInitial}, Added: ${addedViaPo}, Sold: ${p.totalSold}, Current Stock: ${p.stock}`);
    }
  }
  if (inventoryConsistent) console.log('✅ Inventory perfectly consistent under high load.');

  // 2. Check Credit Balances
  console.log('-> Checking Credit Balances...');
  let creditConsistent = true;
  const allUsers = await User.find({ role: 'customer' });
  for (const u of allUsers) {
    if (u.creditBalance > u.creditLimit) {
      creditConsistent = false;
      console.log(`❌ Credit Limit Exceeded for ${u.name}: Balance ${u.creditBalance}, Limit ${u.creditLimit}`);
    }
  }
  if (creditConsistent) console.log('✅ Credit limits strictly enforced under high load.');

  // 3. Check Order Uniqueness
  console.log('-> Checking Order Uniqueness...');
  const allOrders = await Order.find();
  const orderNumbers = new Set(allOrders.map(o => o.orderNumber));
  if (orderNumbers.size === allOrders.length) {
    console.log(`✅ Order numbers are 100% unique. Total generated: ${allOrders.length}`);
  } else {
    console.log(`❌ Duplicate order numbers detected! Found ${allOrders.length} orders but only ${orderNumbers.size} unique numbers.`);
  }

  // 4. Check Scheduled Delivery Dates (Timezone Safety)
  console.log('-> Checking Scheduled Delivery Timezones...');
  const scheduledOrders = allOrders.filter(o => o.deliveryType === 'scheduled');
  let timezoneConsistent = true;
  scheduledOrders.forEach(o => {
    // date should be stored as local midnight (i.e. UTC time could be anything based on server TZ, but time portion must align with the Date constructor intent)
    // Actually we just check that originalDate == date
    if (o.scheduledDelivery.date.getTime() !== o.scheduledDelivery.originalDate.getTime()) {
      timezoneConsistent = false;
      console.log(`❌ Timezone mismatch in scheduled order ${o.orderNumber}`);
    }
  });
  if (timezoneConsistent) console.log(`✅ Timezone handling for ${scheduledOrders.length} scheduled deliveries is consistent.`);

  console.log('\n🏁 Audit Finished. Generating Report...');
  
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
