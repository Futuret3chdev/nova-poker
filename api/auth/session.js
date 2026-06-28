import { verifyToken } from '../_lib/auth.js';

export default function handler(req, res) {
  const token = req.query.token;
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }
  const { exp, ...user } = session;
  res.status(200).json(user);
}