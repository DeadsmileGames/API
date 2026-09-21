import express from 'express';

export const adminBodyLimiter = express.json({ limit: '3mb' });
