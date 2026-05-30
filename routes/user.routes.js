const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userCtrl = require('../controllers/user.controller');

router.get('/me', authMiddleware, userCtrl.getMe);
router.put('/me', authMiddleware, userCtrl.updateMe);
router.post('/join-program', authMiddleware, userCtrl.joinProgram);
router.get('/messages', authMiddleware, userCtrl.getMessages);
router.post('/messages/:id/reply', authMiddleware, userCtrl.replyMessage);
router.get('/vacancies', authMiddleware, userCtrl.getVacancies);
router.get('/saved', authMiddleware, userCtrl.getSavedVacancies);
router.post('/vacancies', authMiddleware, userCtrl.createVacancy);
router.put('/vacancies/:id', authMiddleware, userCtrl.updateVacancy);
router.delete('/vacancies/:id', authMiddleware, userCtrl.deleteVacancy);
router.post('/vacancies/:id/toggle', authMiddleware, userCtrl.toggleVacancyStatus);
router.post('/saved/:id', authMiddleware, userCtrl.saveVacancy);
router.delete('/saved/:id', authMiddleware, userCtrl.unsaveVacancy);

// Rating routes
router.post('/:id/message', authMiddleware, userCtrl.sendMessage);
router.post('/:id/rating', authMiddleware, userCtrl.addRating);

// Public profile (view by id) - does not require authentication
// Must be last route so it doesn't interfere with other :id routes
router.get('/:id', userCtrl.getPublicProfile);

module.exports = router;
