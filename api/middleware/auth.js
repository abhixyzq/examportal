import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set in production!');
  }
  console.warn('⚠️  JWT_SECRET not set. Using insecure default for local development only.');
}
export { JWT_SECRET };
const _secret = JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = header.slice(7); // faster than split(' ')[1]
  try {
    const payload = jwt.verify(token, _secret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }
  next();
}
