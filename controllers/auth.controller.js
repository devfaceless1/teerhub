const crypto = require('crypto');
const User = require('../models/User');
const { MongoClient } = require('mongodb');
const security = require('../utils/security');

function ensureTelegramDbName(uri) {
  // we'll still connect with provided URI but explicitly select 'teerhub' database
  return { uri, dbName: 'teerhub' };
}

module.exports = {
  // Compatibility stub: originally requested a verification code. We no longer require email verification.
  requestVerification: async (req, res) => {
    return res.json({ message: 'Email verification skipped in this deployment' });
  },

  // Compatibility stub for verifyCode
  verifyCode: async (req, res) => {
    return res.json({ message: 'Email verification skipped in this deployment' });
  },

  // Create user directly (no verification step)
  completeRegistration: async (req, res) => {
    try {
      const { email, password, name, role, goal, motivation } = req.body;
      
      // ========== SERVER-SIDE VALIDATION ==========
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ message: 'Email та пароль обов\'язкові' });
      }

      // Validate email with strict server-side validation
      const emailResult = security.sanitizeAndValidateEmail(email);
      if (!emailResult.valid) {
        console.warn(`[SECURITY] Invalid email format in registration: ${email}`);
        return res.status(400).json({ message: 'Невалідна email адреса' });
      }

      // Validate password strength with strict requirements
      const passwordResult = security.sanitizeAndValidatePassword(password);
      if (!passwordResult.valid) {
        return res.status(400).json({ message: passwordResult.error || 'Пароль не відповідає вимогам безпеки' });
      }

      // Validate name if provided
      if (name) {
        const nameResult = security.sanitizeAndValidateName(name);
        if (!nameResult.valid) {
          console.warn(`[SECURITY] Invalid name format in registration: ${name}`);
          return res.status(400).json({ message: nameResult.error || 'Ім\'я містить недопустимі символи' });
        }
      }

      // Validate role - use enum validation
      if (role) {
        const roleResult = security.validateEnum(role, ['volunteer', 'organization']);
        if (!roleResult.valid) {
          console.warn(`[SECURITY] Invalid role in registration: ${role}`);
          return res.status(400).json({ message: roleResult.error || 'Невалідна роль' });
        }
      }

      // Validate optional text fields
      if (goal) {
        const goalResult = security.sanitizeAndValidateText(goal, 1000);
        if (!goalResult.valid) {
          return res.status(400).json({ message: goalResult.error || 'Goal містить недопустимі символи' });
        }
      }

      if (motivation) {
        const motivationResult = security.sanitizeAndValidateText(motivation, 2000);
        if (!motivationResult.valid) {
          return res.status(400).json({ message: motivationResult.error || 'Motivation містить недопустимі символи' });
        }
      }

      // ========== PREVENT DUPLICATE REGISTRATION ==========
      let user = await User.findOne({ email: emailResult.email });
      if (user && user.password) {
        return res.status(400).json({ message: 'Цей email вже зареєстрований' });
      }

      if (!user) {
        user = new User({ email: emailResult.email });
      }

      // Set password (bcryptjs will hash it)
      await user.setPassword(password);
      user.isVerified = true; // skip verification
      
      // Set optional fields
      if (name) {
        const nameResult = security.sanitizeAndValidateName(name);
        user.name = nameResult.name;
      }
      
      if (role) {
        user.role = role;
      }
      
      if (goal) {
        const goalResult = security.sanitizeAndValidateText(goal, 1000);
        user.goal = goalResult.text;
      }
      
      if (motivation) {
        const motivationResult = security.sanitizeAndValidateText(motivation, 2000);
        user.motivation = motivationResult.text;
      }

      await user.save();

      // Also insert a lightweight copy into the telegram app database (`teerhub`.users)
      try {
        const { uri, dbName } = ensureTelegramDbName(process.env.MONGO_URI || '');
        const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db(dbName);
        const coll = db.collection('users');
        const doc = {
          email: user.email,
          name: user.name || null,
          role: user.role,
          createdAt: user.createdAt || new Date(),
        };
        await coll.updateOne({ email: user.email }, { $set: doc }, { upsert: true });
        await client.close();
      } catch (e) {
        console.error('[ERROR] Failed to mirror user into teerhub.users:', e.message || e);
        // Don't fail registration if mirroring fails, but log it
      }

      return res.status(201).json({ message: 'Реєстрація завершена' });
    } catch (err) {
      console.error('[ERROR] Registration error:', err.message);
      // Don't expose internal error details
      return res.status(500).json({ message: 'Помилка під час реєстрації. Будь ласка, спробуйте пізніше.' });
    }
  },

  // Login (email + password)
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;
      
      // ========== SERVER-SIDE VALIDATION ==========
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email та пароль обов\'язкові' });
      }

      // Validate and sanitize email
      const emailResult = security.sanitizeAndValidateEmail(email);
      if (!emailResult.valid) {
        console.warn(`[SECURITY] Invalid email format in login: ${email}`);
        return res.status(401).json({ message: 'Невірні облікові дані' });
      }

      // Validate password format
      if (!password || typeof password !== 'string') {
        return res.status(401).json({ message: 'Невірні облікові дані' });
      }

      // Find user by sanitized email
      const user = await User.findOne({ email: emailResult.email });
      if (!user) {
        console.warn(`[SECURITY] Login attempt for non-existent email: ${emailResult.email}`);
        return res.status(401).json({ message: 'Невірні облікові дані' });
      }

      // Compare password (bcryptjs will handle the comparison)
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.warn(`[SECURITY] Failed login attempt for email: ${emailResult.email}`);
        return res.status(401).json({ message: 'Невірні облікові дані' });
      }

      // Ensure user has a password (registered properly)
      if (!user.password) {
        return res.status(401).json({ message: 'Облік користувача не активний' });
      }

      // Generate JWT token
      const jwt = require('../config/jwt');
      const jwtLib = require('jsonwebtoken');

      const token = jwtLib.sign(
        { id: user._id, role: user.role, email: user.email }, 
        jwt.secret, 
        { expiresIn: jwt.expiresIn }
      );

      const regenerateSession = () => new Promise((resolve, reject) => {
        if (!req.session || typeof req.session.regenerate !== 'function') {
          return resolve(req.session);
        }
        req.session.regenerate((err) => {
          if (err) return reject(err);
          resolve(req.session);
        });
      });

      const saveSession = (session) => new Promise((resolve, reject) => {
        if (!session || typeof session.save !== 'function') {
          return reject(new Error('Invalid session object during login'));
        }
        session.userId = user._id.toString();
        session.userEmail = user.email;
        session.userRole = user.role;

        session.save((saveErr) => {
          if (saveErr) return reject(saveErr);
          resolve();
        });
      });

      let activeSession;
      try {
        activeSession = await regenerateSession();
      } catch (sessionErr) {
        console.warn('[WARN] Session regenerate failed during login:', sessionErr.message || sessionErr);
        activeSession = req.session;
      }

      if (!activeSession) {
        return res.status(500).json({ message: 'Помилка при створенні сесії' });
      }

      try {
        await saveSession(activeSession);
      } catch (saveErr) {
        console.error('[ERROR] Session save failed during login:', saveErr.stack || saveErr);
        return res.status(500).json({ message: 'Помилка при збереженні сесії' });
      }

      return res.json({ 
        message: 'Вхід успішний', 
        token, 
        user: { 
          id: user._id.toString(), 
          email: user.email,
          role: user.role, 
          name: user.name || null 
        } 
      });
      return;
    } catch (err) {
      console.error('[ERROR] Login error:', err.stack || err);
      // Don't expose internal error details
      return res.status(500).json({ message: 'Помилка під час входу. Будь ласка, спробуйте пізніше.' });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      const clearSessionCookie = () => {
        res.clearCookie('teerhub_session', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.SESSION_SAME_SITE || 'lax',
          maxAge: 0,
          expires: new Date(0),
        });
      };

      const destroyCurrentSession = () => new Promise((resolve, reject) => {
        if (!req.session || typeof req.session.destroy !== 'function') {
          return resolve();
        }
        req.session.destroy((err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      await destroyCurrentSession();

      if (req.sessionStore && typeof req.sessionStore.destroy === 'function' && req.sessionID) {
        await new Promise((resolve, reject) => {
          req.sessionStore.destroy(req.sessionID, (err) => {
            if (err) return reject(err);
            return resolve();
          });
        });
      }

      clearSessionCookie();
      if (req.accepts('html')) {
        return res.redirect('/login');
      }
      return res.json({ message: 'Успішно вийшли' });
    } catch (err) {
      console.error('[ERROR] Logout error:', err.message || err);
      return res.status(500).json({ message: 'Помилка при виході з системи' });
    }
  },

  // Get current session user
  getCurrentUser: async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: 'Не увійшли' });
      }

      const user = await User.findById(req.session.userId).select('-password -verificationCode -verificationExpires');
      if (!user) {
        return res.status(401).json({ message: 'Користувач не знайдений' });
      }

      // Generate fresh token if needed
      const jwt = require('../config/jwt');
      const jwtLib = require('jsonwebtoken');
      const token = jwtLib.sign(
        { id: user._id, role: user.role, email: user.email }, 
        jwt.secret, 
        { expiresIn: jwt.expiresIn }
      );

      return res.json({ 
        user: { 
          id: user._id.toString(), 
          email: user.email,
          name: user.name || null,
          role: user.role 
        },
        token,
      });
    } catch (err) {
      console.error('[ERROR] Get current user error:', err.message);
      return res.status(500).json({ message: 'Помилка при отриманні даних користувача' });
    }
  },
};
