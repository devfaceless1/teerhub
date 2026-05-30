module.exports = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (allowedRoles.length === 0) return next();
  if (allowedRoles.includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Forbidden' });
};
