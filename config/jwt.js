module.exports = {
  secret: process.env.JWT_SECRET || (
    process.env.NODE_ENV === 'production' 
      ? (() => { throw new Error('JWT_SECRET is required in production'); })()
      : 'dev_secret_key_12345'  // Allow default in development
  ),
  expiresIn: '7d',
};
