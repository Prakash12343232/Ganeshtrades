const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

const VALID_CATEGORIES = [
  'rice_grains', 'dal_pulses', 'spices', 'oil_ghee', 'flour',
  'sugar_jaggery', 'tea_coffee', 'snacks', 'beverages', 'dairy',
  'fruits', 'vegetables', 'dry_fruits', 'cleaning', 'personal_care',
  'packaged_food', 'bakery', 'frozen', 'other'
];

const VALID_UNITS = ['kg', 'g', 'l', 'ml', 'piece', 'packet', 'dozen', 'box'];

const CATEGORY_MAP = {
  'rice': 'rice_grains',
  'rice & grains': 'rice_grains',
  'rice_grains': 'rice_grains',
  'grains': 'rice_grains',
  'dal': 'dal_pulses',
  'pulses': 'dal_pulses',
  'dal & pulses': 'dal_pulses',
  'dal_pulses': 'dal_pulses',
  'dals': 'dal_pulses',
  'spice': 'spices',
  'spices': 'spices',
  'masala': 'spices',
  'oil': 'oil_ghee',
  'ghee': 'oil_ghee',
  'oil & ghee': 'oil_ghee',
  'oil_ghee': 'oil_ghee',
  'flour': 'flour',
  'atta': 'flour',
  'sugar': 'sugar_jaggery',
  'jaggery': 'sugar_jaggery',
  'sugar & jaggery': 'sugar_jaggery',
  'sugar_jaggery': 'sugar_jaggery',
  'tea': 'tea_coffee',
  'coffee': 'tea_coffee',
  'tea & coffee': 'tea_coffee',
  'tea_coffee': 'tea_coffee',
  'snack': 'snacks',
  'snacks': 'snacks',
  'namkeen': 'snacks',
  'biscuit': 'snacks',
  'biscuits': 'snacks',
  'beverage': 'beverages',
  'beverages': 'beverages',
  'drink': 'beverages',
  'drinks': 'beverages',
  'dairy': 'dairy',
  'milk': 'dairy',
  'paneer': 'dairy',
  'fruit': 'fruits',
  'fruits': 'fruits',
  'vegetable': 'vegetables',
  'vegetables': 'vegetables',
  'veggie': 'vegetables',
  'dry fruit': 'dry_fruits',
  'dry fruits': 'dry_fruits',
  'dry_fruits': 'dry_fruits',
  'nuts': 'dry_fruits',
  'cleaning': 'cleaning',
  'detergent': 'cleaning',
  'personal care': 'personal_care',
  'personal_care': 'personal_care',
  'packaged food': 'packaged_food',
  'packaged_food': 'packaged_food',
  'bakery': 'bakery',
  'bread': 'bakery',
  'frozen': 'frozen',
  'other': 'other'
};

const UNIT_MAP = {
  'kg': 'kg',
  'kgs': 'kg',
  'kilo': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'g': 'g',
  'gm': 'g',
  'gms': 'g',
  'gram': 'g',
  'grams': 'g',
  'l': 'l',
  'ltr': 'l',
  'liter': 'l',
  'litre': 'l',
  'liters': 'l',
  'litres': 'l',
  'ml': 'ml',
  'milliliter': 'ml',
  'pc': 'piece',
  'pcs': 'piece',
  'piece': 'piece',
  'pieces': 'piece',
  'pkt': 'packet',
  'pack': 'packet',
  'packet': 'packet',
  'packets': 'packet',
  'dozen': 'dozen',
  'box': 'box',
  'boxes': 'box'
};

function normalizeCategory(raw) {
  if (!raw) return 'other';
  const clean = String(raw).trim().toLowerCase().replace(/[-_]/g, ' ');
  if (VALID_CATEGORIES.includes(clean.replace(/\s+/g, '_'))) {
    return clean.replace(/\s+/g, '_');
  }
  return CATEGORY_MAP[clean] || 'other';
}

function normalizeUnit(raw) {
  if (!raw) return 'kg';
  const clean = String(raw).trim().toLowerCase();
  return UNIT_MAP[clean] || (VALID_UNITS.includes(clean) ? clean : 'kg');
}

/**
 * Parses an Excel or CSV file buffer into an array of objects
 */
async function parseSpreadsheetBuffer(buffer, filename = '') {
  const workbook = new ExcelJS.Workbook();
  const isCsv = filename.toLowerCase().endsWith('.csv');

  if (isCsv) {
    const { Readable } = require('stream');
    const stream = Readable.from(buffer.toString('utf-8'));
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet has no worksheets');
  }

  const rows = [];
  let headerMap = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Header row
      row.eachCell((cell, colNumber) => {
        const val = cell.value ? String(cell.value).trim().toLowerCase() : '';
        headerMap[colNumber] = val;
      });
    } else {
      const rowObj = {};
      let hasData = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headerMap[colNumber];
        if (header) {
          let cellVal = cell.value;
          if (cellVal && typeof cellVal === 'object' && cellVal.result !== undefined) {
            cellVal = cellVal.result; // Handle formula values
          } else if (cellVal && typeof cellVal === 'object' && cellVal.text !== undefined) {
            cellVal = cellVal.text; // Handle rich text
          }
          rowObj[header] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
          if (rowObj[header]) hasData = true;
        }
      });
      if (hasData) {
        rows.push(rowObj);
      }
    }
  });

  return rows;
}

/**
 * Standardize keys in parsed rows (maps user header synonyms to standard keys)
 */
function standardizeKeys(row, customMapping = {}) {
  const keyMap = {
    'name': 'name',
    'product name': 'name',
    'product_name': 'name',
    'item': 'name',
    'item name': 'name',
    'title': 'name',
    'description': 'description',
    'desc': 'description',
    'details': 'description',
    'category': 'category',
    'cat': 'category',
    'price': 'price',
    'mrp': 'price',
    'retail price': 'price',
    'rate': 'price',
    'selling price': 'price',
    'wholesaleprice': 'wholesalePrice',
    'wholesale price': 'wholesalePrice',
    'wholesale_price': 'wholesalePrice',
    'b2b price': 'wholesalePrice',
    'unit': 'unit',
    'uom': 'unit',
    'stock': 'stock',
    'quantity': 'stock',
    'qty': 'stock',
    'available stock': 'stock',
    'minstock': 'minStock',
    'min stock': 'minStock',
    'min_stock': 'minStock',
    'minimum stock': 'minStock',
    'alert stock': 'minStock',
    'brand': 'brand',
    'company': 'brand',
    'manufacturer': 'brand',
    'sku': 'sku',
    'barcode': 'sku',
    'code': 'sku',
    'product code': 'sku',
    'identifier': 'identifier',
    'mobile': 'mobile',
    'mobile number': 'mobile',
    'phone': 'mobile',
    'phone number': 'mobile',
    'contact': 'mobile',
    'contact number': 'mobile',
    'customer name': 'name',
    'customer': 'name',
    'email': 'email',
    'customertype': 'customerType',
    'customer type': 'customerType',
    'creditlimit': 'creditLimit',
    'credit limit': 'creditLimit',
    'street': 'street',
    'address': 'street',
    'area': 'area',
    'city': 'city',
    'pincode': 'pincode',
    'pin code': 'pincode',
    'zip': 'pincode',
    'action': 'action'
  };

  Object.assign(keyMap, customMapping);

  const standardized = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = k.toLowerCase().trim();
    const mappedKey = keyMap[cleanKey] || cleanKey;
    standardized[mappedKey] = v;
  }
  return standardized;
}

/**
 * Preview product import with duplicate detection & validation
 */
async function previewProducts(rawRows, customMapping = {}) {
  const existingProducts = await Product.find({}, 'name sku price stock').lean();
  const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase().trim()));
  const existingSkus = new Map();
  existingProducts.forEach(p => {
    if (p.sku) existingSkus.set(p.sku.toLowerCase().trim(), p);
  });

  const fileSeenNames = new Set();
  const fileSeenSkus = new Set();

  const items = [];
  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row = standardizeKeys(raw, customMapping);
    const rowNum = i + 1;
    const errors = [];
    const warnings = [];

    // Validation
    const name = String(row.name || '').trim();
    if (!name) {
      errors.push('Product name is required');
    } else if (name.length > 200) {
      errors.push('Product name exceeds 200 characters');
    }

    const rawPrice = row.price;
    const price = parseFloat(rawPrice);
    if (rawPrice === undefined || rawPrice === '' || isNaN(price) || price < 0) {
      errors.push('Valid price is required (must be 0 or greater)');
    }

    let wholesalePrice = undefined;
    if (row.wholesalePrice !== undefined && row.wholesalePrice !== '') {
      const wp = parseFloat(row.wholesalePrice);
      if (isNaN(wp) || wp < 0) {
        warnings.push('Invalid wholesale price provided; setting to undefined');
      } else {
        wholesalePrice = wp;
      }
    }

    let stock = 0;
    if (row.stock !== undefined && row.stock !== '') {
      const s = parseInt(row.stock, 10);
      if (isNaN(s) || s < 0) {
        warnings.push('Invalid stock quantity provided; defaulting to 0');
      } else {
        stock = s;
      }
    }

    let minStock = 10;
    if (row.minStock !== undefined && row.minStock !== '') {
      const ms = parseInt(row.minStock, 10);
      if (isNaN(ms) || ms < 0) {
        warnings.push('Invalid min stock quantity; defaulting to 10');
      } else {
        minStock = ms;
      }
    }

    const category = normalizeCategory(row.category);
    const unit = normalizeUnit(row.unit);
    const brand = String(row.brand || '').trim();
    const sku = String(row.sku || '').trim();
    const description = String(row.description || '').trim().slice(0, 1000);

    // Duplicate detection
    let isDuplicate = false;
    let duplicateReason = '';

    const nameKey = name.toLowerCase();
    const skuKey = sku.toLowerCase();

    if (name && existingNames.has(nameKey)) {
      isDuplicate = true;
      duplicateReason = `A product named "${name}" already exists in the catalog`;
    } else if (sku && existingSkus.has(skuKey)) {
      isDuplicate = true;
      duplicateReason = `A product with SKU "${sku}" already exists in the catalog`;
    } else if (name && fileSeenNames.has(nameKey)) {
      isDuplicate = true;
      duplicateReason = `Duplicate product name within this file (Row #${rowNum})`;
    } else if (sku && fileSeenSkus.has(skuKey)) {
      isDuplicate = true;
      duplicateReason = `Duplicate SKU within this file (Row #${rowNum})`;
    }

    if (name) fileSeenNames.add(nameKey);
    if (sku) fileSeenSkus.add(skuKey);

    let status = 'valid';
    if (errors.length > 0) {
      status = 'error';
      errorCount++;
    } else if (isDuplicate) {
      status = 'duplicate';
      duplicateCount++;
    } else {
      validCount++;
    }

    items.push({
      rowNumber: rowNum,
      status,
      errors,
      warnings,
      isDuplicate,
      duplicateReason,
      data: {
        name,
        category,
        price,
        wholesalePrice,
        unit,
        stock,
        minStock,
        brand,
        sku: sku || undefined,
        description
      },
      raw
    });
  }

  return {
    totalRows: rawRows.length,
    validCount,
    duplicateCount,
    errorCount,
    items
  };
}

/**
 * Commit validated products to database
 */
async function commitProducts(validatedItems, { duplicateAction = 'skip', userId, req }) {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const item of validatedItems) {
    if (item.status === 'error' || (item.errors && item.errors.length > 0)) {
      errors.push({ rowNumber: item.rowNumber, error: item.errors.join(', ') });
      continue;
    }

    const pData = item.data;

    try {
      if (item.isDuplicate) {
        if (duplicateAction === 'skip') {
          skippedCount++;
          continue;
        } else if (duplicateAction === 'update') {
          // Update existing product
          const query = pData.sku
            ? { $or: [{ sku: pData.sku }, { name: new RegExp(`^${pData.name}$`, 'i') }] }
            : { name: new RegExp(`^${pData.name}$`, 'i') };

          const existing = await Product.findOne(query);
          if (existing) {
            existing.price = pData.price;
            if (pData.wholesalePrice !== undefined) existing.wholesalePrice = pData.wholesalePrice;
            existing.stock = pData.stock;
            existing.minStock = pData.minStock;
            if (pData.brand) existing.brand = pData.brand;
            if (pData.category) existing.category = pData.category;
            if (pData.unit) existing.unit = pData.unit;
            if (pData.description) existing.description = pData.description;
            await existing.save();
            updatedCount++;
            continue;
          }
        }
      }

      // Create new product
      await Product.create(pData);
      createdCount++;
    } catch (err) {
      errors.push({ rowNumber: item.rowNumber, error: err.message });
    }
  }

  if (userId) {
    await createAuditLog(
      userId,
      'bulk_import_products',
      'product',
      null,
      { createdCount, updatedCount, skippedCount, total: validatedItems.length },
      req
    );
  }

  return {
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount: errors.length,
    errors
  };
}

/**
 * Preview customer import
 */
async function previewCustomers(rawRows, customMapping = {}) {
  const existingUsers = await User.find({}, 'mobile email').lean();
  const existingMobiles = new Set(existingUsers.map(u => u.mobile));
  const existingEmails = new Set(existingUsers.filter(u => u.email).map(u => u.email.toLowerCase()));

  const fileSeenMobiles = new Set();
  const items = [];
  let validCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  const validCustomerTypes = ['public', 'hotel', 'pg_hostel'];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row = standardizeKeys(raw, customMapping);
    const rowNum = i + 1;
    const errors = [];
    const warnings = [];

    const name = String(row.name || '').trim();
    if (!name) errors.push('Customer name is required');

    let mobile = String(row.mobile || '').replace(/\D/g, '');
    if (mobile.length === 12 && mobile.startsWith('91')) mobile = mobile.slice(2);
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      errors.push('Valid 10-digit Indian mobile number required (starts with 6-9)');
    }

    const email = row.email ? String(row.email).trim().toLowerCase() : '';
    if (email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      warnings.push('Invalid email format; leaving email blank');
    }

    let customerType = String(row.customerType || 'public').toLowerCase().trim();
    if (!validCustomerTypes.includes(customerType)) customerType = 'public';

    const creditLimit = parseFloat(row.creditLimit) || 0;
    const street = String(row.street || '').trim();
    const area = String(row.area || '').trim();
    const city = String(row.city || 'Local').trim();
    const pincode = String(row.pincode || '').trim();

    let isDuplicate = false;
    let duplicateReason = '';

    if (mobile && existingMobiles.has(mobile)) {
      isDuplicate = true;
      duplicateReason = `Mobile ${mobile} already exists in database`;
    } else if (email && existingEmails.has(email)) {
      isDuplicate = true;
      duplicateReason = `Email ${email} already exists in database`;
    } else if (mobile && fileSeenMobiles.has(mobile)) {
      isDuplicate = true;
      duplicateReason = `Duplicate mobile within this import file (Row #${rowNum})`;
    }

    if (mobile) fileSeenMobiles.add(mobile);

    let status = 'valid';
    if (errors.length > 0) {
      status = 'error';
      errorCount++;
    } else if (isDuplicate) {
      status = 'duplicate';
      duplicateCount++;
    } else {
      validCount++;
    }

    items.push({
      rowNumber: rowNum,
      status,
      errors,
      warnings,
      isDuplicate,
      duplicateReason,
      data: {
        name,
        mobile,
        email: email || undefined,
        customerType,
        creditLimit: Math.max(0, creditLimit),
        address: { street, area, city, pincode },
        role: 'customer'
      },
      raw
    });
  }

  return {
    totalRows: rawRows.length,
    validCount,
    duplicateCount,
    errorCount,
    items
  };
}

/**
 * Commit validated customers
 */
async function commitCustomers(validatedItems, { duplicateAction = 'skip', userId, req }) {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  const defaultPassword = await bcrypt.hash('GaneshCustomer@123', 10);

  for (const item of validatedItems) {
    if (item.status === 'error' || (item.errors && item.errors.length > 0)) {
      errors.push({ rowNumber: item.rowNumber, error: item.errors.join(', ') });
      continue;
    }

    const cData = item.data;

    try {
      if (item.isDuplicate) {
        if (duplicateAction === 'skip') {
          skippedCount++;
          continue;
        } else if (duplicateAction === 'update') {
          const user = await User.findOne({ mobile: cData.mobile });
          if (user) {
            user.name = cData.name;
            if (cData.email) user.email = cData.email;
            user.customerType = cData.customerType;
            if (cData.creditLimit > 0) user.creditLimit = cData.creditLimit;
            if (cData.address.street) user.address.street = cData.address.street;
            if (cData.address.area) user.address.area = cData.address.area;
            if (cData.address.pincode) user.address.pincode = cData.address.pincode;
            await user.save();
            updatedCount++;
            continue;
          }
        }
      }

      await User.create({
        ...cData,
        password: defaultPassword
      });
      createdCount++;
    } catch (err) {
      errors.push({ rowNumber: item.rowNumber, error: err.message });
    }
  }

  if (userId) {
    await createAuditLog(
      userId,
      'bulk_import_customers',
      'user',
      null,
      { createdCount, updatedCount, skippedCount, total: validatedItems.length },
      req
    );
  }

  return {
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount: errors.length,
    errors
  };
}

/**
 * Preview inventory stock update
 */
async function previewInventory(rawRows, customMapping = {}) {
  const allProducts = await Product.find({}, 'name sku stock minStock unit').lean();
  const bySku = new Map();
  const byName = new Map();
  allProducts.forEach(p => {
    if (p.sku) bySku.set(p.sku.toLowerCase().trim(), p);
    byName.set(p.name.toLowerCase().trim(), p);
  });

  const items = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const row = standardizeKeys(raw, customMapping);
    const rowNum = i + 1;
    const errors = [];
    const warnings = [];

    const identifier = String(row.sku || row.name || row.identifier || '').trim();
    if (!identifier) {
      errors.push('Product SKU or Name is required to identify the item');
    }

    const cleanIdent = identifier.toLowerCase();
    const matchedProduct = (row.sku ? bySku.get(row.sku.toLowerCase().trim()) : null) ||
      bySku.get(cleanIdent) ||
      (row.name ? byName.get(row.name.toLowerCase().trim()) : null) ||
      byName.get(cleanIdent);

    if (!matchedProduct) {
      errors.push(`No existing product found matching "${identifier}"`);
    }

    const action = ['add', 'subtract', 'set'].includes(String(row.action).toLowerCase().trim())
      ? String(row.action).toLowerCase().trim()
      : 'set';

    const stockVal = parseInt(row.stock, 10);
    if (row.stock === undefined || isNaN(stockVal) || stockVal < 0) {
      errors.push('Stock quantity must be a non-negative integer');
    }

    let calculatedStock = 0;
    if (matchedProduct && !isNaN(stockVal)) {
      if (action === 'add') {
        calculatedStock = matchedProduct.stock + stockVal;
      } else if (action === 'subtract') {
        calculatedStock = Math.max(0, matchedProduct.stock - stockVal);
      } else {
        calculatedStock = stockVal;
      }
    }

    const status = errors.length > 0 ? 'error' : 'valid';
    if (status === 'valid') validCount++; else errorCount++;

    items.push({
      rowNumber: rowNum,
      status,
      errors,
      warnings,
      productId: matchedProduct ? matchedProduct._id : null,
      productName: matchedProduct ? matchedProduct.name : identifier,
      currentStock: matchedProduct ? matchedProduct.stock : null,
      action,
      inputStock: stockVal,
      newStock: calculatedStock,
      unit: matchedProduct ? matchedProduct.unit : '',
      raw
    });
  }

  return {
    totalRows: rawRows.length,
    validCount,
    errorCount,
    items
  };
}

/**
 * Commit inventory updates
 */
async function commitInventory(validatedItems, { userId, req }) {
  let updatedCount = 0;
  const errors = [];

  for (const item of validatedItems) {
    if (item.status === 'error' || !item.productId) continue;

    try {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock = item.newStock;
        await product.save();
        updatedCount++;
      }
    } catch (err) {
      errors.push({ rowNumber: item.rowNumber, error: err.message });
    }
  }

  if (userId) {
    await createAuditLog(
      userId,
      'bulk_update_inventory',
      'product',
      null,
      { updatedCount, total: validatedItems.length },
      req
    );
  }

  return {
    success: true,
    updatedCount,
    errorCount: errors.length,
    errors
  };
}

/**
 * Generate starter template files (Excel or CSV)
 */
async function generateTemplate(type = 'products', format = 'xlsx') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ganesh Trades';
  workbook.created = new Date();

  if (type === 'products') {
    const sheet = workbook.addWorksheet('Products Template');
    sheet.columns = [
      { header: 'Product Name*', key: 'name', width: 28 },
      { header: 'Category*', key: 'category', width: 20 },
      { header: 'Price (MRP)*', key: 'price', width: 14 },
      { header: 'Wholesale Price', key: 'wholesalePrice', width: 16 },
      { header: 'Unit (kg/g/l/ml/piece/packet)', key: 'unit', width: 24 },
      { header: 'Current Stock', key: 'stock', width: 14 },
      { header: 'Min Stock Alert', key: 'minStock', width: 16 },
      { header: 'Brand', key: 'brand', width: 18 },
      { header: 'SKU / Barcode', key: 'sku', width: 16 },
      { header: 'Description', key: 'description', width: 35 }
    ];

    // Sample data rows
    sheet.addRow({
      name: 'Kolam Raw Rice',
      category: 'rice_grains',
      price: 65,
      wholesalePrice: 58,
      unit: 'kg',
      stock: 500,
      minStock: 50,
      brand: 'Ganesh Premium',
      sku: 'RIC-KOL-01',
      description: 'Daily consumption aged Kolam rice'
    });
    sheet.addRow({
      name: 'Toor Dal Premium',
      category: 'dal_pulses',
      price: 160,
      wholesalePrice: 145,
      unit: 'kg',
      stock: 200,
      minStock: 25,
      brand: 'Desi Choice',
      sku: 'DAL-TUR-01',
      description: 'Unpolished protein-rich Toor Dal'
    });
    sheet.addRow({
      name: 'Sunflower Oil 1L Pouch',
      category: 'oil_ghee',
      price: 135,
      wholesalePrice: 122,
      unit: 'packet',
      stock: 120,
      minStock: 30,
      brand: 'Fortune',
      sku: 'OIL-SUN-01',
      description: 'Refined sunflower cooking oil'
    });
  } else if (type === 'customers') {
    const sheet = workbook.addWorksheet('Customers Template');
    sheet.columns = [
      { header: 'Customer Name*', key: 'name', width: 25 },
      { header: 'Mobile Number*', key: 'mobile', width: 18 },
      { header: 'Customer Type (public/hotel/pg_hostel)', key: 'customerType', width: 32 },
      { header: 'Credit Limit (Rs)', key: 'creditLimit', width: 18 },
      { header: 'Street Address', key: 'street', width: 25 },
      { header: 'Area', key: 'area', width: 18 },
      { header: 'City', key: 'city', width: 14 },
      { header: 'Pincode', key: 'pincode', width: 12 },
      { header: 'Email', key: 'email', width: 22 }
    ];

    sheet.addRow({
      name: 'Suresh Patil',
      mobile: '9822012345',
      customerType: 'public',
      creditLimit: 5000,
      street: 'Flat 302, Sai Vihar',
      area: 'Kharadi',
      city: 'Pune',
      pincode: '411014',
      email: 'suresh.p@gmail.com'
    });
    sheet.addRow({
      name: 'Annapurna Mess',
      mobile: '9890123456',
      customerType: 'hotel',
      creditLimit: 25000,
      street: 'Shop 4, Market Yard',
      area: 'Wadgaon Sheri',
      city: 'Pune',
      pincode: '411014',
      email: 'annapurna@mess.com'
    });
  } else if (type === 'inventory') {
    const sheet = workbook.addWorksheet('Inventory Template');
    sheet.columns = [
      { header: 'SKU or Product Name*', key: 'identifier', width: 28 },
      { header: 'Stock Quantity*', key: 'stock', width: 16 },
      { header: 'Action (set/add/subtract)', key: 'action', width: 24 }
    ];

    sheet.addRow({
      identifier: 'RIC-KOL-01',
      stock: 250,
      action: 'set'
    });
    sheet.addRow({
      identifier: 'Toor Dal Premium',
      stock: 50,
      action: 'add'
    });
  }

  if (format === 'csv') {
    return await workbook.csv.writeBuffer();
  }
  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  VALID_CATEGORIES,
  VALID_UNITS,
  normalizeCategory,
  normalizeUnit,
  parseSpreadsheetBuffer,
  previewProducts,
  commitProducts,
  previewCustomers,
  commitCustomers,
  previewInventory,
  commitInventory,
  generateTemplate
};
