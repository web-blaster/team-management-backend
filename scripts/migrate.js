import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const connection=await mysql.createConnection({
  host:env.DB_HOST,port:env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,
  database:env.DB_NAME,multipleStatements:true,charset:'utf8mb4',timezone:'Z'
});

try{
  const sql=await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8');
  await connection.query(sql);
  console.log('Database migration completed');
}finally{
  await connection.end();
}
