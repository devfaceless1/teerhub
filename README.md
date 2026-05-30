# TeerHub

Локальний репозиторій програми TeerHub — простий бекенд і фронтенд для платформи волонтерських вакансій.

## Швидкий старт

### Вимоги
- **Node.js** 18+ і **npm**
- **MongoDB** (локально на `localhost:27017` або через MongoDB Atlas)

### Кроки

#### 1. Клонувати репозиторій
```bash
git clone https://github.com/devfaceless1/teerhubua.git
cd teerhubua
```

#### 2. Встановити залежності
```bash
npm install
```

#### 3. Налаштувати середовище (`.env`)

**Для локального запуску:**
```bash
cp .env.example .env
```

Потім відредагуйте `.env` і встановіть:

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/teerhub
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-key-here
MESSAGE_ENC_KEY=your-encryption-key-here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

> **Зверніть увагу**: На localhost `MONGO_URI` буде `mongodb://localhost:27017/teerhub`. Для MongoDB Atlas скопіюйте connection string із ваших налаштувань.

#### 4. Запустити додаток

```bash
npm start
```

Сервер запуститься на `http://localhost:3000`.

#### 5. Перевірка

Відкрийте браузер і перейдіть на `http://localhost:3000`. Ви маєте бачити домашню сторінку.

---

## Налаштування MongoDB локально

### З Docker (рекомендовано)

```bash
docker compose up -d
# MongoDB запуститься на localhost:27017
# Підключення: mongodb://localhost:27017/teerhub
```

### Без Docker

1. **Встановіть MongoDB** (якщо не встановлено):
   - macOS: `brew install mongodb-community`
   - Ubuntu: `sudo apt-get install -y mongodb`
   - Windows: Завантажте з https://www.mongodb.com/try/download/community

2. **Запустіть MongoDB**:
   - macOS/Linux: `brew services start mongodb-community`
   - Windows: MongoDB запуститься як служба автоматично

3. **Перевірте з'єднання**:
   ```bash
   mongosh  # або mongo (для старих версій)
   # Вхід у MongoDB shell
   ```

---

## Використання MongoDB Atlas (Хмара)

Якщо ви хочете використовувати хмарне сховище:

1. Створіть аккаунт на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Створіть cluster і database user
3. Скопіюйте connection string
4. Встановіть у `.env`:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/teerhub?retryWrites=true&w=majority
   ```

## Docker (тестова середа)

Щоб швидко підняти Mongo і додаток через Docker Compose:

```bash
docker compose up --build
```

## Змінні оточення

Додай у `.env` наступні змінні (див. `.env.example`):

- `PORT` - порт (за замовчуванням 3000)
- `MONGO_URI` - mongodb connection string
- `JWT_SECRET` - секрет для JWT
- `JWT_EXPIRES_IN` - термін дії JWT (наприклад, `7d`)
- `SESSION_SECRET` - секрет для сесій
- `MESSAGE_ENC_KEY` - ключ для шифрування повідомлень (можна використати той самий що `SESSION_SECRET`)
- `SESSION_SAME_SITE` - `lax` або `strict` для cookie сесії; `lax` краще працює у проксі/публічних середовищах
- `ALLOWED_ORIGINS` - перелік дозволених origin для CORS (через кому)
- `TRUST_PROXY` - встановіть `1` або `true` у хмарному середовищі з проксі (Render, Heroku тощо)
- `HSTS_MAX_AGE` - час HSTS у секундах (наприклад, `31536000`)
- `LOG_LEVEL` - рівень логування (`info`, `warn`, `error`)
- `RATE_LIMIT_GENERAL` - загальний ліміт запитів
- `RATE_LIMIT_AUTH` - ліміт автентифікації
- `MAX_JSON_SIZE` - максимальний розмір JSON запиту
- `MAX_URL_SIZE` - максимальний розмір URL-encoded запиту

## Розробка

### Auto-restart під час розробки
```bash
npm run dev  # Запускає nodemon для автоматичного перезагрузження
```

Переконайтесь, що встановили `nodemon`:
```bash
npm install --save-dev nodemon
```

### Перевірка синтаксису
```bash
node -c server.js
node -c controllers/auth.controller.js
```

### Audit для безпеки
```bash
npm audit
npm audit fix  # Встановити патчі
```

---

## Розгортання

### На Render.com

1. Залийте код на GitHub
2. Підключите репозиторій до Render
3. Встановіть環境 змінні на Render:
   ```
   NODE_ENV=production
   PORT=10000 (Render встановлює автоматично)
   MONGO_URI=<ваша MongoDB Atlas URI>
   JWT_SECRET=<випадковий 32+ символи>
   SESSION_SECRET=<випадковий 32+ символи>
   MESSAGE_ENC_KEY=<випадковий 32+ символи>
   ALLOWED_ORIGINS=https://<ваш-домен>.onrender.com
   TRUST_PROXY=true
   ```
4. Deploy!

> Див. [DEPLOYMENT.md](./DEPLOYMENT.md) для більш детальних інструкцій.

---

## Структура проекту

```
/config        - конфіг (database, JWT, mail)
/controllers   - логіка запитів (auth, user, organization)
/middleware    - middleware (auth, validation, role)
/models        - MongoDB моделі (User, Organization, тощо)
/routes        - API маршрути
/public        - статичні файли (HTML, CSS, JS)
/scripts       - утиліти та скрипти
/utils         - допоміжні функції (security, validation)
```

---

## Ліцензія

ISC

---

## Контрибуції

1. Fork репозиторій
2. Створіть feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit ваші зміни (`git commit -m 'Add some AmazingFeature'`)
4. Push до гілки (`git push origin feature/AmazingFeature`)
5. Відкрийте Pull Request


# teerhub
