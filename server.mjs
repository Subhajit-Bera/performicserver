// import express from 'express';
// import cors from 'cors';
// import cookieParser from 'cookie-parser';
// import passport from 'passport';
// import 'dotenv/config';

// import initializePassport from './config/passport.mjs';
// import authRoutes from './routes/authRoutes.mjs';
// import userRoutes from './routes/userRoutes.mjs';
// import universityRoutes from './routes/universityRoutes.mjs';
// import adminRoutes from './routes/adminRoutes.mjs';

// const app = express();
// const port = process.env.PORT || 3001;

// // --- GLOBAL MIDDLEWARE ---
// app.use(cors({
//     origin: "http://localhost:3000",
//     credentials: true,
// }));
// app.use(express.json());
// app.use(cookieParser());
// app.use(passport.initialize());
// initializePassport(passport);

// // --- API ROUTES ---
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/universities', universityRoutes);
// app.use('/api/admin', adminRoutes);

// // --- SERVER START ---
// app.listen(port, () => {
//     console.log(`EduElevate API server running on port ${port}`);
// });





import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import 'dotenv/config';

import initializePassport from './config/passport.mjs';
import authRoutes from './routes/authRoutes.mjs';
import userRoutes from './routes/userRoutes.mjs';
import universityRoutes from './routes/universityRoutes.mjs';
import examRoutes from './routes/examRoutes.mjs';
import adminRoutes from './routes/adminRoutes.mjs';
import streamRoutes from './routes/streamRoutes.mjs';
import courseRoutes from './routes/courseRoutes.mjs';
import partnerRoutes from './routes/partnerRoutes.mjs'
import agentRoutes from './routes/agentRoutes.mjs';

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
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/agent', agentRoutes);

// --- SERVER START ---
app.listen(port, () => {
    console.log(`EduElevate API server running on port ${port}`);
});


// /backend
// ├── config/
// │   ├── db.mjs
// │   └── passport.mjs
// ├── controllers/
// │   ├── adminController.mjs
// │   ├── adminExamController.mjs
// │   ├── adminStreamController.mjs
// │   ├── adminUniversityController.mjs
// │   ├── authController.mjs
// │   ├── examController.mjs
// │   ├── universityController.mjs
// │   └── userController.mjs
// ├── middleware/
// │   └── authMiddleware.mjs
// ├── routes/
// │   ├── adminRoutes.mjs
// │   ├── authRoutes.mjs
// │   ├── examRoutes.mjs
// │   ├── universityRoutes.mjs
// │   └── userRoutes.mjs
// ├── utils/
// │   ├── slugify.mjs
// │   └── tokenUtils.mjs
// ├── .env
// ├── database.sql
// ├── package.json
// └── server.mjs