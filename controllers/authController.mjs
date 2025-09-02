import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.mjs';
import { sendAuthTokens, generateAccessToken } from '../utils/tokenUtils.mjs';

export const registerUser = async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ message: 'All fields are required' });
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUserResult = await pool.query(
            'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
            [fullName, email, hashedPassword]
        );
        const user = newUserResult.rows[0];
        return sendAuthTokens(res, user);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Email already exists' });
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
        const user = userResult.rows[0];
        if (!user.password_hash) return res.status(401).json({ message: 'Account registered with Google. Please sign in with Google.' });
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        return sendAuthTokens(res, user);
    } catch (err) {
        res.status(500).json({ message: 'Server error during login.' });
    }
};

export const refreshToken = async (req, res) => {
    const refreshToken = req.cookies.jwt;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token provided' });
    
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE refresh_token = $1', [refreshToken]);
        if (userResult.rows.length === 0) return res.status(403).json({ message: 'Invalid refresh token' });
        
        const user = userResult.rows[0];
        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err) => {
            if (err) return res.status(403).json({ message: 'Refresh token expired or invalid' });
            const accessToken = generateAccessToken(user);
            res.json({ accessToken });
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error while refreshing token' });
    }
};

export const logoutUser = (req, res) => {
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: 'Logged out successfully' });
};

export const handleGoogleCallback = (req, res) => {
    sendAuthTokens(res, req.user).then(() => {
        res.redirect(`${process.env.CLIENT_URL}/`);
    });
};