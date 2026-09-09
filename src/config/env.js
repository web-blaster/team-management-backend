import dotenv from 'dotenv';
import { z } from 'zod';

const requestedEnvironment=process.env.NODE_ENV||'development';
console.log(`Loading environment variables from .env.${requestedEnvironment} and .env`);  
dotenv.config({path:`.env.${requestedEnvironment}`});
dotenv.config({path:'.env'});

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development','test','staging','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('team_management'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  JWT_ACCESS_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  FRONTEND_ORIGIN: z.string().refine(value=>value.split(',').every(origin=>z.url().safeParse(origin.trim()).success),
    'FRONTEND_ORIGIN must contain one or more comma-separated URLs').default('http://localhost:5173'),
  COOKIE_NAME: z.string().default('team_refresh'),
  COOKIE_SECURE: z.string().default('false').transform(v => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax','strict','none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  OUTBOX_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000)
}).superRefine((value,ctx)=>{
  if(!['staging','production'].includes(value.NODE_ENV))return;
  if(value.JWT_ACCESS_SECRET.includes('replace-with'))ctx.addIssue({
    code:'custom',path:['JWT_ACCESS_SECRET'],message:'Use a real secret outside development'
  });
  if(value.TOKEN_ENCRYPTION_KEY==='0123456789abcdef'.repeat(4))ctx.addIssue({
    code:'custom',path:['TOKEN_ENCRYPTION_KEY'],message:'Use a real encryption key outside development'
  });
  if(!value.COOKIE_SECURE)ctx.addIssue({
    code:'custom',path:['COOKIE_SECURE'],message:'Secure cookies are required outside development'
  });
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
