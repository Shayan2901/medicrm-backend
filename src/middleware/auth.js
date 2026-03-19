const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'medicrm_secret_key';

const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// auth(roles?) — pass roles array to restrict, or empty to just verify token
const auth = (roles = []) => (req, res, next) => {
  verifyToken(req, res, () => {
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  });
};

module.exports = { verifyToken, auth };
