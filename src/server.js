import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { logger } from './config/logger.js';

const server=app.listen(env.PORT,()=>logger.info({port:env.PORT},'API listening'));

async function shutdown(signal){
  logger.info({signal},'Graceful shutdown');
  server.close(async()=>{
    await pool.end();
    process.exit(0);
  });
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
