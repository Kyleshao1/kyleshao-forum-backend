import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function auth(req,res,next){
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: '未授权' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if(!user) return res.status(401).json({ message: '用户不存在' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: '令牌无效' });
  }
}
