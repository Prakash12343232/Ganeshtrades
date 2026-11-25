const mongoose = require('mongoose');

const UNIQUE_SPARSE_FIELDS = ['mobile', 'email', 'googleId'];

// Google accounts are created without a mobile number. If a production
// database still carries a non-sparse unique index on `mobile` (or explicit
// null values), every Google signup after the first one fails with a
// duplicate-key error even though the email and Google ID are brand new.
// Repair the indexes so sparse uniqueness behaves as the schema intends.
const repairUniqueIndexes = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const User = require('../models/User');
  const collection = User.collection;

  try {
    await User.init();
  } catch (error) {
    console.warn(`⚠️ User model index init skipped: ${error.message}`);
  }

  for (const field of UNIQUE_SPARSE_FIELDS) {
    try {
      const cleaned = await collection.updateMany(
        { $or: [{ [field]: null }, { [field]: '' }] },
        { $unset: { [field]: '' } }
      );
      if (cleaned.modifiedCount > 0) {
        console.log(`🔧 User index repair: cleared empty ${field} on ${cleaned.modifiedCount} document(s)`);
      }
    } catch (error) {
      console.warn(`⚠️ User index repair: could not clear empty ${field}: ${error.message}`);
    }
  }

  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (error) {
    if (error.codeName === 'NamespaceNotFound') return;
    console.warn(`⚠️ User index repair: could not list indexes: ${error.message}`);
    return;
  }

  for (const field of UNIQUE_SPARSE_FIELDS) {
    const existing = indexes.find(
      (index) => index.key && Object.keys(index.key).length === 1 && index.key[field] === 1
    );

    if (existing && existing.unique && existing.sparse) continue;

    try {
      if (existing) {
        await collection.dropIndex(existing.name);
        console.log(`🔧 User index repair: dropped ${existing.name}`);
      }
      await collection.createIndex(
        { [field]: 1 },
        { unique: true, sparse: true, name: `${field}_1` }
      );
      console.log(`🔧 User index repair: ensured sparse unique index on ${field}`);
    } catch (error) {
      console.error(`⚠️ User index repair: ${field} index not rebuilt: ${error.message}`);
    }
  }
};

const ensureUserIndexes = async () => {
  try {
    await repairUniqueIndexes();
  } catch (error) {
    console.error(`⚠️ User index verification failed: ${error.message}`);
  }
};

module.exports = { ensureUserIndexes };
