import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import 'dotenv/config';

import initializePassport from './config/passport.mjs';
import authRoutes from './routes/authRoutes.mjs';
import userRoutes from './routes/userRoutes.mjs';
import universityRoutes from './routes/universityRoutes.mjs';
import adminRoutes from './routes/adminRoutes.mjs';

const app = express();
const port = process.env.PORT || 3001;

// --- GLOBAL MIDDLEWARE ---
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
initializePassport(passport);

// --- API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/admin', adminRoutes);

// --- SERVER START ---
app.listen(port, () => {
    console.log(`EduElevate API server running on port ${port}`);
});