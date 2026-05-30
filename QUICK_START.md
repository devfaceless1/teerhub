# 🚀 Quick Start Checklist - TeerHub Security

## Before Running the Server

- [ ] **Install dependencies**
  ```bash
  npm install
  ```

- [ ] **Copy environment template**
  ```bash
  cp .env.example .env
  ```

- [ ] **Edit .env file**
  ```bash
  nano .env  # or your preferred editor
  ```
  
  Required changes:
  - [ ] Set `NODE_ENV=production` (if production)
  - [ ] Generate and set `JWT_SECRET` (min 32 random chars)
  - [ ] Set `MONGO_URI` to your MongoDB connection
  - [ ] Set `ALLOWED_ORIGINS` to your domain(s)

- [ ] **Check for security vulnerabilities**
  ```bash
  npm audit
  npm audit fix  # if issues found
  ```

- [ ] **Verify Node.js syntax**
  ```bash
  node -c server.js
  node -c controllers/auth.controller.js
  node -c controllers/user.controller.js
  ```

---

## Starting the Server

```bash
# Development
npm start

# OR with nodemon for auto-restart
npx nodemon server.js
```

---

## Testing Security (Critical!)

### 1. Start the server first
```bash
npm start
# Server should be running on http://localhost:3000
```

### 2. Test XSS Protection
```bash
curl -X POST http://localhost:3000/api/auth/complete \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "<img src=x onerror=alert(1)>",
    "role": "volunteer"
  }'

# Should return: Error - "Ім'я містить недопустимі символи"
```

### 3. Test SQL Injection Protection
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com\"; DROP TABLE users; --",
    "password": "anything"
  }'

# Should return: Error - "Невалідна email адреса"
```

### 4. Test Rate Limiting
```bash
# Run 6 login attempts quickly (5 is the limit)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# 6th attempt should return: 429 Too Many Requests
```

### 5. Test Password Requirements
```bash
curl -X POST http://localhost:3000/api/auth/complete \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "weak",
    "role": "volunteer"
  }'

# Should return error explaining password requirements
```

---

## Production Deployment Checklist

- [ ] **Environment variables set correctly**
  ```bash
  echo $NODE_ENV        # Should be: production
  echo $JWT_SECRET      # Should be set (min 32 chars)
  echo $ALLOWED_ORIGINS # Should be your domain
  ```

- [ ] **HTTPS/SSL configured**
  - [ ] Valid SSL certificate installed
  - [ ] HSTS header enabled (Helmet does this)
  - [ ] Redirect HTTP → HTTPS

- [ ] **Database security**
  - [ ] MongoDB authentication enabled
  - [ ] Database backup configured
  - [ ] IP whitelist set in MongoDB

- [ ] **Server hardening**
  - [ ] Firewall configured
  - [ ] Non-root user running Node.js
  - [ ] Process monitoring (PM2, systemd, etc.)

- [ ] **Monitoring configured**
  - [ ] Error logging to file
  - [ ] Security event logging
  - [ ] Performance monitoring
  - [ ] Alert system for critical errors

- [ ] **Security headers verified**
  ```bash
  curl -I https://yourdomain.com | grep -i "strict-transport\|x-content\|x-frame"
  # Should show security headers
  ```

- [ ] **CORS whitelist verified**
  - [ ] Only authorized domains in ALLOWED_ORIGINS
  - [ ] Wildcard * not used in production

---

## Common Issues & Solutions

### Issue: "JWT_SECRET is not set"
**Solution:**
```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output and set in .env
JWT_SECRET=<paste_here>
```

### Issue: "MONGO_URI connection failed"
**Solution:**
- [ ] Verify MongoDB is running
- [ ] Check connection string format
- [ ] Verify IP whitelist in MongoDB Atlas
- [ ] Check username/password

### Issue: "Port 3000 already in use"
**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Issue: "npm install fails"
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## After Deployment

- [ ] **Verify server is running**
  ```bash
  curl http://localhost:3000/
  # Should return home page or 200 OK
  ```

- [ ] **Test API endpoints**
  ```bash
  # Registration
  curl -X POST http://localhost:3000/api/auth/complete ...
  
  # Login
  curl -X POST http://localhost:3000/api/auth/login ...
  ```

- [ ] **Check error logs**
  ```bash
  tail -f /var/log/teerhub/server.log | grep "\[ERROR\]\|\[SECURITY\]"
  ```

- [ ] **Monitor security events**
  ```bash
  grep "\[SECURITY\]" /var/log/teerhub/server.log
  ```

---

## Regular Maintenance

- [ ] **Weekly**: Check security logs for anomalies
- [ ] **Weekly**: Verify backups are working
- [ ] **Monthly**: Run `npm audit` and update packages
- [ ] **Quarterly**: Security review and penetration testing
- [ ] **Annually**: Full security audit

---

## Support & Resources

📚 **Documentation:**
- `SECURITY.md` - Detailed security documentation
- `SECURITY_SUMMARY.md` - Summary of all protections
- `DEPLOYMENT.md` - Production deployment guide
- `SECURITY_SETUP.sh` - Setup and testing guide

🔗 **External Resources:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security](https://nodejs.org/en/docs/guides/nodejs-security/)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)
- [Helmet.js Documentation](https://helmetjs.github.io/)

---

## Emergency Response

**If you suspect a security breach:**

1. **Stop the server**
   ```bash
   npm stop
   # or
   pm2 stop teerhub
   ```

2. **Check logs for unauthorized activity**
   ```bash
   grep "\[SECURITY\]\|\[ERROR\]" server.log | tail -100
   ```

3. **Identify the vulnerability**
   - Check SECURITY.md for known patterns
   - Review recent code changes
   - Check MongoDB access logs

4. **Fix the issue**
   - Update code
   - Run tests
   - Verify with manual testing

5. **Restart safely**
   ```bash
   npm start
   ```

6. **Document the incident**
   - Log what happened
   - Note timeline
   - List mitigations taken
   - Plan preventive measures

---

**Your TeerHub server is now protected! 🛡️**
