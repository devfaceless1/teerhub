const jwtLib = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('-password -verificationCode -verificationExpires');
      if (!user) {
        if (req.accepts('html')) {
          return res.redirect('/login');
        }
        return res.status(401).json({ message: 'Invalid session' });
      }

      req.user = user;
      return next();
    }

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      if (req.accepts('html')) {
        return res.redirect('/login');
      }
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = auth.split(' ')[1];
    const decoded = jwtLib.verify(token, jwtConfig.secret);
    const user = await User.findById(decoded.id).select('-password -verificationCode -verificationExpires');
    if (!user) {
      if (req.accepts('html')) {
        return res.redirect('/login');
      }
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error', err);
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};
