import { pool } from '../../config/db.js';

export class ProjectRepository {
  constructor(db=pool){ this.db=db; }

  async findByPublicId(publicId,db=this.db){
    const [rows]=await db.execute('SELECT * FROM projects WHERE public_id=? LIMIT 1',[publicId]);
    return rows[0] ?? null;
  }

  async list({teamId=null,statusCode=null},db=this.db){
    const params=[]; let where='WHERE 1=1';
    if(teamId){ where+=' AND p.team_id=?'; params.push(teamId); }
    if(statusCode){ where+=' AND p.status_code=?'; params.push(statusCode); }
    const [rows]=await db.execute(
      `SELECT p.public_id,p.name,p.kind,p.description,p.status_code,
              t.public_id team_public_id,t.name team_name
         FROM projects p JOIN teams t ON t.id=p.team_id
         ${where} ORDER BY p.name`,params
    );
    return rows;
  }

  async create(data,db=this.db){
    const [result]=await db.execute(
      `INSERT INTO projects (public_id,team_id,name,kind,description,status_code,created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [data.publicId,data.teamId,data.name,data.kind,data.description??null,data.statusCode,data.createdBy]
    );
    return result.insertId;
  }

  async update(projectId,changes,db=this.db){
    const allowed={name:'name',kind:'kind',description:'description'};
    const fields=[],params=[];
    for(const [key,column] of Object.entries(allowed)){
      if(changes[key]!==undefined){fields.push(`${column}=?`);params.push(changes[key]);}
    }
    if(!fields.length)return 0;
    params.push(projectId);
    const [result]=await db.execute(`UPDATE projects SET ${fields.join(',')} WHERE id=?`,params);
    return result.affectedRows;
  }

  async archive(projectId,statusCode,db=this.db){
    const [result]=await db.execute(
      'UPDATE projects SET status_code=?,archived_at=CURRENT_TIMESTAMP(6) WHERE id=?',[statusCode,projectId]
    );
    return result.affectedRows;
  }

  async listMembers(projectId,db=this.db){
    const [rows]=await db.execute(
      `SELECT u.public_id,u.first_name,u.last_name,u.email,pm.assigned_at
         FROM project_members pm JOIN users u ON u.id=pm.user_id
        WHERE pm.project_id=? AND pm.removed_at IS NULL
        ORDER BY u.first_name,u.last_name`,[projectId]
    );
    return rows;
  }

  async findMembership(projectId,userId,db=this.db){
    const [rows]=await db.execute(
      'SELECT id,removed_at FROM project_members WHERE project_id=? AND user_id=? LIMIT 1',[projectId,userId]
    );
    return rows[0] ?? null;
  }

  async restoreMembership(id,db=this.db){
    await db.execute(
      'UPDATE project_members SET removed_at=NULL,assigned_at=CURRENT_TIMESTAMP(6) WHERE id=?',[id]
    );
  }
  async addMember(projectId,userId,db=this.db){
    await db.execute('INSERT INTO project_members (project_id,user_id) VALUES (?,?)',[projectId,userId]);
  }
  async removeMember(projectId,userId,db=this.db){
    const [result]=await db.execute(
      'UPDATE project_members SET removed_at=CURRENT_TIMESTAMP(6) WHERE project_id=? AND user_id=? AND removed_at IS NULL',
      [projectId,userId]
    );
    return result.affectedRows;
  }
}
export const projectRepository=new ProjectRepository();
