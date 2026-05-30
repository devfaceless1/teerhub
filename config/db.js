const raw = process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? null : 'mongodb://localhost:27017/teerhub');

if (!raw) {
  throw new Error('MONGO_URI is required in production');
}

function ensureDb(uri, dbName = 'teerhub') {
  // if URI already contains a database segment (after host and before ?), return as-is
  // matches /host[:port]/<dbname> optionally followed by ?
  try {
    const hasDb = /\/[^\/\?]+(\?|$)/.test(uri.replace('mongodb+srv://', '').replace('mongodb://', ''));
    if (hasDb) return uri;
  } catch (e) {}
  // append database name (preserve query if present)
  const parts = uri.split('?');
  const base = parts[0].endsWith('/') ? parts[0] + dbName : parts[0] + '/' + dbName;
  return parts[1] ? base + '?' + parts[1] : base;
}

module.exports = {
  uri: ensureDb(raw, 'teerhub'),
};
