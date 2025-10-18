import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import sendMail from '../utils/mailer.js';

const router = express.Router();

// register
router.post('/register', async (req,res)=>{
  try {
    const { username, email, password } = req.body;
    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ message: '邮箱已注册' });
    const user = await User.create({ username, email, password });
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl = `${process.env.CLIENT_URL}/verify?token=${token}`;
    await sendMail(user.email, '邮箱验证', `请点击链接验证：${verifyUrl}`);
    res.json({ message: '注册成功，请查收验证邮件' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: '服务器错误' });
  }
});

// verify
router.get('/verify', async (req,res)=>{
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await User.updateOne({ email: decoded.email }, { isVerified: true });
    res.json({ message: '邮箱验证成功' });
  } catch (e) {
    res.status(400).json({ message: '验证失败或链接过期' });
  }
});

// login
router.post('/login', async (req,res)=>{
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: '用户不存在' });
    if (!user.isVerified) return res.status(400).json({ message: '请先验证邮箱' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ message: '密码错误' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user._id, username: user.username, email: user.email }, token });
  } catch (e) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// forgot password
router.post('/forgot-password', async (req,res)=>{
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: '用户不存在' });
    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token;
    user.resetTokenExpire = Date.now() + 3600000;
    await user.save();
    const resetUrl = `${process.env.CLIENT_URL}/reset?token=${token}`;
    await sendMail(user.email, '密码重置', `点击链接重置密码：${resetUrl}`);
    res.json({ message: '重置邮件已发送' });
  } catch (e) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// reset password
router.post('/reset-password', async (req,res)=>{
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ resetToken: token, resetTokenExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: '链接无效或过期' });
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();
    res.json({ message: '密码已重置' });
  } catch (e) {
    res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
