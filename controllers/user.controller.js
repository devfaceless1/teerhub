const Message = require('../models/Message');
const Vacancy = require('../models/VolunteerVacancy');
const User = require('../models/User');
const security = require('../utils/security');

module.exports = {
  getMe: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }

      await req.user.populate('ratings.ratedBy', 'name');
      const ratings = (req.user.ratings || []).map((r) => ({
        ratedBy: r.ratedBy ? { id: r.ratedBy._id.toString(), name: r.ratedBy.name } : null,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
      }));
      const ratingCount = ratings.length;
      const ratingAverage = ratingCount
        ? Number((ratings.reduce((acc, item) => acc + item.score, 0) / ratingCount).toFixed(1))
        : 0;

      return res.json({ 
        user: {
          id: req.user._id.toString(),
          email: req.user.email,
          showEmail: typeof req.user.showEmail === 'undefined' ? true : !!req.user.showEmail,
          name: req.user.name || null,
          role: req.user.role,
          isVerified: req.user.isVerified,
          joinedProgram: req.user.joinedProgram,
          createdAt: req.user.createdAt,
          ratings,
          ratingCount,
          ratingAverage,
        }
      });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося завантажити профіль' });
    }
  },

  joinProgram: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }
      if (req.user.role !== 'volunteer') {
        return res.status(403).json({ message: 'Тільки волонтери можуть приєднуватись до програми' });
      }
      if (req.user.joinedProgram) {
        return res.json({ message: 'Ви вже приєднані до волонтерської програми', joinedProgram: true });
      }
      req.user.joinedProgram = true;
      await req.user.save();
      return res.json({ message: 'Ви приєдналися до волонтерської програми', joinedProgram: true });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося оновити профіль' });
    }
  },

  getMessages: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }
      let messages = await Message.find({
        $or: [{ user: req.user._id }, { sender: req.user._id }],
      })
        .sort({ createdAt: -1 })
        .populate('sender', 'name email')
        .populate('user', 'name email');
      if (!messages.length && req.user.role === 'volunteer') {
        await Message.create([
          {
            user: req.user._id,
            subject: 'Вітаємо в TeerHub',
            body: 'Ваш кабінет готовий. Додайте вакансію та приєднайтеся до волонтерської програми в налаштуваннях профілю.',
          },
          {
            user: req.user._id,
            subject: 'Початок роботи',
            body: 'Тепер ви можете керувати своїми волонтерськими заявками й отримувати повідомлення від організацій.',
          },
        ]);
        messages = await Message.find({
          $or: [{ user: req.user._id }, { sender: req.user._id }],
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'name email')
          .populate('user', 'name email');
      }
      // Decrypt bodies if encrypted
      const securityMod = require('../utils/security');
      const out = messages.map(m => {
        const decrypted = securityMod.decryptText(m.body);
        const body = decrypted !== null
          ? decrypted
          : (typeof m.body === 'string' && /^[A-Za-z0-9+/=]+$/.test(m.body) && m.body.length > 40
              ? 'Повідомлення зашифроване. Перевірте MESSAGE_ENC_KEY або SESSION_SECRET у налаштуваннях сервера.'
              : m.body);
        const fromMe = m.sender && m.sender._id.toString() === req.user._id.toString();
        const partner = fromMe ? m.user : m.sender;
        return {
          _id: m._id,
          subject: m.subject,
          body,
          read: m.read,
          createdAt: m.createdAt,
          fromMe,
          partner: partner ? {
            id: partner._id.toString(),
            name: partner.name || partner.email || 'Користувач',
          } : null,
          canReply: !!partner,
        };
      });
      return res.json({ messages: out || [] });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося завантажити повідомлення' });
    }
  },

  replyMessage: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }
      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор повідомлення' });
      }
      const { body } = req.body || {};
      const original = await Message.findById(id);
      if (!original) {
        return res.status(404).json({ message: 'Повідомлення не знайдено' });
      }
      const isRecipient = original.user.toString() === req.user._id.toString();
      const isSender = original.sender && original.sender.toString() === req.user._id.toString();

      if (!isRecipient && !isSender) {
        return res.status(403).json({ message: 'Немає доступу до відповіді на це повідомлення' });
      }

      let recipientId = null;
      if (isRecipient) {
        recipientId = original.sender;
      } else if (isSender) {
        recipientId = original.user;
      }

      if (!recipientId) {
        return res.status(400).json({ message: 'Немає отримувача для відповіді' });
      }

      const bodyRes = security.sanitizeAndValidateText(body, 5000, 1);
      if (!bodyRes.valid) {
        return res.status(400).json({ message: bodyRes.error || 'Невірні дані повідомлення' });
      }

      const cleanedSubject = original.subject
        .replace(/^RE:\s*/i, '')
        .replace(/\s*—\s*від\s.*$/i, '')
        .trim();
      const replySubject = `RE: ${cleanedSubject}`;
      const encBody = security.encryptText(bodyRes.text);
      const reply = new Message({
        user: recipientId,
        sender: req.user._id,
        subject: replySubject,
        body: encBody,
      });
      await reply.save();
      return res.json({ message: 'Ваша відповідь надіслана' });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося надіслати відповідь' });
    }
  },

  sendMessage: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }
      const targetUserId = req.params.id;
      if (!security.validateObjectId(targetUserId)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор користувача' });
      }

      if (req.user._id.toString() === targetUserId) {
        return res.status(400).json({ message: 'Ви не можете надіслати повідомлення собі' });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Користувач не знайдено' });
      }

      const { body, subject } = req.body || {};
      const bodyResult = security.sanitizeAndValidateText(body, 5000, 1);
      if (!bodyResult.valid) {
        return res.status(400).json({ message: bodyResult.error || 'Невірні дані повідомлення' });
      }

      const subjectText = subject && typeof subject === 'string' && subject.trim()
        ? subject.trim()
        : `Повідомлення від ${req.user.name || req.user.email || 'користувача'}`;

      const encBody = security.encryptText(bodyResult.text);
      const message = new Message({
        user: targetUser._id,
        sender: req.user._id,
        subject: subjectText,
        body: encBody,
      });
      await message.save();
      return res.json({ message: 'Повідомлення надіслано' });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося надіслати повідомлення' });
    }
  },

  getVacancies: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }
      const vacancies = await Vacancy.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
      return res.json({ vacancies: vacancies || [] });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося завантажити вакансії' });
    }
  },

  // Public profile for any user id — excludes private fields like password
  // Returns user public info and list of created vacancies with ratings
  getPublicProfile: async (req, res) => {
    try {
      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор користувача' });
      }

      const user = await User.findById(id).populate('ratings.ratedBy', 'name');
      if (!user) return res.status(404).json({ message: 'Користувач не знайдено' });

      const vacancies = await Vacancy.find({ createdBy: id })
        .sort({ createdAt: -1 })
        .select('title description location tags status createdAt');

      const ratings = (user.ratings || []).map(r => ({
        ratedBy: r.ratedBy ? { id: r.ratedBy._id.toString(), name: r.ratedBy.name } : null,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
      }));
      const ratingCount = ratings.length;
      const ratingAverage = ratingCount
        ? Number((ratings.reduce((acc, item) => acc + item.score, 0) / ratingCount).toFixed(1))
        : 0;

      return res.json({
        user: {
          id: user._id.toString(),
          email: user.showEmail === false ? null : user.email,
          showEmail: typeof user.showEmail === 'undefined' ? true : !!user.showEmail,
          name: user.name || null,
          role: user.role,
          isVerified: user.isVerified,
          joinedProgram: user.joinedProgram,
          goal: user.goal || null,
          motivation: user.motivation || null,
          createdAt: user.createdAt,
          ratingCount,
          ratingAverage,
          ratings,
        },
        vacancies: vacancies || [],
      });
    } catch (err) {
      console.error('[ERROR] Get public profile error:', err.message);
      return res.status(500).json({ message: 'Не вдалося отримати профіль' });
    }
  },

  // Update own profile (name and showEmail)
  // SECURITY: Only the authenticated user can update their own profile
  // Authorization: Checked via authMiddleware (req.user is set by middleware)
  // Request: PUT /api/user/me (no ID parameter - always updates current user)
  updateMe: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });
      
      // Explicit security check: users can only update their own profile
      // This prevents any potential authorization bypass
      if (!req.user._id) {
        return res.status(401).json({ message: 'Помилка авторизації' });
      }

      const { name, showEmail } = req.body;

      if (typeof name !== 'undefined') {
        const nameResult = security.sanitizeAndValidateName(name);
        if (!nameResult.valid) return res.status(400).json({ message: nameResult.error || 'Ім\'я містить недопустимі символи' });
        req.user.name = nameResult.name;
      }

      if (typeof showEmail !== 'undefined') {
        req.user.showEmail = !!showEmail;
      }

      await req.user.save();
      return res.json({ message: 'Профіль оновлено', user: { id: req.user._id.toString(), name: req.user.name, showEmail: req.user.showEmail } });
    } catch (err) {
      console.error('[ERROR] Update profile error:', err.message);
      return res.status(500).json({ message: 'Не вдалося оновити профіль' });
    }
  },

  // Saved vacancies (bookmarks)
  getSavedVacancies: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });
      await req.user.populate({ path: 'savedVacancies', options: { sort: { createdAt: -1 } } });
      return res.json({ saved: req.user.savedVacancies || [] });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося завантажити збережені вакансії' });
    }
  },

  saveVacancy: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });
      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
      }
      const vacancy = await Vacancy.findById(id);
      if (!vacancy) return res.status(404).json({ message: 'Вакансія не знайдена' });
      const exists = (req.user.savedVacancies || []).some(x => x.toString() === id);
      if (!exists) {
        req.user.savedVacancies = req.user.savedVacancies || [];
        req.user.savedVacancies.push(vacancy._id);
        await req.user.save();
      }
      return res.json({ message: 'Вакансія збережена' });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося зберегти вакансію' });
    }
  },

  unsaveVacancy: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });
      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
      }
      req.user.savedVacancies = (req.user.savedVacancies || []).filter(x => x.toString() !== id);
      await req.user.save();
      return res.json({ message: 'Вакансія видалена зі збережених' });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося видалити вакансію зі збережених' });
    }
  },

  createVacancy: async (req, res) => {
    try {
      // Authorization check
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }
      
      // Allow both volunteers and organizations/companies (and admins) to create vacancies
      if (!['volunteer', 'organization', 'company', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Немає прав для створення вакансії' });
      }

      const {
        title,
        description,
        location,
        contactName,
        contactEmail,
        contactPhone,
        tags,
      } = req.body;

      // ========== SERVER-SIDE VALIDATION ==========

      // Required fields
      if (!title || !description) {
        return res.status(400).json({ message: 'Заголовок і опис вакансії обов\'язкові' });
      }

      // Validate title
      const titleResult = security.sanitizeAndValidateText(title, 200);
      if (!titleResult.valid) {
        return res.status(400).json({ message: titleResult.error || 'Заголовок містить недопустимі символи' });
      }

      // Validate description
      const descriptionResult = security.sanitizeAndValidateText(description, 5000);
      if (!descriptionResult.valid) {
        return res.status(400).json({ message: descriptionResult.error || 'Опис містить недопустимі символи' });
      }

      // Validate optional fields
      let validatedLocation = null;
      if (location) {
        const locationResult = security.sanitizeAndValidateText(location, 200);
        if (!locationResult.valid) {
          return res.status(400).json({ message: locationResult.error || 'Локація містить недопустимі символи' });
        }
        validatedLocation = locationResult.text;
      }

      let validatedContactName = null;
      if (contactName) {
        const nameResult = security.sanitizeAndValidateName(contactName);
        if (!nameResult.valid) {
          return res.status(400).json({ message: nameResult.error || 'Ім\'я контакту містить недопустимі символи' });
        }
        validatedContactName = nameResult.name;
      }

      let validatedContactEmail = null;
      if (contactEmail) {
        const emailResult = security.sanitizeAndValidateEmail(contactEmail);
        if (!emailResult.valid) {
          return res.status(400).json({ message: emailResult.error || 'Email контакту невалідний' });
        }
        validatedContactEmail = emailResult.email;
      }

      let validatedContactPhone = null;
      if (contactPhone) {
        const phoneResult = security.sanitizeAndValidatePhone(contactPhone);
        if (!phoneResult.valid) {
          return res.status(400).json({ message: phoneResult.error || 'Телефон контакту невалідний' });
        }
        validatedContactPhone = phoneResult.phone;
      }

      // Validate tags array
      let validatedTags = [];
      if (tags) {
        const tagsResult = security.sanitizeAndValidateStringArray(tags, 5, 50);
        if (!tagsResult.valid) {
          return res.status(400).json({ message: tagsResult.error || 'Теги містять недопустимі символи' });
        }
        validatedTags = tagsResult.array;
      }

      // Create vacancy with validated data
      const vacancy = new Vacancy({
        title: titleResult.text,
        description: descriptionResult.text,
        location: validatedLocation,
        contactName: validatedContactName,
        contactEmail: validatedContactEmail,
        contactPhone: validatedContactPhone,
        tags: validatedTags,
        createdBy: req.user._id,
        creatorRole: req.user.role || 'volunteer',
      });

      await vacancy.save();
      
      return res.status(201).json({ 
        message: 'Вакансія успішно створена',
        vacancy: {
          id: vacancy._id.toString(),
          title: vacancy.title,
          description: vacancy.description,
          location: vacancy.location,
          tags: vacancy.tags,
        }
      });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалось додати вакансію' });
    }
  },

  updateVacancy: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });

      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
      }
      const vacancy = await Vacancy.findById(id);
      if (!vacancy) return res.status(404).json({ message: 'Вакансія не знайдена' });

      // SECURITY: Only the creator or admin can edit this vacancy
      // Verify ownership before allowing any modifications
      if (vacancy.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Немає прав для редагування цієї вакансії' });
      }

      const {
        title,
        description,
        location,
        contactName,
        contactEmail,
        contactPhone,
        tags,
      } = req.body;

      if (title) {
        const titleResult = security.sanitizeAndValidateText(title, 200);
        if (!titleResult.valid) return res.status(400).json({ message: titleResult.error || 'Заголовок містить недопустимі символи' });
        vacancy.title = titleResult.text;
      }

      if (description) {
        const descriptionResult = security.sanitizeAndValidateText(description, 5000);
        if (!descriptionResult.valid) return res.status(400).json({ message: descriptionResult.error || 'Опис містить недопустимі символи' });
        vacancy.description = descriptionResult.text;
      }

      if (location !== undefined) {
        if (location) {
          const locationResult = security.sanitizeAndValidateText(location, 200);
          if (!locationResult.valid) return res.status(400).json({ message: locationResult.error || 'Локація містить недопустимі символи' });
          vacancy.location = locationResult.text;
        } else {
          vacancy.location = null;
        }
      }

      if (contactName !== undefined) {
        if (contactName) {
          const nameResult = security.sanitizeAndValidateName(contactName);
          if (!nameResult.valid) return res.status(400).json({ message: nameResult.error || 'Ім\'я контакту містить недопустимі символи' });
          vacancy.contactName = nameResult.name;
        } else {
          vacancy.contactName = null;
        }
      }

      if (contactEmail !== undefined) {
        if (contactEmail) {
          const emailResult = security.sanitizeAndValidateEmail(contactEmail);
          if (!emailResult.valid) return res.status(400).json({ message: emailResult.error || 'Email контакту невалідний' });
          vacancy.contactEmail = emailResult.email;
        } else {
          vacancy.contactEmail = null;
        }
      }

      if (contactPhone !== undefined) {
        if (contactPhone) {
          const phoneResult = security.sanitizeAndValidatePhone(contactPhone);
          if (!phoneResult.valid) return res.status(400).json({ message: phoneResult.error || 'Телефон контакту невалідний' });
          vacancy.contactPhone = phoneResult.phone;
        } else {
          vacancy.contactPhone = null;
        }
      }

      if (tags !== undefined) {
        if (tags) {
          const tagsResult = security.sanitizeAndValidateStringArray(tags, 5, 50);
          if (!tagsResult.valid) return res.status(400).json({ message: tagsResult.error || 'Теги містять недопустимі символи' });
          vacancy.tags = tagsResult.array;
        } else {
          vacancy.tags = [];
        }
      }

      await vacancy.save();
      return res.json({ message: 'Вакансія оновлена', vacancy });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося оновити вакансію' });
    }
  },

  deleteVacancy: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });
      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
      }
      const vacancy = await Vacancy.findById(id);
      if (!vacancy) return res.status(404).json({ message: 'Вакансія не знайдена' });
      
      // SECURITY: Only the creator or admin can delete this vacancy
      // Verify ownership before allowing deletion
      if (vacancy.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Немає прав для видалення цієї вакансії' });
      }
      await Vacancy.deleteOne({ _id: id });
      return res.json({ message: 'Вакансія видалена' });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося видалити вакансію' });
    }
  },

  toggleVacancyStatus: async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Не авторизовано' });
      const id = req.params.id;
      if (!security.validateObjectId(id)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор вакансії' });
      }
      const vacancy = await Vacancy.findById(id);
      if (!vacancy) return res.status(404).json({ message: 'Вакансія не знайдена' });
      
      // SECURITY: Only the creator or admin can change vacancy status
      // Verify ownership before allowing status change
      if (vacancy.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Немає прав для зміни статусу цієї вакансії' });
      }
      vacancy.status = vacancy.status === 'open' ? 'closed' : 'open';
      await vacancy.save();
      return res.json({ message: 'Статус вакансії оновлено', status: vacancy.status });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося змінити статус вакансії' });
    }
  },

  addRating: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Не авторизовано' });
      }

      const targetUserId = req.params.id;
      const { score, comment } = req.body;

      // Validate target user exists
      if (!security.validateObjectId(targetUserId)) {
        return res.status(400).json({ message: 'Невірний ідентифікатор користувача' });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Користувач не знайдено' });
      }

      // Prevent rating yourself
      if (req.user._id.toString() === targetUserId) {
        return res.status(400).json({ message: 'Ви не можете оцінювати себе' });
      }

      // Validate score
      if (!score || score < 1 || score > 5 || !Number.isInteger(score)) {
        return res.status(400).json({ message: 'Оцінка повинна бути числом від 1 до 5' });
      }

      // Validate comment
      let validatedComment = '';
      if (comment) {
        if (typeof comment !== 'string') {
          return res.status(400).json({ message: 'Коментар повинен бути текстом' });
        }

        if (comment.length > 500) {
          return res.status(400).json({ message: 'Коментар не може бути довшим за 500 символів' });
        }

        const commentResult = security.sanitizeAndValidateText(comment, 500);
        if (!commentResult.valid) {
          return res.status(400).json({ message: commentResult.error || 'Коментар містить недопустимі символи' });
        }
        validatedComment = commentResult.text;
      }

      // Check if user already rated this person
      const existingRating = (targetUser.ratings || []).find(r => 
        r.ratedBy && r.ratedBy.toString() === req.user._id.toString()
      );

      if (existingRating) {
        // Update existing rating
        existingRating.score = score;
        existingRating.comment = validatedComment;
        existingRating.createdAt = new Date();
      } else {
        // Create new rating
        if (!targetUser.ratings) targetUser.ratings = [];
        targetUser.ratings.push({
          ratedBy: req.user._id,
          score,
          comment: validatedComment,
          createdAt: new Date()
        });
      }

      await targetUser.save();
      return res.json({ message: 'Оцінка збережена', rating: { score, comment: validatedComment } });
    } catch (err) {
      console.error('[ERROR]', err.message);
      return res.status(500).json({ message: 'Не вдалося додати оцінку' });
    }
  },
};
