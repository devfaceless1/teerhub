const security = require('../utils/security');

/**
 * Legacy function for backwards compatibility
 */
function sanitizeInput(input) {
  return security.sanitizeString(input);
}

/**
 * Legacy function for backwards compatibility
 */
function sanitizeEmail(email) {
  const result = security.sanitizeAndValidateEmail(email);
  return result.valid ? result.email : '';
}

/**
 * Legacy function for backwards compatibility
 */
function sanitizeUrl(url) {
  const result = security.sanitizeAndValidateUrl(url);
  return result.valid ? result.url : '';
}

/**
 * Legacy function for backwards compatibility
 */
function isValidEmail(email) {
  const result = security.sanitizeAndValidateEmail(email);
  return result.valid;
}

/**
 * Legacy function for backwards compatibility
 */
function isValidPassword(password) {
  const result = security.sanitizeAndValidatePassword(password);
  return result.valid;
}

/**
 * Legacy function for backwards compatibility
 */
function isValidName(name) {
  const result = security.sanitizeAndValidateName(name);
  return result.valid;
}

/**
 * Legacy function for backwards compatibility
 */
function isValidPhone(phone) {
  const result = security.sanitizeAndValidatePhone(phone);
  return result.valid;
}

/**
 * Legacy function for backwards compatibility
 */
function isValidStringArray(arr) {
  const result = security.sanitizeAndValidateStringArray(arr);
  return result.valid;
}

/**
 * Enhanced middleware to validate and sanitize request body
 * Prevents XSS, SQL injection, and other attacks
 */
function validateAndSanitize(req, res, next) {
  // Check for suspicious patterns in non-password fields across body, query, and params.
  const excludedKeys = ['password', 'confirmPassword', 'currentPassword', 'newPassword'];
  const sources = ['body', 'query', 'params'];

  for (const sourceName of sources) {
    const source = req[sourceName];
    if (!source || typeof source !== 'object') continue;

    for (const [key, value] of Object.entries(source)) {
      if (excludedKeys.includes(key)) continue;

      if (typeof value === 'string' && security.checkSuspiciousPatterns(value)) {
        console.warn(`Suspicious pattern detected in ${sourceName} field: ${key}`);
        return res.status(400).json({ message: 'Невалідне значення в запиті' });
      }

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string' && security.checkSuspiciousPatterns(item)) {
              console.warn(`Suspicious pattern detected in ${sourceName} array field: ${key}`);
              return res.status(400).json({ message: 'Невалідне значення в запиті' });
            }
          }
        } else {
          const nestedValue = JSON.stringify(value);
          if (security.checkSuspiciousPatterns(nestedValue)) {
            console.warn(`Suspicious pattern detected in ${sourceName} field: ${key}`);
            return res.status(400).json({ message: 'Невалідне значення в запиті' });
          }
        }
      }
    }
  }

  // Normalize request containers to objects to avoid undefined access.
  req.body = security.sanitizeRequestBody(req.body || {}, 0, excludedKeys) || {};
  req.query = security.sanitizeRequestBody(req.query || {}, 0, excludedKeys) || {};
  req.params = security.sanitizeRequestBody(req.params || {}, 0, excludedKeys) || {};

  // Sanitize email
  if (req.body && req.body.email) {
    const emailResult = security.sanitizeAndValidateEmail(req.body.email);
    if (!emailResult.valid) {
      return res.status(400).json({ message: 'Невалідна email адреса' });
    }
    req.body.email = emailResult.email;
  }

  // Sanitize password
  if (req.body.password) {
    const passwordResult = security.sanitizeAndValidatePassword(req.body.password);
    if (!passwordResult.valid) {
      return res.status(400).json({ message: 'Пароль не відповідає вимогам безпеки' });
    }
  }

  // Sanitize name
  if (req.body.name) {
    const nameResult = security.sanitizeAndValidateName(req.body.name);
    if (!nameResult.valid) {
      return res.status(400).json({ message: 'Ім\'я містить недопустимі символи' });
    }
    req.body.name = nameResult.name;
  }

  // Sanitize text fields
  const textFields = ['title', 'description', 'location', 'subject', 'body', 'motivation', 'goal', 'contactName'];
  for (const field of textFields) {
    if (req.body[field]) {
      const textResult = security.sanitizeAndValidateText(req.body[field], 5000);
      if (!textResult.valid) {
        return res.status(400).json({ message: `${field} містить недопустимі символи` });
      }
      req.body[field] = textResult.text;
    }
  }

  // Sanitize contact email
  if (req.body.contactEmail) {
    const emailResult = security.sanitizeAndValidateEmail(req.body.contactEmail);
    if (req.body.contactEmail && !emailResult.valid) {
      return res.status(400).json({ message: 'Невалідна контактна email адреса' });
    }
    req.body.contactEmail = emailResult.email;
  }

  // Sanitize phone
  if (req.body.contactPhone) {
    const phoneResult = security.sanitizeAndValidatePhone(req.body.contactPhone);
    if (!phoneResult.valid) {
      return res.status(400).json({ message: 'Невалідний формат телефону' });
    }
    req.body.contactPhone = phoneResult.phone;
  }

  // Validate tags array
  if (req.body.tags) {
    const tagsResult = security.sanitizeAndValidateStringArray(req.body.tags, 3, 50);
    if (!tagsResult.valid) {
      return res.status(400).json({ message: 'Теги містять недопустимі символи' });
    }
    req.body.tags = tagsResult.array;
  }

  next();
}

module.exports = {
  sanitizeInput,
  sanitizeEmail,
  sanitizeUrl,
  isValidEmail,
  isValidPassword,
  isValidName,
  isValidPhone,
  isValidStringArray,
  validateAndSanitize,
};
