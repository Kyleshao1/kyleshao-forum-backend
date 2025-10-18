import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/post.js';
import userRoutes from './routes/user.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/forum';
mongoose.connect(uri, { })
  .then(()=>console.log('MongoDB connected'))
  .catch(e=>console.error('MongoDB connection error', e));

app.use('/api/auth', authRoutes);
app.use('/api/post', postRoutes);
app.use('/api/user', userRoutes);

const port = process.env.PORT || 5000;
app.listen(port, ()=>console.log('Server running on port', port));
