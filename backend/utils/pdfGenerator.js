const PDFDocument = require('pdfkit');

const generateInvoicePDF = (order, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('GANESH TRADES', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Grocery & Wholesale Shop', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).text('────────────────────────────────────────────────────────────', { align: 'center' });
      doc.moveDown();

      // Invoice Info
      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice No: ${order.orderNumber}`);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`);
      doc.text(`Payment Status: ${order.paymentStatus.toUpperCase()}`);
      doc.moveDown();

      // Customer Info
      doc.font('Helvetica-Bold').text('Bill To:');
      doc.font('Helvetica');
      doc.text(`Name: ${user.name}`);
      doc.text(`Mobile: ${user.mobile}`);
      if (user.address) {
        const addr = user.address;
        doc.text(`Address: ${[addr.street, addr.area, addr.city, addr.pincode].filter(Boolean).join(', ')}`);
      }
      doc.moveDown();

      // Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('S.No', 50, tableTop, { width: 40 });
      doc.text('Item', 90, tableTop, { width: 200 });
      doc.text('Qty', 290, tableTop, { width: 60, align: 'center' });
      doc.text('Price', 350, tableTop, { width: 80, align: 'right' });
      doc.text('Total', 430, tableTop, { width: 80, align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(510, tableTop + 15).stroke();

      // Table Rows
      let y = tableTop + 25;
      doc.font('Helvetica').fontSize(9);

      order.items.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(String(index + 1), 50, y, { width: 40 });
        doc.text(item.name || 'Product', 90, y, { width: 200 });
        doc.text(String(item.quantity), 290, y, { width: 60, align: 'center' });
        doc.text(`₹${item.price?.toFixed(2) || '0.00'}`, 350, y, { width: 80, align: 'right' });
        doc.text(`₹${item.total?.toFixed(2) || '0.00'}`, 430, y, { width: 80, align: 'right' });
        y += 20;
      });

      // Totals
      doc.moveTo(50, y + 5).lineTo(510, y + 5).stroke();
      y += 15;

      doc.font('Helvetica').fontSize(10);
      doc.text('Subtotal:', 350, y, { width: 80, align: 'right' });
      doc.text(`₹${order.totalAmount?.toFixed(2)}`, 430, y, { width: 80, align: 'right' });
      y += 18;

      if (order.discount > 0) {
        doc.text('Discount:', 350, y, { width: 80, align: 'right' });
        doc.text(`-₹${order.discount?.toFixed(2)}`, 430, y, { width: 80, align: 'right' });
        y += 18;
      }

      if (order.deliveryCharge > 0) {
        doc.text('Delivery:', 350, y, { width: 80, align: 'right' });
        doc.text(`₹${order.deliveryCharge?.toFixed(2)}`, 430, y, { width: 80, align: 'right' });
        y += 18;
      }

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL:', 350, y, { width: 80, align: 'right' });
      doc.text(`₹${order.finalAmount?.toFixed(2)}`, 430, y, { width: 80, align: 'right' });

      // Footer
      doc.fontSize(8).font('Helvetica');
      doc.text('Thank you for shopping with Ganesh Trades!', 50, 750, { align: 'center' });
      doc.text('For any queries, contact us on WhatsApp', 50, 762, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateInvoicePDF };
