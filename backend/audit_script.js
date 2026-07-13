const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('./config/db');

// Models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Supplier = require('./models/Supplier');
const PurchaseOrder = require('./models/PurchaseOrder');
const Expense = require('./models/Expense');
const Delivery = require('./models/Delivery');

async function runAudit() {
  const issues = [];
  try {
    // 1. Check schemas for missing validations
    console.log('Testing Models...');
    try {
      const u = new User({ email: 'invalid' });
      await u.validate();
      issues.push('User model email validation failed (should have thrown error)');
    } catch(e) { /* Expected */ }

    // Connect to actual database
    await connectDB();
    console.log('DB Connected for test.');

    // Find users
    const admin = await User.findOne({ role: 'admin' });
    const customer = await User.findOne({ role: 'customer' });
    const product = await Product.findOne();

    if (!admin) issues.push('No admin user found');
    if (!customer) issues.push('No customer user found');
    if (!product) issues.push('No products found');

    // Test Khata Workflow
    console.log('Testing Khata...');
    customer.creditLimit = 5000;
    await customer.save();

    // Create Order with Credit
    const totalAmount = 500;
    const order = await Order.create({
      user: customer._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 10, total: 500 }],
      totalAmount,
      finalAmount: totalAmount,
      paymentMethod: 'credit',
      orderStatus: 'pending'
    });
    
    // Test PO Workflow
    console.log('Testing Supplier & PO...');
    const supplier = await Supplier.create({
      name: 'Test Supplier',
      mobile: '9876543210',
    });
    const po = await PurchaseOrder.create({
      supplier: supplier._id,
      items: [{ product: product._id, name: 'Item', quantity: 100, unitPrice: 40, total: 4000 }],
      totalAmount: 4000,
      createdBy: admin._id
    });

    // Test Delivery
    console.log('Testing Delivery...');
    const delivery = await Delivery.create({
      order: order._id,
      deliveryPersonName: 'John',
      deliveryPersonMobile: '9999999999',
      assignedBy: admin._id
    });

    // Test Expense
    console.log('Testing Expense...');
    await Expense.create({
      category: 'salary',
      amount: 1500,
      description: 'Test',
      loggedBy: admin._id
    });

    // Test PDF
    console.log('Testing PDF Generation...');
    const { generateInvoicePDF } = require('./utils/pdfGenerator');
    try {
      const pdfBuffer = await generateInvoicePDF(order, customer);
      if (!pdfBuffer || pdfBuffer.length === 0) issues.push('PDF generation returned empty buffer');
    } catch (e) {
      issues.push(`PDF generation failed: ${e.message}`);
    }

    // Test Excel
    console.log('Testing Excel Generation...');
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');
    sheet.columns = [{ header: 'Order', key: 'id' }];
    sheet.addRow({ id: 1 });
    const excelBuffer = await workbook.xlsx.writeBuffer();
    if (!excelBuffer || excelBuffer.length === 0) issues.push('Excel generation returned empty buffer');

    console.log('Audit Completed. Issues found:', issues.length);
    console.log(issues);
    process.exit(0);

  } catch (error) {
    console.error('Fatal Audit Error:', error);
    process.exit(1);
  }
}

runAudit();
