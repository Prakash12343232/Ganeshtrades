const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const { generateTestToken } = require('./setup');

describe('Order ↔ Delivery lifecycle sync', () => {
  let adminToken, orderId;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000030', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    const customer = await User.create({ name: 'Cu', mobile: '9000000031', password: 'password123', role: 'customer' });
    const product = await Product.create({ name: 'P', category: 'snacks', price: 10, stock: 50 });
    const order = await Order.create({
      user: customer._id,
      items: [{ product: product._id, quantity: 1, price: 10, total: 10 }],
      totalAmount: 10, finalAmount: 10,
      deliveryType: 'instant',
      orderStatus: 'pending'
    });
    orderId = order._id;
  });

  const assign = async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId, deliveryPersonName: 'Delivery Man', deliveryPersonMobile: '9111111111' });
    return res;
  };

  it('manual order status → delivered closes the delivery record and removes it from dispatch queues', async () => {
    const a = await assign();
    expect(a.statusCode).toEqual(201);

    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: 'delivered' });
    expect(res.statusCode).toEqual(200);

    const delivery = await Delivery.findOne({ order: orderId });
    expect(delivery.status).toEqual('delivered');

    const priority = await request(app)
      .get('/api/deliveries/today-priority')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(priority.statusCode).toEqual(200);
    const allLists = [priority.body.data.late, priority.body.data.today, priority.body.data.instant, priority.body.data.future].flat();
    expect(allLists.map(d => String(d.order?._id))).not.toContain(String(orderId));
  });

  it('customer cancel closes the delivery record as failed', async () => {
    const a = await assign();
    expect(a.statusCode).toEqual(201);

    const res = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'test' });
    expect(res.statusCode).toEqual(200);

    const delivery = await Delivery.findOne({ order: orderId });
    expect(delivery.status).toEqual('failed');
    expect(delivery.history.some(h => h.note === 'Order cancelled')).toEqual(true);

    const o = await Order.findById(orderId);
    expect(o.orderStatus).toEqual('cancelled');
  });

  it('a failed delivery can be re-assigned in place with a fresh rider', async () => {
    const a = await assign();
    const deliveryId = a.body.data._id;

    // Rider reports failure
    const fail = await request(app)
      .put(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'failed' });
    expect(fail.statusCode).toEqual(200);

    // Re-assign the same order to a new rider
    const re = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId, deliveryPersonName: 'Rider Two', deliveryPersonMobile: '9222222222' });
    expect(re.statusCode).toEqual(201);
    expect(String(re.body.data._id)).toEqual(String(deliveryId));

    const delivery = await Delivery.findOne({ order: orderId });
    expect(delivery.status).toEqual('assigned');
    expect(delivery.deliveryPersonName).toEqual('Rider Two');
    expect(delivery.deliveryPersonMobile).toEqual('9222222222');
    expect(delivery.history.some(h => h.note === 'Re-assigned to Rider Two')).toEqual(true);

    // It is dispatchable again
    const priority = await request(app)
      .get('/api/deliveries/today-priority')
      .set('Authorization', `Bearer ${adminToken}`);
    const allLists = [priority.body.data.late, priority.body.data.today, priority.body.data.instant, priority.body.data.future].flat();
    expect(allLists.map(d => String(d.order?._id))).toContain(String(orderId));
  });

  it('an active (non-terminal) delivery still rejects duplicate assignment', async () => {
    const a = await assign();
    expect(a.statusCode).toEqual(201);

    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId, deliveryPersonName: 'Someone Else', deliveryPersonMobile: '9222222222' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/already assigned/i);
  });

  it('delivery on_the_way sets order to out_for_delivery with a fresh ETA and history entry', async () => {
    const a = await assign();
    const deliveryId = a.body.data._id;

    const pickedUp = await request(app)
      .put(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'picked_up' });
    expect(pickedUp.statusCode).toEqual(200);

    const before = new Date();
    const onWay = await request(app)
      .put(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'on_the_way' });
    expect(onWay.statusCode).toEqual(200);

    const o = await Order.findById(orderId);
    expect(o.orderStatus).toEqual('out_for_delivery');
    const etaMs = new Date(o.estimatedDeliveryTime).getTime();
    expect(etaMs).toBeGreaterThanOrEqual(before.getTime() + 25 * 60 * 1000);
    expect(etaMs).toBeLessThanOrEqual(before.getTime() + 35 * 60 * 1000);
    expect(o.statusHistory.some(h => h.status === 'out_for_delivery')).toEqual(true);
  });
});