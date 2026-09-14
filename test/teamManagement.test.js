import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-with-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY ||= 'a'.repeat(64);
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

test('team management API protects edits and deletion', async (t) => {
  const { app } = await import('../src/app.js');
  const { pool } = await import('../src/config/db.js');
  const { authService } = await import('../src/modules/auth/auth.service.js');
  const { teamRepository } = await import('../src/modules/teams/team.repository.js');
  const { signAccessToken } = await import('../src/utils/core.js');
  const id = '11111111-1111-4111-8111-111111111111';
  const missingId = '22222222-2222-4222-8222-222222222222';
  let team = { id: 1, public_id: id, name: 'Engineering', description: 'Original', status_code: 202 };
  let roles = ['ADMIN'], inUse = false, foreignKeyConflict = false;
  let transactions = 0, commits = 0, rollbacks = 0, deletes = 0;
  const conn = {
    beginTransaction: async () => { transactions += 1; },
    commit: async () => { commits += 1; },
    rollback: async () => { rollbacks += 1; },
    release() {},
  };
  t.mock.method(pool, 'getConnection', async () => conn);
  t.mock.method(authService, 'resolveAuthenticatedUser', async () => ({
    id: 1, public_id: id, roles,
  }));
  t.mock.method(teamRepository, 'findByPublicId', async (publicId, db, lock) => {
    assert.equal(db, conn);
    assert.equal(lock, true);
    return team && publicId === team.public_id ? { ...team } : null;
  });
  t.mock.method(teamRepository, 'update', async (teamId, changes, db) => {
    assert.equal(db, conn);
    assert.equal(teamId, 1);
    if (changes.name === 'Taken') throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
    team = { ...team, ...changes };
  });
  t.mock.method(teamRepository, 'hasRelatedRecords', async (teamId, db) => {
    assert.equal(db, conn);
    assert.equal(teamId, 1);
    return inUse;
  });
  t.mock.method(teamRepository, 'remove', async (teamId, db) => {
    assert.equal(db, conn);
    assert.equal(teamId, 1);
    if (foreignKeyConflict) throw Object.assign(new Error('Referenced'), { code: 'ER_ROW_IS_REFERENCED_2' });
    deletes += 1;
    team = null;
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const token = signAccessToken({ id: 1, public_id: id, roles });
  const request = async (method, publicId, body, authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/teams/${publicId}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('only admins may edit or delete teams', async () => {
    for (const method of ['PATCH', 'DELETE']) {
      assert.equal((await request(method, id, { name: 'Denied' }, false)).status, 401);
      for (const role of ['MANAGER', 'TEAM_MEMBER']) {
        roles = [role];
        assert.equal((await request(method, id, { name: 'Denied' })).status, 403);
      }
    }
    roles = ['ADMIN'];
    assert.equal(transactions, 0);
  });
  await t.test('invalid fields and IDs are rejected before persistence', async () => {
    for (const body of [{}, { name: ' ' }, { name: 'x'.repeat(151) }, { description: 'x'.repeat(5001) }, { statusCode: 500 }]) {
      assert.equal((await request('PATCH', id, body)).status, 422);
    }
    assert.equal((await request('PATCH', 'bad-id', { name: 'Valid' })).status, 422);
    assert.equal((await request('DELETE', 'bad-id')).status, 422);
    assert.equal(transactions, 0);
  });
  await t.test('edit trims input, retains identity/status, and permits clearing description', async () => {
    const result = await request('PATCH', id, { name: '  Platform  ', description: null, statusCode: 500 });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, { publicId: id, name: 'Platform', description: null, statusCode: 202 });
    assert.equal(commits, 1);
    const unchanged = await request('PATCH', id, { name: 'Platform' });
    assert.equal(unchanged.status, 200);
    assert.equal(unchanged.body.data.description, null);
  });
  await t.test('missing team returns 404 on edit and delete', async () => {
    assert.equal((await request('PATCH', missingId, { name: 'Missing' })).status, 404);
    assert.equal((await request('DELETE', missingId)).status, 404);
  });
  await t.test('duplicate names return 409 and roll back', async () => {
    const before = rollbacks;
    assert.equal((await request('PATCH', id, { name: 'Taken' })).status, 409);
    assert.equal(team.name, 'Platform');
    assert.equal(rollbacks, before + 1);
  });
  await t.test('dependent records prevent deletion and trigger rollback', async () => {
    inUse = true;
    const before = rollbacks;
    const result = await request('DELETE', id);
    assert.equal(result.status, 409);
    assert.match(result.body.error.message, /related records/);
    assert.equal(deletes, 0);
    assert.equal(rollbacks, before + 1);
    assert.ok(team);
    inUse = false;
  });
  await t.test('database reference conflicts are reported as 409', async () => {
    foreignKeyConflict = true;
    assert.equal((await request('DELETE', id)).status, 409);
    assert.ok(team);
    foreignKeyConflict = false;
  });
  await t.test('unused team can be deleted and a repeated delete returns 404', async () => {
    const before = commits;
    const result = await request('DELETE', id);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, { deleted: true });
    assert.equal(team, null);
    assert.equal(deletes, 1);
    assert.equal(commits, before + 1);
    assert.equal((await request('DELETE', id)).status, 404);
  });
});
