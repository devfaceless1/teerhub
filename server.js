require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const mongoSanitize = require('express-mongo-sanitize');
const security = require('./utils/security');
const dbConfig = require('./config/db');
const validationMiddleware = require('./middleware/validation.middleware');
const authMiddleware = require('./middleware/auth.middleware');
const authController = require('./controllers/auth.controller');

if (!process.env.MESSAGE_ENC_KEY) {
  console.warn('[SECURITY] MESSAGE_ENC_KEY is not configured. Message decryption will fail for encrypted messages.');
}

const app = express();

// Only enable `trust proxy` when explicitly configured. Do not enable automatically for production.
if (process.env.TRUST_PROXY && (process.env.TRUST_PROXY.toLowerCase() === 'true' || process.env.TRUST_PROXY === '1')) {
  app.set('trust proxy', 1);
  console.log('[SECURITY] trust proxy enabled');
}

// ========== SECURITY MIDDLEWARE ==========

// CORS
const allowedOrigins = (() => {
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

  const renderOrigin = process.env.RENDER_EXTERNAL_URL
    ? [process.env.RENDER_EXTERNAL_URL.trim()]
    : [];

  const origins = [...new Set([...envOrigins, ...renderOrigin])];
  return origins.length ? origins : ['http://localhost:3000'];
})();

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy does not allow access from this origin.'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

console.log('[CORS] Allowed origins:', allowedOrigins.join(', ') || 'none');

// Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Allow some inline styles (or switch to nonces). Many libs use inline styles.
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", "data:", "https:"],
      // Allow connections to the configured frontends/backends and HTTPS origins
      connectSrc: ["'self'", "https:", ...allowedOrigins],
      frameSrc: ["'none'"], // Prevent framing
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    blockAllMixedContent: true,
  },
  frameguard: { action: 'deny' }, // Prevent clickjacking
  noSniff: true, // Prevent MIME type sniffing
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // Control referrer info
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // HTTP Strict Transport Security
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // Prevent cross-domain policies
}));

// Disable X-Powered-By header to not leak technology stack
app.disable('x-powered-by');

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 30, // limit each IP to 30 API requests per windowMs
  message: 'Занадто багато запитів з цієї IP адреси, спробуйте пізніше.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Keep static assets outside the rate limit, but apply the limiter only to API requests below.
    return req.path.startsWith('/public') || req.path.match(/\.(js|css|img|png|jpg|gif|ico|svg|woff|woff2)$/i);
  },
});

// Rate limiting - authentication (stricter)
const authLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Занадто багато спроб входу, спробуйте пізніше.',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting only to API routes, not to page or static requests.
app.use('/api', generalLimiter);

// Body parsing with size limits to prevent DoS attacks
app.use(express.json({ limit: '10kb' })); // Limit JSON payload
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Use express-mongo-sanitize to remove any keys containing '$' or '.'.
// This is more reliable than scanning raw JSON strings and avoids false positives.
app.use(mongoSanitize());

// Custom validation and sanitization middleware
app.use(validationMiddleware.validateAndSanitize);

// ========== SESSION MIDDLEWARE ==========
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET required');
}
const sessionSecret = process.env.SESSION_SECRET;

const sessionStore = MongoStore.create({ 
  mongoUrl: dbConfig.uri,
  touchAfter: 24 * 3600, // lazy session update (in seconds)
});

sessionStore.on('error', err => {
  console.error('[SESSION STORE ERROR]', err && err.message ? err.message : err);
});

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
  },
  name: 'teerhub_session', // Custom session cookie name
}));

// Auto-restore user from session
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    // Attach user ID to request for later use
    req.sessionUserId = req.session.userId;
  }
  next();
});

// PAGES ROUTES
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/settings', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/chat', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/vacancy', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vacancy.html'));
});

app.get('/profile', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Logout should be a state-changing POST
app.post('/logout', authController.logout);

app.get('/404', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Protect direct access to sensitive page files as well as protected routes.
const protectedPageFiles = ['/dashboard.html', '/settings.html', '/chat.html', '/vacancy.html', '/profile.html'];
app.use(async (req, res, next) => {
  if (protectedPageFiles.includes(req.path)) {
    return authMiddleware(req, res, next);
  }
  next();
});

// ========== STATIC FILES ==========
app.use(express.static(path.join(__dirname, 'public')));

// API routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const vacancyRoutes = require('./routes/vacancy.routes');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/vacancies', vacancyRoutes);

// ========== ERROR HANDLING MIDDLEWARE ==========

// 404 handler
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }

  res.status(404).json({ 
    message: 'Ресурс не знайдено',
    status: 404 
  });
});

// Global error handler - prevent information leakage
app.use((err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  console.error('[ERROR]', err.message);
  if (isDevelopment && err.stack) console.error(err.stack);

  // Don't expose internal error details to client
  const status = err.status || err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response = {
    message: status === 500 
      ? 'Внутрішня помилка сервера. Будь ласка, спробуйте пізніше.'
      : err.message || 'Помилка при обробці запиту',
    status,
  };

  // Only include stack trace in development
  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
});

// Connect to MongoDB
mongoose.connect(dbConfig.uri)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });