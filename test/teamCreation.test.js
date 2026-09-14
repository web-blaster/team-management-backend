import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-with-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

test('team creation API enforces permissions, validates input and returns a usable team', async (t) => {
  const { app } = await import('../src/app.js');
  const { authService } = await import('../src/modules/auth/auth.service.js');
  const { teamRepository } = await import('../src/modules/teams/team.repository.js');
  const { signAccessToken } = await import('../src/utils/core.js');
  const storedTeams = [];
  let roles = ['ADMIN'];

  t.mock.method(authService, 'resolveAuthenticatedUser', async (payload) => ({
    id: payload.uid, public_id: payload.sub, roles,
  }));
  t.mock.method(teamRepository, 'create', async (team) => {
    if (storedTeams.some((item) => item.name === team.name)) {
      throw Object.assign(new Error('Duplicate team'), { code: 'ER_DUP_ENTRY' });
    }
    storedTeams.push(team);
    return storedTeams.length;
  });
  t.mock.method(teamRepository, 'listActiveForUser', async () =>
    storedTeams.map((team) => ({ public_id: team.publicId, name: team.name })),
  );

  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}/api`;
  const token = signAccessToken({
    id: 1, public_id: '11111111-1111-4111-8111-111111111111', roles,
  });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const post = async (body, requestHeaders = headers) => {
    const response = await fetch(`${baseURL}/teams`, {
      method: 'POST', headers: requestHeaders, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test('anonymous requests cannot create a team', async () => {
    const result = await post({ name: 'Engineering' }, { 'Content-Type': 'application/json' });
    assert.equal(result.status, 401);
    assert.equal(storedTeams.length, 0);
  });

  await t.test('managers and members cannot create a team', async () => {
    for (const role of ['MANAGER', 'TEAM_MEMBER']) {
      roles = [role];
      assert.equal((await post({ name: 'Engineering' })).status, 403);
    }
    roles = ['ADMIN'];
    assert.equal(storedTeams.length, 0);
  });

  await t.test('invalid names and oversized descriptions are rejected before persistence', async () => {
    for (const body of [
      {}, { name: '   ' }, { name: 'A' }, { name: 'A'.repeat(151) },
      { name: 'Engineering', description: 'A'.repeat(5001) },
    ]) {
      assert.equal((await post(body)).status, 422);
    }
    assert.equal(storedTeams.length, 0);
  });

  await t.test('admin creates an active team with trimmed input and a public UUID', async () => {
    const result = await post({
      name: '  Engineering  ', description: '  Product development  ', statusCode: 500,
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.match(result.body.data.publicId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.deepEqual(result.body.data, {
      publicId: storedTeams[0].publicId,
      name: 'Engineering', description: 'Product development', statusCode: 202,
    });
    assert.deepEqual(storedTeams[0], result.body.data);
  });

  await t.test('new team is available to the admin through auth/me', async () => {
    const response = await fetch(`${baseURL}/auth/me`, { headers });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.deepEqual(data.teams, [{ publicId: storedTeams[0].publicId, name: 'Engineering' }]);
  });

  await t.test('duplicate names return 409 without creating a second team', async () => {
    const result = await post({ name: 'Engineering' });
    assert.equal(result.status, 409);
    assert.equal(result.body.error.message, 'A duplicate record already exists');
    assert.equal(storedTeams.length, 1);
  });

  await t.test('description is optional or nullable', async () => {
    for (const body of [{ name: 'Support' }, { name: 'Operations', description: null }]) {
      const result = await post(body);
      assert.equal(result.status, 201);
      assert.equal(result.body.data.description, null);
    }
  });
});
