import { pool } from '../../config/db.js';

export class LookupRepository {
  constructor(db=pool){this.db=db;}
  async getAll(activeStatus,db=this.db){
    const [[priorities],[taskStatuses],[taskTypes],[reportStatuses]] = await Promise.all([
      db.execute('SELECT id,code,name,sort_order FROM m_task_priorities ORDER BY sort_order'),
      db.execute(`SELECT ts.status_code,sc.system_key,sc.label,ts.sort_order
                    FROM m_task_statuses ts JOIN m_status_codes sc ON sc.code=ts.status_code
                   ORDER BY ts.sort_order`),
      db.execute('SELECT id,name FROM m_task_types WHERE status_code=? ORDER BY name',[activeStatus]),
      db.execute(`SELECT rs.status_code,sc.system_key,sc.label,rs.sort_order
                    FROM m_report_statuses rs JOIN m_status_codes sc ON sc.code=rs.status_code
                   ORDER BY rs.sort_order`)
    ]);
    return {priorities,taskStatuses,taskTypes,reportStatuses};
  }
}
export const lookupRepository=new LookupRepository();
