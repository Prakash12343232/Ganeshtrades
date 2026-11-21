const User = require('../models/User');
const { ensureUserIndexes } = require('../utils/userIndexes');

const dropUserIndexes = async () => {
  const indexes = await User.collection.indexes();
  for (const index of indexes) {
    if (index.name !== '_id_') {
      await User.collection.dropIndex(index.name);
    }
  }
};

describe('User unique index repair', () => {
  beforeEach(async () => {
    await User.init();
    await dropUserIndexes();
  });

  afterEach(async () => {
    await dropUserIndexes();
  });

  it('rebuilds a non-sparse unique mobile index so multiple Google users can be created', async () => {
    await User.collection.createIndex({ mobile: 1 }, { unique: true, name: 'mobile_1' });

    await User.create({
      name: 'First Google',
      email: 'first-google@example.com',
      googleId: 'google-sub-first',
      authProvider: 'google'
    });

    await expect(User.create({
      name: 'Second Google',
      email: 'second-google@example.com',
      googleId: 'google-sub-second',
      authProvider: 'google'
    })).rejects.toMatchObject({ code: 11000 });

    await ensureUserIndexes();

    const second = await User.create({
      name: 'Second Google',
      email: 'second-google@example.com',
      googleId: 'google-sub-second',
      authProvider: 'google'
    });
    expect(second._id).toBeDefined();
    expect(second.mobile).toBeUndefined();

    const indexes = await User.collection.indexes();
    const mobileIndex = indexes.find((index) => index.name === 'mobile_1');
    expect(mobileIndex.unique).toBe(true);
    expect(mobileIndex.sparse).toBe(true);
  });

  it('removes explicit null values that break sparse uniqueness', async () => {
    await User.collection.createIndex({ mobile: 1 }, { unique: true, sparse: true, name: 'mobile_1' });
    await User.collection.insertOne({
      name: 'Null Mobile',
      mobile: null,
      email: 'null-mobile@example.com'
    });

    await ensureUserIndexes();

    const stored = await User.collection.findOne({ email: 'null-mobile@example.com' });
    expect(stored.mobile).toBeUndefined();
  });
});
