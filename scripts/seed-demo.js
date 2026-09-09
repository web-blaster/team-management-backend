import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../src/config/db.js";
import { StatusCode } from "../src/constants/statusCodes.js";
import { Role } from "../src/constants/roles.js";
import { uuid } from "../src/utils/core.js";

const password = "ChangeMe123!";

async function user(conn, { firstName, lastName, email, role }) {
  const [existing] = await conn.execute(
    "SELECT id,public_id FROM users WHERE email=? LIMIT 1",
    [email],
  );
  let id, publicId;
  if (existing[0]) ({ id, public_id: publicId } = existing[0]);
  else {
    publicId = uuid();
    const [r] = await conn.execute(
      "INSERT INTO users (public_id,first_name,last_name,email,password_hash,status_code,email_verified_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(6))",
      [
        publicId,
        firstName,
        lastName,
        email,
        await bcrypt.hash(password, 12),
        StatusCode.ACTIVE,
      ],
    );
    id = r.insertId;
  }
  const [roles] = await conn.execute(
    "SELECT id FROM m_roles WHERE code=? LIMIT 1",
    [role],
  );
  await conn.execute(
    "INSERT IGNORE INTO user_roles (user_id,role_id) VALUES (?,?)",
    [id, roles[0].id],
  );
  return { id, publicId, email };
}

await withTransaction(async (conn) => {
  const admin = await user(conn, {
    firstName: "System",
    lastName: "Admin",
    email: "admin@example.com",
    role: Role.ADMIN,
  });
  const manager = await user(conn, {
    firstName: "Maya",
    lastName: "Manager",
    email: "manager@example.com",
    role: Role.MANAGER,
  });
  const member = await user(conn, {
    firstName: "Theo",
    lastName: "Member",
    email: "member@example.com",
    role: Role.TEAM_MEMBER,
  });

  let [teams] = await conn.execute(
    "SELECT id,public_id FROM teams WHERE name=? LIMIT 1",
    ["Engineering"],
  );
  let team = teams[0];
  if (!team) {
    const publicId = uuid();
    const [r] = await conn.execute(
      "INSERT INTO teams (public_id,name,description,status_code) VALUES (?,?,?,?)",
      [publicId, "Engineering", "Demo engineering team", StatusCode.ACTIVE],
    );
    team = { id: r.insertId, public_id: publicId };
  }
  for (const u of [manager, member]) {
    const [m] = await conn.execute(
      "SELECT id FROM team_members WHERE team_id=? AND user_id=?",
      [team.id, u.id],
    );
    if (m[0])
      await conn.execute("UPDATE team_members SET removed_at=NULL WHERE id=?", [
        m[0].id,
      ]);
    else
      await conn.execute(
        "INSERT INTO team_members (team_id,user_id) VALUES (?,?)",
        [team.id, u.id],
      );
  }

  for (const [name, kind] of [
    ["Client A", "PROJECT"],
    ["Internal Tooling", "PROJECT"],
    ["R&D", "CATEGORY"],
  ]) {
    const [p] = await conn.execute(
      "SELECT id FROM projects WHERE team_id=? AND name=?",
      [team.id, name],
    );
    if (!p[0])
      await conn.execute(
        "INSERT INTO projects (public_id,team_id,name,kind,status_code,created_by) VALUES (?,?,?,?,?,?)",
        [uuid(), team.id, name, kind, StatusCode.ACTIVE, admin.id],
      );
  }

  // Current week: Monday to Sunday, due next Monday 09:00 UTC for demo purposes.
  const now = new Date(),
    day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
  );
  for (let offset = -7; offset <= 1; offset++) {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() + offset * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const due = new Date(end);
    due.setUTCDate(due.getUTCDate() + 1);
    due.setUTCHours(9, 0, 0, 0);
    const ymd = (d) => d.toISOString().slice(0, 10);
    await conn.execute(
      `INSERT IGNORE INTO reporting_periods (team_id,week_start,week_end,due_at,status_code)
       VALUES (?,?,?,?,?)`,
      [team.id, ymd(start), ymd(end), due, StatusCode.ACTIVE],
    );
  }
  console.log(
    JSON.stringify(
      {
        password,
        adminEmail: admin.email,
        managerEmail: manager.email,
        memberEmail: member.email,
        teamPublicId: team.public_id,
      },
      null,
      2,
    ),
  );
});
await pool.end();
