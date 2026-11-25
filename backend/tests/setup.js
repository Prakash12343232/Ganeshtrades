
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryServer, MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

jest.setTimeout(300000); // 300 seconds timeout for in-memory MongoDB download

// Set MONGOMS_REPLICA_SET=true to exercise the real multi-document transaction
// path. The default single-node server keeps the suite fast and falls back to
// the non-transactional path.
const useReplicaSet = process.env.MONGOMS_REPLICA_SET === 'true';

let mongoServer;

beforeAll(async () => {
  mongoServer = useReplicaSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    : await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  }
});

const generateTestToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '1h'
  });
};

module.exports = { generateTestToken };
