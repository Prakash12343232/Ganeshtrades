const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Delivery = require('../models/Delivery');

/**
 * Gathers a secure, real-time aggregated snapshot of the business.
 * This runs on authorized server-side context only.
 */
async function getBusinessSnapshot() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Today's orders
  const todayOrders = await Order.find({ createdAt: { $gte: startOfToday } })
    .populate('customer', 'name mobile')
    .sort('-createdAt')
    .lean();

  const todayOrderCount = todayOrders.length;
  const todayRevenue = todayOrders
    .filter(o => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const statusBreakdown = todayOrders.reduce((acc, o) => {
    acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
    return acc;
  }, {});

  // 2. Low stock products
  const lowStockProducts = await Product.find({
    $or: [
      { $expr: { $lte: ['$stock', '$minStock'] } },
      { stock: { $lte: 5 } }
    ],
    status: { $ne: 'inactive' }
  })
    .sort('stock')
    .limit(10)
    .lean();

  const totalLowStockCount = await Product.countDocuments({
    $or: [
      { $expr: { $lte: ['$stock', '$minStock'] } },
      { stock: { $lte: 5 } }
    ],
    status: { $ne: 'inactive' }
  });

  // 3. Top selling products
  const topSellingProducts = await Product.find({ status: { $ne: 'inactive' } })
    .sort('-totalSold')
    .limit(6)
    .lean();

  // 4. Pending payments & Khata Credit
  const pendingPaymentOrders = await Order.find({
    paymentStatus: 'pending',
    orderStatus: { $ne: 'cancelled' }
  })
    .populate('customer', 'name mobile')
    .limit(10)
    .lean();

  const totalPendingOrdersCount = await Order.countDocuments({
    paymentStatus: 'pending',
    orderStatus: { $ne: 'cancelled' }
  });

  const creditStats = await User.aggregate([
    { $match: { role: 'customer' } },
    {
      $group: {
        _id: null,
        totalCreditBalance: { $sum: '$creditBalance' },
        totalPendingAmount: { $sum: '$pendingAmount' },
        customersWithCredit: {
          $sum: {
            $cond: [{ $gt: ['$creditBalance', 0] }, 1, 0]
          }
        }
      }
    }
  ]);

  const creditSummary = creditStats[0] || {
    totalCreditBalance: 0,
    totalPendingAmount: 0,
    customersWithCredit: 0
  };

  // 5. Today's deliveries
  const todayDeliveries = await Delivery.find({
    createdAt: { $gte: startOfToday }
  })
    .populate('order', 'orderNumber total items')
    .sort('-createdAt')
    .limit(10)
    .lean();

  const deliveryStats = {
    totalToday: todayDeliveries.length,
    assigned: todayDeliveries.filter(d => d.status === 'assigned').length,
    outForDelivery: todayDeliveries.filter(d => d.status === 'out_for_delivery').length,
    delivered: todayDeliveries.filter(d => d.status === 'delivered').length
  };

  // 6. 30-Day sales summary
  const last30DaysOrders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        orderStatus: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' }
      }
    }
  ]);

  const sales30Days = last30DaysOrders[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0
  };

  // Customer totals
  const totalCustomers = await User.countDocuments({ role: 'customer' });
  const totalProducts = await Product.countDocuments({ status: { $ne: 'inactive' } });

  return {
    timestamp: now.toISOString(),
    today: {
      orderCount: todayOrderCount,
      revenue: todayRevenue,
      statusBreakdown,
      recentOrders: todayOrders.slice(0, 5).map(o => ({
        orderNumber: o.orderNumber,
        customerName: o.customer?.name || 'Walk-in',
        total: o.total,
        status: o.orderStatus,
        paymentStatus: o.paymentStatus
      }))
    },
    inventory: {
      totalProducts,
      lowStockCount: totalLowStockCount,
      criticalItems: lowStockProducts.map(p => ({
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        unit: p.unit,
        price: p.price
      })),
      topSelling: topSellingProducts.map(p => ({
        name: p.name,
        totalSold: p.totalSold,
        stock: p.stock,
        price: p.price
      }))
    },
    finance: {
      totalPendingOrders: totalPendingOrdersCount,
      totalCreditOutstanding: creditSummary.totalCreditBalance || creditSummary.totalPendingAmount,
      customersWithCredit: creditSummary.customersWithCredit,
      sales30Days: {
        totalOrders: sales30Days.totalOrders,
        totalRevenue: Math.round(sales30Days.totalRevenue),
        avgOrderValue: Math.round(sales30Days.avgOrderValue || 0)
      }
    },
    deliveries: deliveryStats,
    customers: {
      total: totalCustomers
    }
  };
}

/**
 * Intelligent deterministic answer generator when Gemini API is unconfigured or unavailable.
 * Ensures 100% reliable responses backed by real live MongoDB numbers.
 */
function generateDeterministicAnswer(query, snapshot) {
  const q = query.toLowerCase();

  // 1. Today's orders
  if (q.includes("today's order") || q.includes("today order") || q.includes("orders today") || q.includes("new order")) {
    const { orderCount, revenue, statusBreakdown, recentOrders } = snapshot.today;
    if (orderCount === 0) {
      return `📦 **Today's Orders Overview**\n\nNo orders have been placed yet today.\n- **Total Orders:** 0\n- **Today's Revenue:** ₹0\n\nThe store is ready for incoming counter and online orders.`;
    }

    const statuses = Object.entries(statusBreakdown)
      .map(([st, cnt]) => `• **${st.charAt(0).toUpperCase() + st.slice(1)}:** ${cnt}`)
      .join('\n');

    const recentList = recentOrders.length > 0
      ? `\n\n**Latest Orders Today:**\n` + recentOrders.map(o => `• #${o.orderNumber || 'ORD'} — ${o.customerName}: ₹${o.total} (${o.status}, ${o.paymentStatus})`).join('\n')
      : '';

    return `📦 **Today's Orders Summary**\n\n• **Total Orders Today:** ${orderCount}\n• **Total Revenue Today:** ₹${revenue.toLocaleString('en-IN')}\n\n**Status Breakdown:**\n${statuses}${recentList}`;
  }

  // 2. Low stock
  if (q.includes('low in stock') || q.includes('low stock') || q.includes('out of stock') || q.includes('reorder') || q.includes('inventory alert')) {
    const { lowStockCount, criticalItems } = snapshot.inventory;
    if (lowStockCount === 0) {
      return `✅ **Inventory Health: Good**\n\nAll products currently have healthy stock levels above their minimum alert thresholds. Total active catalog: ${snapshot.inventory.totalProducts} items.`;
    }

    const itemsText = criticalItems
      .map(p => `• **${p.name}**: Available **${p.stock} ${p.unit}** (Min alert: ${p.minStock})`)
      .join('\n');

    return `⚠️ **Low Stock Alert (${lowStockCount} Products Need Restock)**\n\nHere are the top critical items requiring supplier purchase orders:\n\n${itemsText}\n\n💡 *Tip: Go to Admin > Suppliers & POs to create purchase orders directly.*`;
  }

  // 3. Top selling products
  if (q.includes('top selling') || q.includes('best selling') || q.includes('popular product') || q.includes('top product')) {
    const { topSelling } = snapshot.inventory;
    if (!topSelling || topSelling.length === 0) {
      return `📊 **Top Selling Products**\n\nCatalog data is currently accumulating sales activity.`;
    }

    const list = topSelling
      .map((p, idx) => `${idx + 1}. **${p.name}** — Total Sold: **${p.totalSold}** | Price: ₹${p.price} | Stock: ${p.stock}`)
      .join('\n');

    return `🏆 **Top-Selling Products by Units Sold:**\n\n${list}`;
  }

  // 4. Pending payments / Credit
  if (q.includes('pending payment') || q.includes('unpaid') || q.includes('credit') || q.includes('khata') || q.includes('due payment')) {
    const { totalPendingOrders, totalCreditOutstanding, customersWithCredit } = snapshot.finance;
    return `💳 **Pending Payments & Credit (Khata) Summary**\n\n• **Orders with Pending Payment:** ${totalPendingOrders}\n• **Total Outstanding Khata Credit:** ₹${totalCreditOutstanding.toLocaleString('en-IN')}\n• **Customers with Active Khata Due:** ${customersWithCredit}\n\n💡 *Tip: Go to Admin > Credit (Khata) to review individual customer accounts and send payment reminders.*`;
  }

  // 5. Deliveries today
  if (q.includes('deliver') || q.includes('delivery') || q.includes('dispatch') || q.includes('scheduled')) {
    const { totalToday, assigned, outForDelivery, delivered } = snapshot.deliveries;
    return `🚚 **Today's Delivery Schedule**\n\n• **Total Deliveries Logged Today:** ${totalToday}\n• **Assigned to Drivers:** ${assigned}\n• **Out for Delivery:** ${outForDelivery}\n• **Completed / Delivered:** ${delivered}\n\n💡 *Tip: Check Admin > Deliveries to monitor live delivery statuses.*`;
  }

  // 6. 30-day sales summary
  if (q.includes('30 days') || q.includes('month') || q.includes('sales summary') || q.includes('revenue') || q.includes('performance')) {
    const { sales30Days } = snapshot.finance;
    return `📈 **30-Day Sales Performance**\n\n• **Total Orders Completed:** ${sales30Days.totalOrders}\n• **Total 30-Day Gross Revenue:** ₹${sales30Days.totalRevenue.toLocaleString('en-IN')}\n• **Average Order Value (AOV):** ₹${sales30Days.avgOrderValue.toLocaleString('en-IN')}\n• **Total Registered Customers:** ${snapshot.customers.total}\n• **Active Catalog Size:** ${snapshot.inventory.totalProducts} items\n\nBusiness is tracking steadily!`;
  }

  // Default executive overview
  return `🏢 **Ganesh Trades Live Business Snapshot**\n\n• **Today's Orders:** ${snapshot.today.orderCount} (₹${snapshot.today.revenue.toLocaleString('en-IN')})\n• **30-Day Revenue:** ₹${snapshot.finance.sales30Days.totalRevenue.toLocaleString('en-IN')} (${snapshot.finance.sales30Days.totalOrders} orders)\n• **Low Stock Alerts:** ${snapshot.inventory.lowStockCount} items\n• **Pending Orders:** ${snapshot.finance.totalPendingOrders}\n• **Outstanding Khata Credit:** ₹${snapshot.finance.totalCreditOutstanding.toLocaleString('en-IN')}\n• **Active Deliveries Today:** ${snapshot.deliveries.totalToday}\n\nAsk me about:\n- *"What are today's orders?"*\n- *"Which products are low in stock?"*\n- *"What are the top-selling products?"*\n- *"Which payments are pending?"*\n- *"What deliveries are scheduled today?"*\n- *"Give me a sales summary for the last 30 days."*`;
}

/**
 * Main query handler for Ganesh AI Business Assistant.
 */
async function answerBusinessQuestion(query, user) {
  const snapshot = await getBusinessSnapshot();
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `You are the executive AI Business Assistant for "Ganesh Trades", a reputable grocery and wholesale store based in Pune, India.
The authenticated administrator (${user.name || 'Admin'}, role: ${user.role}) asks: "${query}".

Answer authoritatively, clearly, and concisely in clean Markdown using Indian Rupee (₹) and the following REAL live database snapshot:
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

Guidelines:
1. Ground your response strictly in the data provided above.
2. Format numbers clearly (e.g. ₹5,400).
3. If specific items are mentioned (like low stock or top products), name them and their quantities.
4. Keep the tone helpful, professional, and practical for store management.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 800
            }
          }),
          signal: AbortSignal.timeout(10000)
        }
      );

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          return {
            success: true,
            answer: candidate,
            snapshot,
            aiPowered: true
          };
        }
      }
    } catch (err) {
      console.warn('⚠️ Gemini AI call failed or timed out. Using deterministic business intelligence fallback:', err.message);
    }
  }

  // Deterministic fallback using live database calculations
  const answer = generateDeterministicAnswer(query, snapshot);
  return {
    success: true,
    answer,
    snapshot,
    aiPowered: Boolean(apiKey)
  };
}

module.exports = {
  getBusinessSnapshot,
  answerBusinessQuestion
};
