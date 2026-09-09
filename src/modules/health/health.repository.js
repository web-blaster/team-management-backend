import { pool } from '../../config/db.js';
export class HealthRepository{constructor(db=pool){this.db=db;}async ping(db=this.db){await db.query('SELECT 1');return true;}}
export const healthRepository=new HealthRepository();
