import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

process.env.JWT_ACCESS_SECRET||='test-access-secret-with-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY||='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.NODE_ENV='test';
process.env.LOG_LEVEL='silent';

test('successful response data is recursively camel-cased',async()=>{
  const {camelize}=await import('../src/utils/core.js');
  const date=new Date('2026-01-01T00:00:00Z');
  assert.deepEqual(camelize({public_id:'id',nested_rows:[{week_start:date}]}),{
    publicId:'id',nestedRows:[{weekStart:date}]
  });
});

test('project requests require a team and reject empty updates',async()=>{
  const {projectBodySchema,projectListQuerySchema,projectUpdateSchema}=await import('../src/modules/projects/project.validation.js');
  assert.equal(projectBodySchema.safeParse({name:'Portal'}).success,false);
  assert.equal(projectListQuerySchema.safeParse({}).success,false);
  assert.equal(projectUpdateSchema.safeParse({}).success,false);
  assert.equal(projectListQuerySchema.parse({
    teamPublicId:'11111111-1111-4111-8111-111111111111'
  }).status,'active');
});

test('dashboard content queries exclude draft reports',async()=>{
  const {dashboardRepository}=await import('../src/modules/dashboard/dashboard.repository.js');
  const calls=[];
  const db={execute:async(sql,params)=>{calls.push({sql,params});return [[]];}};
  await dashboardRepository.projectWorkload(1,2,db);
  await dashboardRepository.timeDistribution(1,2,db);
  await dashboardRepository.crossTeamSection(1,2,'blockers',db);
  for(const call of calls){
    assert.match(call.sql,/wr\.status_code<>\?/);
    assert.equal(call.params.at(-1),402);
  }
});

test('unexpected errors return a generic message',async()=>{
  const {errorHandler}=await import('../src/middleware/index.js');
  let response;
  const res={status(code){response={code};return this;},json(body){response.body=body;return this;}};
  errorHandler(new Error('private database detail'),{id:'request-id'},res,()=>{});
  assert.equal(response.code,500);
  assert.equal(response.body.error.message,'Internal server error');
  assert.equal(response.body.error.requestId,'request-id');
});

test('OpenAPI document parses and describes the core API groups',async()=>{
  const document=parse(await readFile(new URL('../docs/openapi.yaml',import.meta.url),'utf8'));
  assert.equal(document.openapi,'3.1.0');
  for(const path of ['/auth/login','/teams','/projects','/reporting-periods','/users','/reports','/dashboard/summary']){
    assert.ok(document.paths[path],`Missing OpenAPI path: ${path}`);
  }
});

test('staging and production environment profiles enforce deployment secrets',async()=>{
  const {environmentSchema}=await import('../src/config/env.js');
  const base={
    JWT_ACCESS_SECRET:'a-secure-runtime-secret-with-more-than-32-characters',
    TOKEN_ENCRYPTION_KEY:'a'.repeat(64),COOKIE_SECURE:'true'
  };
  assert.equal(environmentSchema.safeParse({...base,NODE_ENV:'staging'}).success,true);
  assert.equal(environmentSchema.safeParse({
    ...base,NODE_ENV:'production',JWT_ACCESS_SECRET:'replace-with-a-long-random-production-secret-at-least-32-characters'
  }).success,false);
  assert.equal(environmentSchema.safeParse({...base,NODE_ENV:'production',COOKIE_SECURE:'false'}).success,false);
});
