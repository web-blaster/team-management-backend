import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}
export const asyncHandler = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
export const uuid = () => crypto.randomUUID();
export const randomToken = () => crypto.randomBytes(48).toString('base64url');
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function encryptSecret(value) {
  const iv=crypto.randomBytes(12);
  const key=Buffer.from(env.TOKEN_ENCRYPTION_KEY,'hex');
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}
export function decryptSecret(value) {
  const [ivB64,tagB64,dataB64]=String(value).split('.');
  const key=Buffer.from(env.TOKEN_ENCRYPTION_KEY,'hex');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivB64,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64,'base64url')),decipher.final()]).toString('utf8');
}
const camelCaseKey = key => key.replace(/_([a-z0-9])/g, (_match, letter) => letter.toUpperCase());

export function camelize(value) {
  if (Array.isArray(value)) return value.map(camelize);
  if (value instanceof Date || Buffer.isBuffer(value) || value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[camelCaseKey(key),camelize(item)]));
}

export const ok = (res,data,meta) => res.json({success:true,data:camelize(data),...(meta?{meta:camelize(meta)}:{})});
export const created = (res,data) => res.status(201).json({success:true,data:camelize(data)});

export function signAccessToken(user) {
  return jwt.sign({uid:user.id,roles:user.roles}, env.JWT_ACCESS_SECRET, {
    subject:user.public_id,
    expiresIn:env.ACCESS_TOKEN_TTL,
    issuer:'team-management-api',
    audience:'team-management-web'
  });
}
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer:'team-management-api',
    audience:'team-management-web'
  });
}
