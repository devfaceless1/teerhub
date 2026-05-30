/**
 * Security utilities for input validation, sanitization, and XSS/SQL injection prevention
 */

const validator = require('validator');
const xss = require('xss');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Message encryption settings
const ENC_ALGO = 'aes-256-gcm';
function getEncKey() {
  const raw = process.env.MESSAGE_ENC_KEY || process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error('MESSAGE_ENC_KEY or SESSION_SECRET is required for encryption operations.');
  }
  return crypto.createHash('sha256').update(String(raw)).digest(); // 32 bytes
}

function encryptText(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const key = getEncKey();
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptText(payload) {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const data = Buffer.from(payload, 'base64');
    if (data.length < 29) return null;

    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);

    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
      return null;
    }

    const key = getEncKey();
    const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('Decrypt failed', err.message);
    return null;
  }
}

/**
 * Strict XSS prevention - remove all HTML tags and dangerous characters
 */
function cleanXSS(input) {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes
  let cleaned = input.replace(/\0/g, '');
  
  // Use xss library for comprehensive XSS prevention
  cleaned = xss(cleaned, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoredTag: true,
    stripLeakage: true,
  });
  
  // Additional sanitization
  cleaned = cleaned
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
  
  return cleaned;
}

/**
 * Validate and sanitize email
 */
function sanitizeAndValidateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, email: null, error: 'Email is required' };
  }
  
  const cleaned = email.trim().toLowerCase();
  
  // Check for XSS attempts
  if (cleaned !== cleanXSS(cleaned)) {
    return { valid: false, email: null, error: 'Invalid email format' };
  }
  
  // Validate email format
  if (!validator.isEmail(cleaned)) {
    return { valid: false, email: null, error: 'Invalid email address' };
  }
  
  // Check max length
  if (cleaned.length > 255) {
    return { valid: false, email: null, error: 'Email is too long' };
  }
  
  return { valid: true, email: cleaned, error: null };
}

/**
 * Validate and sanitize password
 */
function sanitizeAndValidatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  // Check for null bytes and control characters
  if (/[\x00-\x1F\x7F]/.test(password)) {
    return { valid: false, error: 'Password contains invalid characters' };
  }
  
  // Min 8 chars, at least one uppercase, lowercase, digit, and special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+=\-\[\]{};':"\\|,.<>?\/~`]).{8,128}$/;
  
  if (!passwordRegex.test(password)) {
    return { 
      valid: false, 
      error: 'Password must be 8-128 characters with uppercase, lowercase, digit, and special character' 
    };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' };
  }
  
  return { valid: true, error: null };
}

/**
 * Sanitize string input - remove XSS vectors
 */
function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return null;
  }
  
  let cleaned = input
    .trim()
    .slice(0, maxLength); // Truncate to max length
  
  // Remove null bytes and control characters
  cleaned = cleaned.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Use xss library
  cleaned = xss(cleaned, {
    whiteList: {},
    stripIgnoredTag: true,
    stripLeakage: true,
  });
  
  return cleaned;
}

/**
 * Sanitize name field
 */
function sanitizeAndValidateName(name, maxLength = 100) {
  if (!name || typeof name !== 'string') {
    return { valid: false, name: null, error: 'Name is required' };
  }
  
  let cleaned = sanitizeString(name, maxLength);
  
  if (!cleaned || cleaned.length === 0) {
    return { valid: false, name: null, error: 'Name is required' };
  }
  
  // Allow letters (including Cyrillic), spaces, hyphens, apostrophes
  // But reject if it looks like an injection attempt
  const nameRegex = /^[a-zA-Zа-яА-ЯіІєЄґҐ\s\-'`\.]{1,100}$/;
  
  if (!nameRegex.test(cleaned)) {
    return { valid: false, name: null, error: 'Name contains invalid characters' };
  }
  
  return { valid: true, name: cleaned, error: null };
}

/**
 * Sanitize and validate phone number
 */
function sanitizeAndValidatePhone(phone) {
  if (!phone) {
    return { valid: true, phone: null, error: null }; // Optional field
  }
  
  if (typeof phone !== 'string') {
    return { valid: false, phone: null, error: 'Phone must be a string' };
  }
  
  const cleaned = phone.trim();
  
  // Allow digits, spaces, +, -, (), but reject anything else
  const phoneRegex = /^[\d\s\-\+\(\)]{5,20}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { valid: false, phone: null, error: 'Invalid phone format' };
  }
  
  if (cleaned.length > 20) {
    return { valid: false, phone: null, error: 'Phone number is too long' };
  }
  
  return { valid: true, phone: cleaned, error: null };
}

/**
 * Sanitize and validate URL
 */
function sanitizeAndValidateUrl(url, maxLength = 2048) {
  if (!url || typeof url !== 'string') {
    return { valid: true, url: null, error: null }; // Optional field
  }
  
  const cleaned = sanitizeString(url, maxLength);
  
  if (!cleaned) {
    return { valid: false, url: null, error: 'Invalid URL format' };
  }
  
  // Validate URL structure
  if (!validator.isURL(cleaned, { require_protocol: true })) {
    return { valid: false, url: null, error: 'Invalid URL format' };
  }
  
  // Ensure it's http or https only
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return { valid: false, url: null, error: 'URL must use http or https protocol' };
  }
  
  return { valid: true, url: cleaned, error: null };
}

/**
 * Validate MongoDB ObjectId
 */
function validateObjectId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Sanitize array of strings (tags, skills, etc.)
 */
function sanitizeAndValidateStringArray(arr, maxItems = 10, maxItemLength = 100) {
  if (!Array.isArray(arr)) {
    return { valid: false, array: null, error: 'Must be an array' };
  }
  
  if (arr.length === 0) {
    return { valid: true, array: [], error: null };
  }
  
  if (arr.length > maxItems) {
    return { valid: false, array: null, error: `Maximum ${maxItems} items allowed` };
  }
  
  const cleaned = arr
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item, maxItemLength))
    .filter(item => item && item.length > 0);
  
  if (cleaned.length === 0) {
    return { valid: true, array: [], error: null };
  }
  
  return { valid: true, array: cleaned, error: null };
}

/**
 * Sanitize text field (description, bio, etc.)
 */
function sanitizeAndValidateText(text, maxLength = 5000, minLength = 0) {
  if (!text && minLength > 0) {
    return { valid: false, text: null, error: 'This field is required' };
  }
  
  if (!text) {
    return { valid: true, text: null, error: null }; // Optional field
  }
  
  if (typeof text !== 'string') {
    return { valid: false, text: null, error: 'Must be a string' };
  }
  
  let cleaned = sanitizeString(text, maxLength);
  
  if (cleaned.length < minLength) {
    return { valid: false, text: null, error: `Minimum ${minLength} characters required` };
  }
  
  return { valid: true, text: cleaned, error: null };
}

/**
 * Sanitize numeric input
 */
function sanitizeAndValidateNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { valid: false, number: null, error: 'Must be a valid number' };
  }
  
  if (num < min || num > max) {
    return { valid: false, number: null, error: `Number must be between ${min} and ${max}` };
  }
  
  return { valid: true, number: num, error: null };
}

/**
 * Validate enum value
 */
function validateEnum(value, allowedValues) {
  if (!value) {
    return { valid: false, error: 'Value is required' };
  }
  
  if (!allowedValues.includes(value)) {
    return { valid: false, error: `Invalid value. Allowed: ${allowedValues.join(', ')}` };
  }
  
  return { valid: true, error: null };
}

/**
 * Check for suspicious patterns (potential injection attempts)
 */
function checkSuspiciousPatterns(input) {
  if (typeof input !== 'string') return false;
  
  const suspiciousPatterns = [
    /<script/gi, // Script tags
    /javascript:/gi, // JS protocol
    /onerror\s*=/gi, // Event handlers
    /onload\s*=/gi,
    /<iframe/gi, // Iframe injection
    /union\s+select/gi, // SQL UNION
    /drop\s+table/gi, // SQL DROP
    /insert\s+into/gi, // SQL INSERT
    /update\s+.*set/gi, // SQL UPDATE
    /delete\s+from/gi, // SQL DELETE
    /exec\s*\(/gi, // Exec functions
    /eval\s*\(/gi, // Eval functions
    /shell_exec/gi, // Shell execution
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize entire request body recursively
 */
function sanitizeRequestBody(obj, depth = 0, excludedKeys = []) {
  if (depth > 10) return null; // Prevent deep recursion attacks
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeRequestBody(item, depth + 1, excludedKeys));
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Reject keys with suspicious patterns
    if (checkSuspiciousPatterns(key)) {
      console.warn(`Suspicious key detected: ${key}`);
      continue;
    }
    
    if (typeof value === 'string') {
      if (excludedKeys.includes(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeString(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeRequestBody(value, depth + 1, excludedKeys);
    } else if (typeof value !== 'undefined') {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

module.exports = {
  cleanXSS,
  sanitizeAndValidateEmail,
  sanitizeAndValidatePassword,
  sanitizeString,
  sanitizeAndValidateName,
  sanitizeAndValidatePhone,
  sanitizeAndValidateUrl,
  validateObjectId,
  sanitizeAndValidateStringArray,
  sanitizeAndValidateText,
  sanitizeAndValidateNumber,
  validateEnum,
  checkSuspiciousPatterns,
  sanitizeRequestBody,
  encryptText,
  decryptText,
};
