import express from 'express';
import User from '../models/User.js';
import auth from '../utils/authMiddleware.js';

const router = express.Router();

router.get('/me', auth, async (req,res)=>{
  const u = await User.findById(req.user.id).select('-password');
  res.json(u);
});

router.post('/badge/:id', auth, async (req,res)=>{
  if (req.user.role !== 'admin') return res.status(403).json({ message: '无权限' });
  const { badge } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { badge }, { new: true }).select('-password');
  res.json(user);
});

export default router;
