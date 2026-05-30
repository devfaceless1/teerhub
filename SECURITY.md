# 🔒 Захист від XSS та SQL-інджекцій - TeerHub

## Огляд системи безпеки

Сервер TeerHub обладнаний комплексним захистом від наступних типів атак:
- **XSS (Cross-Site Scripting)** - впровадження шкідливого коду
- **SQL/NoSQL Injection** - впровадження шкідливих запитів в БД
- **CSRF (Cross-Site Request Forgery)**
- **Clickjacking** - перехоплення кліків
- **DoS (Denial of Service)** - атаки на відмову в обслуговуванні
- **Information Disclosure** - витік конфіденційної інформації

---

## 📋 Встановлені пакети безпеки

```json
{
  "helmet": "^7.1.0",                    // HTTP security headers
  "express-mongo-sanitize": "^2.2.0",   // NoSQL injection prevention
  "express-rate-limit": "^7.1.5",       // Rate limiting
  "validator": "^13.11.0",              // Input validation
  "cors": "^2.8.5",                     // Cross-origin requests
  "xss": "^1.0.14"                      // XSS prevention
}
```

---

## 🛡️ Рівні захисту

### 1. HTTP Security Headers (Helmet.js)

**Файл:** `server.js`

Налаштовано наступні заголовки:
- **Content-Security-Policy (CSP)** - обмежує джерела скриптів та ресурсів
- **X-Frame-Options: DENY** - запобігає clickjacking-атакам
- **X-Content-Type-Options: nosniff** - запобігає MIME-sniffing
- **X-XSS-Protection** - включає XSS-фільтр браузера
- **Strict-Transport-Security (HSTS)** - примушує використання HTTPS
- **Referrer-Policy** - контролює інформацію про referrer
- **Permissions-Policy** - обмежує API браузера

**Приклад CSP:**
```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  frameSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
}
```

### 2. CORS (Cross-Origin Resource Sharing)

**Файл:** `server.js`

```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

Тільки білі список доменів можуть робити запити до API.

### 3. Rate Limiting

**Файл:** `server.js`

- **Загальний ліміт:** 100 запитів за 15 хвилин на IP
- **Ліміт для входу (Auth):** 5 спроб за 15 хвилин
- **Статичні файли:** не враховуються в ліміту

### 4. Request Size Limits

**Файл:** `server.js`

```javascript
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

Запобігає DoS-атакам через великі payload'и.

### 5. NoSQL Injection Prevention

**Файл:** `server.js`

```javascript
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Sanitized suspicious key: ${key}`);
  },
}));
```

Автоматично очищує об'єкти запиту від небезпечних символів ($ та .).

---

## 🔐 Вхідна валідація та санітизація

### Утиліти безпеки

**Файл:** `utils/security.js`

Містить комплексний набір функцій:

#### 1. **cleanXSS(input)**
Видаляє всі HTML-теги та небезпечні символи
```javascript
// Input: '<script>alert("XSS")</script>'
// Output: 'alert("XSS")'
```

#### 2. **sanitizeAndValidateEmail(email)**
Валідує та очищує email адреси
```javascript
// Перевіряє формат
// Обмежує довжину до 255 символів
// Видаляє контрольні символи
```

#### 3. **sanitizeAndValidatePassword(password)**
Строгі вимоги до пароля:
- Мінімум 8 символів, максимум 128
- Обов'язково містити: GRANDES, малі букви, цифри, спеціальні символи
- Дозволені спеціальні символи: `@$!%*?&^#()_+=-[]{};\'":\|,.<>?/~` `

#### 4. **sanitizeAndValidateName(name)**
Дозволяє букви (включаючи кирилицю), пробіли, дефіси, апострофи
```javascript
// ✅ Валідні: John, Іван, Mary-Jane
// ❌ Невалідні: <script>, ../../../etc
```

#### 5. **sanitizeAndValidatePhone(phone)**
```javascript
// Дозволяє: цифри, пробіли, +, -, (), але не більше 20 символів
// Опціональне поле
```

#### 6. **sanitizeAndValidateUrl(url)**
```javascript
// Перевіряє URL формат
// Дозволяє тільки http:// та https://
// Максимум 2048 символів
```

#### 7. **sanitizeAndValidateText(text, maxLength, minLength)**
Для описів, коментарів та інших текстових полів:
- Видаляє HTML-теги
- Видаляє контрольні символи
- Обмежує довжину
- Перевіряє мінімальну довжину

#### 8. **checkSuspiciousPatterns(input)**
Перевіряє на шаблони атак:
```javascript
const suspiciousPatterns = [
  /['";\\]/g,           // SQL injection
  /<script/gi,          // Script injection
  /javascript:/gi,      // JS protocol
  /onerror=/gi,         // Event handlers
  /onload=/gi,
  /<iframe/gi,          // Iframe injection
  /union\s+select/gi,   // SQL UNION
  /drop\s+table/gi,     // SQL DROP
  /insert\s+into/gi,    // SQL INSERT
  /exec\s*\(/gi,        // Exec functions
  /eval\s*\(/gi,        // Eval functions
];
```

---

## 🔍 Middleware валідації

**Файл:** `middleware/validation.middleware.js`

Глобальний middleware застосовується до **всіх запитів**:

```javascript
function validateAndSanitize(req, res, next) {
  // 1. Перевіряє сідливі шаблони в усьому body
  // 2. Валідує email
  // 3. Валідує пароль
  // 4. Валідує імена
  // 5. Валідує текстові поля
  // 6. Валідує масиви (теги)
  // 7. Валідує телефони
}
```

---

## 🗝️ Контролер автентифікації

**Файл:** `controllers/auth.controller.js`

### Registration (`completeRegistration`)

**Server-side валідація:**
1. ✅ Email - перевіряється на формат та небезпечні символи
2. ✅ Password - перевіряється на складність
3. ✅ Name - валідується на дозволені символи
4. ✅ Role - валідується через enum (тільки 'volunteer' або 'organization')
5. ✅ Goal та Motivation - очищуються від HTML та контрольних символів

**Запобігання:​**
- Не дозволяє дублювання реєстрацій (email вже зареєстрований)
- Не видає точної інформації про помилку (XSS protection)
- Логує підозрілі спроби реєстрації

### Login (`login`)

**Server-side валідація:**
1. ✅ Email - санітизується та валідується
2. ✅ Password - перевіряється на підозрілі шаблони
3. ✅ Bcrypt - порівнює пароль безпечно
4. ✅ JWT - генерується з безпечними параметрами

**Запобігання:**
- Не розрізняє, чи користувач не існує або пароль неправильний (принцип "невірні облікові дані")
- Логує всі невдалі спроби входу
- Перевіряє на підозрілі шаблони в паролі

---

## 👤 Контролер користувача

**Файл:** `controllers/user.controller.js`

### createVacancy()

**Server-side валідація кожного поля:**
```javascript
✅ title         - макс 200 символів, видаляє HTML
✅ description   - макс 5000 символів, видаляє HTML
✅ location      - макс 200 символів
✅ contactName   - валідує як ім'я
✅ contactEmail  - валідує як email
✅ contactPhone  - валідує як телефон
✅ tags          - масив до 5 елементів, по 50 символів кожен
```

**Результат:**
- Всі поля занурюються через функції безпеки
- Повертаються только валідовані дані

---

## 🚨 Обробка помилок

**Файл:** `server.js`

### Global Error Handler
```javascript
// В production - не видає стек-трейс (запобігає інформаційному витоку)
// В development - показує деталі для налагодження
// Всі помилки логуються як [ERROR] для аудиту
```

### Response Status Codes
- `400` - невалідні вхідні дані
- `401` - не авторизовано
- `403` - заборонено (недостатньо прав)
- `404` - ресурс не знайдено
- `500` - внутрішня помилка (без деталей клієнту)

---

## 🔓 Непорушні правила

### ❌ Що НЕ робиться:

1. ❌ Не використовуються `eval()` або `Function()`
2. ❌ Не генеруються SQL запити конкатенацією рядків
3. ❌ Не зберігаються паролі в plaintext (bcryptjs з salt 10)
4. ❌ Не повертаються пароль в API response
5. ❌ Не показуються внутрішні помилки користувачам
6. ❌ Не дозволяється виконувати код від клієнта без валідації
7. ❌ Не зберігаються чутливі дані в localStorage без шифрування
8. ❌ Не використовуються `innerHTML` для користувацьких даних на сервері

### ✅ Що робиться:

1. ✅ Mongoose (параметризовані запити) для БД
2. ✅ Bcryptjs для хешування паролів
3. ✅ JWT для аутентифікації
4. ✅ HTTPS в production (HSTS заголовок)
5. ✅ Helmet для security headers
6. ✅ Rate limiting для api/auth endpoints
7. ✅ XSS бібліотека для очищення HTML
8. ✅ Validator.js для форматної валідації

---

## 📝 Логування безпеки

Усі потенційні інциденти логуються:

```javascript
console.warn(`[SECURITY] Sanitized suspicious key: ${key}`);
console.warn(`[SECURITY] Invalid email format in login: ${email}`);
console.warn(`[SECURITY] Suspicious patterns detected in password`);
console.warn(`[SECURITY] Failed login attempt for email: ${email}`);
console.error('[ERROR] Registration error:', err.message);
```

---

## 🧪 Тестування безпеки

### Приклади атак, які заблоковані:

**1. XSS атака в email:**
```javascript
// ❌ Input: '<img src=x onerror="alert(1)">'
// ✅ Виокаж помилка: "Невалідна email адреса"
```

**2. SQL Injection в password:**
```javascript
// ❌ Input: "'; DROP TABLE users; --"
// ✅ Результат: Перевіряє на pattern, потім bcrypt хешує
```

**3. NoSQL Injection в body:**
```javascript
// ❌ Input: { "email": { "$ne": null } }
// ✅ Результат: mongoSanitize заміняє $ на _
```

**4. Large Payload DoS:**
```javascript
// ❌ Payload > 10kb
// ✅ Результат: 413 Request Entity Too Large
```

**5. Brute Force Login:**
```javascript
// ❌ 6-та спроба за 15 хвилин
// ✅ Результат: 429 Too Many Requests
```

---

## 🔧 Конфігурація для production

Для production додайте в `.env`:

```env
# Security
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
PORT=443

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/teerhub
```

### Важливо:
1. Переконайтесь, що `NODE_ENV=production`
2. Активуйте HTTPS на сервері (nginx, Apache)
3. Встановіть правильні ALLOWED_ORIGINS
4. Регулярно оновлюйте залежності: `npm audit`
5. Моніторте логи безпеки

---

## 📚 Посилання

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js](https://helmetjs.github.io/)
- [XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
