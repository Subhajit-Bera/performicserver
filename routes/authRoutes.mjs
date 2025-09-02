import { Router } from 'express';
import passport from 'passport';
import { registerUser, loginUser, refreshToken, logoutUser, handleGoogleCallback } from '../controllers/authController.mjs';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);

// Google OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login`, session: false }), handleGoogleCallback);

export default router;