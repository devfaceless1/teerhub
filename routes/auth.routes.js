const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // limit each IP to 8 login attempts per windowMs
  message: 'Занадто багато спроб входу, спробуйте пізніше.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const authLoginLimiterByEmail = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // limit each IP+email pair to 8 login attempts per windowMs
  message: 'Занадто багато спроб входу для цього облікового запису, спробуйте пізніше.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.body?.email?.toString().toLowerCase().trim();
    return `${req.ip}:${email || 'unknown'}`;
  },
});

const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 registration attempts per windowMs
  message: 'Занадто багато спроб реєстрації, спробуйте пізніше.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 verification-related requests per windowMs
  message: 'Занадто багато запитів, спробуйте пізніше.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLoginValidator = [
  body('email').trim().isEmail().withMessage('Невалідний email'),
  body('password').isString().withMessage('Пароль має бути текстовим полем').notEmpty().withMessage('Пароль не може бути порожнім'),
];

const authRegisterValidator = [
  body('email').trim().isEmail().withMessage('Невалідний email'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Пароль має бути 8-128 символів'),
  body('name').optional().isString().trim().isLength({ max: 100 }).withMessage('Ім’я занадто довге'),
  body('role').optional().isIn(['volunteer', 'organization']).withMessage('Невалідна роль'),
  body('goal').optional().isString().trim().isLength({ max: 1000 }).withMessage('Goal занадто довгий'),
  body('motivation').optional().isString().trim().isLength({ max: 2000 }).withMessage('Motivation занадто довга'),
];

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array();
    return res.status(400).json({ message: formatted[0]?.msg || 'Невірні дані', errors: formatted });
  }
  next();
};

router.post('/request-code', authCodeLimiter, authCtrl.requestVerification);
router.post('/verify-code', authCodeLimiter, authCtrl.verifyCode);
router.post('/complete', authRegisterLimiter, authRegisterValidator, validateRequest, authCtrl.completeRegistration);
router.post('/login', authLoginLimiterByEmail, authLoginLimiter, authLoginValidator, validateRequest, authCtrl.login);
router.post('/logout', authCtrl.logout);
router.get('/logout', authCtrl.logout);
router.get('/me', authCtrl.getCurrentUser);

module.exports = router;
