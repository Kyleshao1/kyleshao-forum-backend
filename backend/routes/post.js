import express from 'express';
import Post from '../models/Post.js';
import auth from '../utils/authMiddleware.js';

const router = express.Router();

router.get('/', async (req,res)=>{
  const posts = await Post.find().populate('author','username').sort({ createdAt: -1 });
  res.json(posts);
});

router.get('/:id', async (req,res)=>{
  const post = await Post.findById(req.params.id).populate('author','username');
  if(!post) return res.status(404).json({ message: '未找到帖子' });
  res.json(post);
});

router.post('/', auth, async (req,res)=>{
  const { title, content } = req.body;
  const post = await Post.create({ title, content, author: req.user.id });
  res.json(post);
});

router.post('/:id/reply', auth, async (req,res)=>{
  const { content } = req.body;
  const post = await Post.findById(req.params.id);
  if(!post) return res.status(404).json({ message: '帖子不存在' });
  post.replies.push({ user: req.user.id, content });
  await post.save();
  res.json(post);
});

router.post('/:id/like', auth, async (req,res)=>{
  const post = await Post.findById(req.params.id);
  if(!post) return res.status(404).json({ message: '帖子不存在' });
  const idx = post.likes.findIndex(i=>i.toString()===req.user.id);
  if (idx>=0) post.likes.splice(idx,1); else post.likes.push(req.user.id);
  await post.save();
  res.json({ likes: post.likes.length });
});

export default router;
