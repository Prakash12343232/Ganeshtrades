const mongoose = require('mongoose');

/**
 * MongoDB multi-document transactions require a replica set or sharded
 * cluster. Standalone servers (including the in-memory test server by
 * default) do not support them, so callers fall back to the original
 * non-transactional path while production keeps full atomicity.
 */
function supportsTransactions() {
  try {
    const type = mongoose.connection?.client?.topology?.description?.type;
    return type === 'ReplicaSetWithPrimary' || type === 'Sharded' || type === 'LoadBalanced';
  } catch (error) {
    return false;
  }
}

async function withTransaction(fn) {
  if (!supportsTransactions()) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction, supportsTransactions };
