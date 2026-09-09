function clientErrorMessage(error, fallback = 'An unexpected error occurred. Please try again later.') {
  if (!error || typeof error.message !== 'string' || !error.message.trim()) return fallback;
  if (error.name === 'ValidationError' || error.exposed === true) return error.message;
  return fallback;
}

module.exports = { clientErrorMessage };