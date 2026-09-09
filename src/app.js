import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFound, requestId } from './middleware/index.js';
import { AppError } from './utils/core.js';

import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import lookupRoutes from './modules/lookups/lookup.routes.js';
import teamRoutes from './modules/teams/team.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import periodRoutes from './modules/reportingPeriods/reportingPeriod.routes.js';
import userRoutes from './modules/users/user.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

export const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);

app.use(requestId);
app.use(pinoHttp({logger}));
app.use(helmet());
const allowedOrigins=env.FRONTEND_ORIGIN.split(',').map(value=>value.trim()).filter(Boolean);
app.use(cors({
  origin(origin,callback){
    if(!origin||allowedOrigins.includes(origin))return callback(null,true);
    callback(new AppError(403,'Origin is not allowed'));
  },
  credentials:true,
  methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));
app.use(express.json({limit:'1mb'}));
app.use(cookieParser());

app.use('/api/auth',rateLimit({
  windowMs:15*60*1000,
  limit:100,
  standardHeaders:'draft-8',
  legacyHeaders:false
}),authRoutes);

app.use('/api/health',healthRoutes);
app.use('/api/lookups',lookupRoutes);
app.use('/api/teams',teamRoutes);
app.use('/api/projects',projectRoutes);
app.use('/api/reporting-periods',periodRoutes);
app.use('/api/users',userRoutes);
app.use('/api/reports',reportRoutes);
app.use('/api/dashboard',dashboardRoutes);

app.use(notFound);
app.use(errorHandler);
