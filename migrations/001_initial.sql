CREATE TABLE IF NOT EXISTS m_status_codes (
  code INT PRIMARY KEY,
  system_key VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO m_status_codes (code,system_key,label) VALUES
  (200,'SUCCESS','Success'),(201,'TRUE','True'),(202,'ACTIVE','Active'),(203,'YES','Yes'),
  (204,'PAID','Paid'),(205,'CONFIRMED','Confirmed'),(206,'COMPLETED','Completed'),
  (207,'ACCEPTED','Accepted'),(208,'ASSIGNED','Assigned'),(209,'REQUESTED','Requested'),
  (210,'FREE','Free'),(211,'SUBMITTED','Submitted'),(212,'APPROVED','Approved'),
  (213,'PUBLISHED','Published'),(214,'PROCESSING','Processing'),(215,'IN_PROGRESS','In Progress'),
  (400,'WARNING','Warning'),(401,'PENDING','Pending'),(402,'DRAFT','Draft'),
  (403,'PARTIAL_PAYMENT','Partial Payment'),(404,'NEEDS_CORRECTION','Needs Correction'),
  (405,'ARCHIVED','Archived'),(406,'BLOCKED','Blocked'),(407,'DEFERRED','Deferred'),
  (500,'ERROR','Error'),(501,'FALSE','False'),(502,'INACTIVE','Inactive'),(503,'NO','No'),
  (504,'FAILED','Failed'),(506,'CANCELLED','Cancelled'),(507,'REJECTED','Rejected'),
  (508,'SUSPEND','Suspended');

CREATE TABLE IF NOT EXISTS m_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO m_roles (code,name) VALUES
  ('TEAM_MEMBER','Team Member'),('MANAGER','Manager'),('ADMIN','Administrator');

CREATE TABLE IF NOT EXISTS m_task_priorities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO m_task_priorities (code,name,sort_order) VALUES
  ('LOW','Low',10),('MEDIUM','Medium',20),('HIGH','High',30),('CRITICAL','Critical',40);

CREATE TABLE IF NOT EXISTS m_task_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  status_code INT NOT NULL DEFAULT 202,
  CONSTRAINT fk_task_types_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO m_task_types (name,status_code) VALUES
  ('Development',202),('Meetings',202),('Support',202),('Planning',202),('Other',202);

CREATE TABLE IF NOT EXISTS m_task_statuses (
  status_code INT PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_task_status_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO m_task_statuses (status_code,sort_order) VALUES (215,10),(406,20),(407,30),(206,40);

CREATE TABLE IF NOT EXISTS m_report_statuses (
  status_code INT PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_report_status_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO m_report_statuses (status_code,sort_order) VALUES (402,10),(211,20),(404,30),(212,40);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status_code INT NOT NULL DEFAULT 202,
  email_verified_at DATETIME(6) NULL,
  last_login_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  CONSTRAINT fk_users_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id,role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES m_roles(id),
  CONSTRAINT fk_user_roles_actor FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teams (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NULL,
  status_code INT NOT NULL DEFAULT 202,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_teams_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS team_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  removed_at DATETIME(6) NULL,
  UNIQUE KEY uq_team_member (team_id,user_id),
  KEY ix_team_members_user (user_id,removed_at),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  team_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  kind ENUM('PROJECT','CATEGORY') NOT NULL DEFAULT 'PROJECT',
  description TEXT NULL,
  status_code INT NOT NULL DEFAULT 202,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  archived_at DATETIME(6) NULL,
  UNIQUE KEY uq_project_team_name (team_id,name),
  CONSTRAINT fk_projects_team FOREIGN KEY (team_id) REFERENCES teams(id),
  CONSTRAINT fk_projects_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code),
  CONSTRAINT fk_projects_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  removed_at DATETIME(6) NULL,
  UNIQUE KEY uq_project_member (project_id,user_id),
  CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reporting_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  due_at DATETIME(6) NOT NULL,
  status_code INT NOT NULL DEFAULT 202,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_reporting_period (team_id,week_start),
  CONSTRAINT fk_periods_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_periods_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  reporting_period_id BIGINT UNSIGNED NOT NULL,
  status_code INT NOT NULL DEFAULT 402,
  current_version_id BIGINT UNSIGNED NULL,
  first_submitted_at DATETIME(6) NULL,
  last_submitted_at DATETIME(6) NULL,
  approved_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_weekly_report (user_id,team_id,reporting_period_id),
  KEY ix_reports_team_period (team_id,reporting_period_id,status_code),
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_reports_team FOREIGN KEY (team_id) REFERENCES teams(id),
  CONSTRAINT fk_reports_period FOREIGN KEY (reporting_period_id) REFERENCES reporting_periods(id),
  CONSTRAINT fk_reports_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT UNSIGNED NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  source_version_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  submitted_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_report_version (report_id,version_no),
  CONSTRAINT fk_versions_report FOREIGN KEY (report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_versions_source FOREIGN KEY (source_version_id) REFERENCES report_versions(id) ON DELETE SET NULL,
  CONSTRAINT fk_versions_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @current_version_fk_exists=(SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='weekly_reports' AND CONSTRAINT_NAME='fk_reports_current_version');
SET @current_version_fk_sql=IF(@current_version_fk_exists=0,
  'ALTER TABLE weekly_reports ADD CONSTRAINT fk_reports_current_version FOREIGN KEY (current_version_id) REFERENCES report_versions(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE current_version_stmt FROM @current_version_fk_sql;
EXECUTE current_version_stmt;
DEALLOCATE PREPARE current_version_stmt;

CREATE TABLE IF NOT EXISTS report_version_projects (
  report_version_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (report_version_id,project_id),
  CONSTRAINT fk_rvp_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_rvp_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS completed_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_version_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  task_name VARCHAR(255) NOT NULL,
  priority_id BIGINT UNSIGNED NOT NULL,
  planned_percent DECIMAL(5,2) NULL,
  actual_percent DECIMAL(5,2) NULL,
  status_code INT NOT NULL,
  planned_minutes INT UNSIGNED NULL,
  spent_minutes INT UNSIGNED NULL,
  deliverable TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_completed_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_completed_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_completed_priority FOREIGN KEY (priority_id) REFERENCES m_task_priorities(id),
  CONSTRAINT fk_completed_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS planned_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_version_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  task_name VARCHAR(255) NOT NULL,
  priority_id BIGINT UNSIGNED NULL,
  planned_minutes INT UNSIGNED NULL,
  notes TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_planned_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_planned_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_planned_priority FOREIGN KEY (priority_id) REFERENCES m_task_priorities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_blockers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_version_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_key BOOLEAN NOT NULL DEFAULT FALSE,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at DATETIME(6) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_blockers_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_version_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_key BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_achievements_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_time_breakdowns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_version_id BIGINT UNSIGNED NOT NULL,
  task_type_id BIGINT UNSIGNED NOT NULL,
  minutes INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_version_task_type (report_version_id,task_type_id),
  CONSTRAINT fk_time_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_time_type FOREIGN KEY (task_type_id) REFERENCES m_task_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_version_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(255) NULL,
  url VARCHAR(4000) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_links_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT UNSIGNED NOT NULL,
  report_version_id BIGINT UNSIGNED NOT NULL UNIQUE,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  action_code INT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_reviews_report FOREIGN KEY (report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id),
  CONSTRAINT fk_reviews_action FOREIGN KEY (action_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT UNSIGNED NOT NULL,
  report_version_id BIGINT UNSIGNED NULL,
  from_status_code INT NULL,
  to_status_code INT NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  reason TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_history_report FOREIGN KEY (report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_version FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE SET NULL,
  CONSTRAINT fk_history_from_status FOREIGN KEY (from_status_code) REFERENCES m_status_codes(code),
  CONSTRAINT fk_history_to_status FOREIGN KEY (to_status_code) REFERENCES m_status_codes(code),
  CONSTRAINT fk_history_actor FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME(6) NOT NULL,
  last_used_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_sessions_user (user_id,revoked_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  team_id BIGINT UNSIGNED NULL,
  role_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by BIGINT UNSIGNED NULL,
  status_code INT NOT NULL DEFAULT 401,
  expires_at DATETIME(6) NOT NULL,
  accepted_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_invitations_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_invitations_role FOREIGN KEY (role_id) REFERENCES m_roles(id) ON DELETE SET NULL,
  CONSTRAINT fk_invitations_actor FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_invitations_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_activity_team_created (team_id,created_at),
  CONSTRAINT fk_activity_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outbox_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id CHAR(36) NOT NULL UNIQUE,
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(150) NOT NULL,
  payload JSON NOT NULL,
  status_code INT NOT NULL DEFAULT 401,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  published_at DATETIME(6) NULL,
  last_error TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_outbox_claim (status_code,available_at,id),
  CONSTRAINT fk_outbox_status FOREIGN KEY (status_code) REFERENCES m_status_codes(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
