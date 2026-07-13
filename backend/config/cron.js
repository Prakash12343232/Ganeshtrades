const cron = require('node-cron');
const { performBackup } = require('../services/backupService');

const initCronJobs = () => {
  // Daily backup at 2:00 AM
  cron.schedule('0 2 * * *', () => {
    console.log('Running daily backup...');
    performBackup('daily').catch(err => console.error('Daily backup failed', err));
  });

  // Weekly backup on Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', () => {
    console.log('Running weekly backup...');
    performBackup('weekly').catch(err => console.error('Weekly backup failed', err));
  });

  // Monthly backup on the 1st of every month at 4:00 AM
  cron.schedule('0 4 1 * *', () => {
    console.log('Running monthly backup...');
    performBackup('monthly').catch(err => console.error('Monthly backup failed', err));
  });

  // ─── Scheduled Delivery Reminders — Runs every hour ───
  cron.schedule('0 * * * *', async () => {
    try {
      const Order = require('../models/Order');
      const Notification = require('../models/Notification');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

      // 1) Remind customers about tomorrow's deliveries (run between 6-7 PM)
      if (now.getHours() === 18) {
        const tomorrowOrders = await Order.find({
          deliveryType: 'scheduled',
          'scheduledDelivery.date': { $gte: tomorrowStart, $lt: tomorrowEnd },
          orderStatus: { $nin: ['delivered', 'cancelled'] }
        });

        for (const order of tomorrowOrders) {
          await Notification.create({
            title: '⏰ Delivery Reminder',
            message: `Your order #${order.orderNumber} is scheduled for delivery tomorrow (${order.scheduledDelivery.timeSlot}).`,
            type: 'order',
            recipient: order.user,
            metadata: { orderId: order._id, reminderType: 'day_before' }
          });
        }

        if (tomorrowOrders.length > 0) {
          await Notification.create({
            title: '📅 Tomorrow\'s Deliveries',
            message: `${tomorrowOrders.length} scheduled delivery(s) for tomorrow. Review the delivery schedule.`,
            type: 'order', recipientRole: 'admin'
          });
        }

        console.log(`📅 Sent ${tomorrowOrders.length} delivery reminders for tomorrow`);
      }

      // 2) Alert admin about late deliveries (run at 10 AM)
      if (now.getHours() === 10) {
        const lateOrders = await Order.find({
          deliveryType: 'scheduled',
          'scheduledDelivery.date': { $lt: todayStart },
          orderStatus: { $nin: ['delivered', 'cancelled'] }
        });

        if (lateOrders.length > 0) {
          await Notification.create({
            title: '⚠️ Late Deliveries Alert',
            message: `${lateOrders.length} scheduled delivery(s) are past their scheduled date and not yet delivered!`,
            type: 'order', recipientRole: 'admin',
            metadata: { lateCount: lateOrders.length }
          });
          console.log(`⚠️ ${lateOrders.length} late delivery alerts sent`);
        }
      }
    } catch (err) {
      console.error('Scheduled delivery cron error:', err.message);
    }
  });

  console.log('⏱️ Cron jobs initialized (backups + delivery reminders)');
};

module.exports = { initCronJobs };
