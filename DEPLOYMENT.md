# 🚀 Гайд по розгортанню з безпекою - TeerHub

## Передумови розгортання

### 1. Оновлення залежностей

```bash
npm install
npm audit
npm audit fix
```

### 2. Конфігурація Environment Variables

Створіть файл `.env` у корені проекту:

```env
# ===== SECURITY =====
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ===== DATABASE =====
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/teerhub?retryWrites=true&w=majority

# ===== JWT =====
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
JWT_EXPIRES_IN=7d

# ===== EMAIL (optional) =====
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### 3. HTTPS Setup (обов'язково для production)

#### За допомогою Nginx (рекомендується):

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL сертифікат (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL параметри для безпеки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS заголовок
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## ✅ Перевірка безпеки перед розгортанням

### 1. Базова перевірка

```bash
# Перевірити синтаксис Node.js файлів
node -c server.js
node -c middleware/validation.middleware.js
node -c controllers/auth.controller.js

# Перевірити уразливості в залежностях
npm audit
```

### 2. Тестування XSS захисту

```javascript
// Спробуйте реєстрацію з:
{
  "email": "test@example.com",
  "password": "SecurePass123!",
  "name": "<img src=x onerror='alert(1)'>",
  "role": "volunteer"
}

// ✅ Очікується помилка: "Ім'я містить недопустимі символи"
```

### 3. Тестування SQL/NoSQL Injection

```javascript
// Спробуйте вхід з:
{
  "email": "test'; DROP TABLE users; --",
  "password": "anything"
}

// ✅ Очікується помилка: "Невірні облікові дані"
```

### 4. Тестування Rate Limiting

```bash
# Спробуйте 6 запитів на /api/auth/login за 15 хвилин
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrongpass"}'
done

# ✅ 6-й запит має повернути 429 Too Many Requests
```

### 5. Тестування CORS

```bash
# З іншого домену (замініть origin):
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://attacker.com" \
  -d '{"email":"test@test.com","password":"pass"}'

# ✅ Очікується блокування якщо attacker.com не в ALLOWED_ORIGINS
```

---

## 📊 Моніторинг безпеки

### 1. Логування

Всі безпекові інциденти логуються з префіксом `[SECURITY]` або `[ERROR]`:

```bash
# Переглядати логи в реальному часі:
tail -f /var/log/teerhub/server.log | grep "\[SECURITY\]"
```

### 2. Регулярні аудити

```bash
# Щомісячно перевіряйте уразливості:
npm audit

# Оновіть критичні залежності:
npm install --save-dev npm-check-updates
npx ncu -u
npm install
```

### 3. Database Security

```javascript
// Переконайтеся, що MongoDB має:
// 1. Аутентифікацію (username/password)
// 2. Network Access List (whitelist IPs)
// 3. Encryption at rest (MongoDB Atlas)
// 4. Encryption in transit (TLS 1.2+)
```

---

## 🔐 Процедури безпеки для розробників

### 1. Обов'язково для всіх форм вводу:

```javascript
// ❌ НЕПРАВИЛЬНО:
const user = await User.findOne({ email: req.body.email });

// ✅ ПРАВИЛЬНО:
const emailResult = security.sanitizeAndValidateEmail(req.body.email);
if (!emailResult.valid) {
  return res.status(400).json({ message: emailResult.error });
}
const user = await User.findOne({ email: emailResult.email });
```

### 2. Ніколи не довіряйте клієнту:

```javascript
// ❌ НЕПРАВИЛЬНО:
if (req.body.isAdmin) { ... }

// ✅ ПРАВИЛЬНО:
if (req.user.role === 'admin' && req.user.id === EXPECTED_ADMIN_ID) { ... }
```

### 3. Завжди валідуйте типи даних:

```javascript
// ❌ НЕПРАВИЛЬНО:
const count = req.body.count;
for (let i = 0; i < count; i++) { ... }

// ✅ ПРАВИЛЬНО:
const countResult = security.sanitizeAndValidateNumber(req.body.count, 0, 100);
if (!countResult.valid) {
  return res.status(400).json({ message: countResult.error });
}
```

---

## 🐛 Розповсюджене питання та відповіді

### Q: Чому я бачу помилки "Невалідна email адреса"?
**A:** Це означає, що на сервері виявлена невалідна email. Перевіріть, що надсилаєте коректний email формат.

### Q: Мій пароль не приймається, хоча я впевнений, що він правильний
**A:** Пароль повинен мати:
- Мінімум 8 символів
- Хоча б одну ВЕЛИКУ букву
- Хоча б одну малу букву
- Хоча б одну цифру
- Хоча б один спеціальний символ (@, $, !, %, *, ?, &, ^, #)

### Q: Я отримав "Занадто багато запитів" - що далі?
**A:** Це rate limiting. Зачекайте 15 хвилин або змініть IP адресу (не рекомендується для production).

### Q: Як я можу видити логи безпеки?
**A:** На сервері запустіть:
```bash
grep "\[SECURITY\]\|\[ERROR\]" /var/log/teerhub/server.log
```

---

## 🚨 Інцидент-реагування

### Якщо ви підозрюєте атаку:

1. **Перевірте логи:**
   ```bash
   grep "\[SECURITY\]" server.log | tail -50
   ```

2. **Визначте тип атаки:**
   - Brute Force? → Перевірте Rate Limiting логи
   - XSS? → Перевірте логи валідації
   - SQL Injection? → Перевірте mongoSanitize логи

3. **Займайтесь інцидентом:**
   ```bash
   # Перезавантажте сервер
   pm2 restart teerhub
   
   # Перевірте статус
   pm2 status teerhub
   
   # Переглядайте логи
   pm2 logs teerhub --lines 100
   ```

---

## 📖 Корисні документи

- [OWASP TOP 10](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/nodejs-security/)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)

---

## 🎓 Чеклист перед production розгортанням

- [ ] Скопіюйте `.env.example` в `.env` та заповніть всі значення
- [ ] Активуйте HTTPS (SSL/TLS сертифікат)
- [ ] Встановіть правильні ALLOWED_ORIGINS
- [ ] Запустіть `npm audit` та виправте уразливості
- [ ] Перевірте, що NODE_ENV=production
- [ ] Налаштуйте базу даних MongoDB з аутентифікацією
- [ ] Активуйте network access list в MongoDB
- [ ] Запустіть всі тести безпеки (див. вище)
- [ ] Налаштуйте моніторинг та логування
- [ ] Налаштуйте CORS для вашого домену
- [ ] Перевірте JWT_SECRET складність (мін. 32 символи)
- [ ] Налаштуйте регулярні бекапи БД
- [ ] Документуйте всі секрети у безпечному місці
- [ ] Налаштуйте email алертів для критичних помилок
