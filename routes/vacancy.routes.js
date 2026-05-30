const express = require('express');
const rateLimit = require('express-rate-limit');
const jwtLib = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const Vacancy = require('../models/VolunteerVacancy');
const Message = require('../models/Message');
const User = require('../models/User');
const security = require('../utils/security');

async function resolveSenderFromAuth(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.split(' ')[1];
    try {
      const decoded = jwtLib.verify(token, jwtConfig.secret);
      const user = await User.findById(decoded.id).select('-password -verificationCode -verificationExpires');
      if (user) return user;
    } catch (err) {
      console.warn('[AUTH] Invalid bearer token for vacancy message:', err.message);
    }
  }

  const sessionUserId = req.sessionUserId || req.session?.userId;
  if (sessionUserId) {
    try {
      const user = await User.findById(sessionUserId).select('-password -verificationCode -verificationExpires');
      return user || null;
    } catch (err) {
      console.warn('[AUTH] Invalid session user id for vacancy message:', err.message);
    }
  }

  return null;
}

const createVacancyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 vacancy creation requests per window
  message: 'Забагато запитів на створення вакансій. Спробуйте через хвилину.',
  standardHeaders: true,
  legacyHeaders: false,
});

const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6, // limit each IP to 6 message sends per window
  message: 'Занадто багато повідомлень. Спробуйте пізніше.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CREATE vacancy for authenticated user
router.post('/', createVacancyLimiter, authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Заголовок і опис вакансії обов’язкові' });
    }

    const titleResult = security.sanitizeAndValidateText(title, 200, 1);
    const descriptionResult = security.sanitizeAndValidateText(description, 5000, 1);
    if (!titleResult.valid || !descriptionResult.valid) {
      return res.status(400).json({ message: 'Невалідні дані вакансії' });
    }

    const vacancy = new Vacancy({
      title: titleResult.text,
      description: descriptionResult.text,
      createdBy: req.user._id,
      creatorRole: req.user.role || 'volunteer',
    });

    await vacancy.save();
    res.status(201).json({ vacancy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Не вдалося створити вакансію' });
  }
});

// GET all vacancies
router.get('/', async (req, res) => {
  try {
    const vacancies = await Vacancy.find({ status: 'open' })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email role');

    res.json({ vacancies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Не вдалося завантажити вакансії' });
  }
});

// GET single vacancy by id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!security.validateObjectId(id)) {
      return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
    }
    const vacancy = await Vacancy.findById(id).populate('createdBy', 'name email role');
    if (!vacancy) return res.status(404).json({ message: 'Вакансія не знайдена' });
    res.json({ vacancy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Не вдалося завантажити вакансію' });
  }
});

// Send message to vacancy owner (stored as internal message, encrypted)
router.post('/:id/message', sendMessageLimiter, async (req, res) => {
  try {
    const sender = await resolveSenderFromAuth(req);
    const id = req.params.id;
    if (!security.validateObjectId(id)) {
      return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
    }
    const { subject, body } = req.body || {};
    if (!subject || !body) return res.status(400).json({ message: 'Subject and body required' });
    const vacancy = await Vacancy.findById(id);
    if (!vacancy) return res.status(404).json({ message: 'Вакансія не знайдена' });
    const recipientId = vacancy.createdBy;
    // sanitize and validate subject/body
    const subjRes = security.sanitizeAndValidateText(subject, 200, 1);
    const bodyRes = security.sanitizeAndValidateText(body, 5000, 1);
    if (!subjRes.valid || !bodyRes.valid) return res.status(400).json({ message: 'Невалідні дані повідомлення' });
    // encrypt body
    const enc = security.encryptText(bodyRes.text);
    const fromLabel = sender ? `${sender.name || sender.email}` : 'Анонім';
    const msg = new Message({
      user: recipientId,
      sender: sender ? sender._id : null,
      subject: `${subjRes.text} — від ${fromLabel}`,
      body: enc,
    });
    await msg.save();
    return res.json({ message: 'Ваше повідомлення надіслано' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Не вдалося надіслати повідомлення' });
  }
});

module.exports = router;