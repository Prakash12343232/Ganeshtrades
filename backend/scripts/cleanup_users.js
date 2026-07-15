const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const User = require('../models/User');

const cleanupAndCreateAdmins = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // List of demo mobile numbers to delete
    const demoMobiles = ['9999999999', '8888888888', '7777777777', '6666666666', '6555555555'];
    
    console.log('Deleting demo users...');
    const deleteResult = await User.deleteMany({ mobile: { $in: demoMobiles } });
    console.log(`✅ Deleted ${deleteResult.deletedCount} demo/fake users.`);

    // Password for new admins
    const adminPassword = process.env.ADMIN_PASSWORD || 'SecureAdmin@123';

    // Create Founder Admin if not exists
    const founderMobile = '8010412539';
    let founder = await User.findOne({ mobile: founderMobile });
    if (!founder) {
      founder = await User.create({
        name: 'Founder',
        mobile: founderMobile,
        email: 'founder@ganeshtrades.com',
        password: adminPassword,
        role: 'admin',
        customerType: 'public',
        address: { street: 'Main Road', area: 'Market Area', city: 'Local', pincode: '500001' }
      });
      console.log(`✅ Created Founder Admin account (${founderMobile})`);
    } else {
      console.log(`ℹ️ Founder Admin account (${founderMobile}) already exists.`);
      if (founder.role !== 'admin') {
        founder.role = 'admin';
        await founder.save();
        console.log(`✅ Updated Founder to admin role.`);
      }
    }

    // Create Shop Owner Admin if not exists
    const ownerMobile = '8898289887';
    let owner = await User.findOne({ mobile: ownerMobile });
    if (!owner) {
      owner = await User.create({
        name: 'Shop Owner',
        mobile: ownerMobile,
        email: 'owner@ganeshtrades.com',
        password: adminPassword,
        role: 'admin',
        customerType: 'public',
        address: { street: 'Main Road', area: 'Market Area', city: 'Local', pincode: '500001' }
      });
      console.log(`✅ Created Shop Owner Admin account (${ownerMobile})`);
    } else {
      console.log(`ℹ️ Shop Owner Admin account (${ownerMobile}) already exists.`);
      if (owner.role !== 'admin') {
        owner.role = 'admin';
        await owner.save();
        console.log(`✅ Updated Shop Owner to admin role.`);
      }
    }

    console.log('✅ Cleanup and admin setup complete!');
    console.log(`Make sure to change the default password (${adminPassword}) upon login.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
};

cleanupAndCreateAdmins();
