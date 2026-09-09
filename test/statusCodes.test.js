import test from 'node:test';
import assert from 'node:assert/strict';
import { StatusCode, editableReportStatuses } from '../src/constants/statusCodes.js';

test('report workflow status codes match database contract',()=>{
  assert.equal(StatusCode.DRAFT,402);
  assert.equal(StatusCode.SUBMITTED,211);
  assert.equal(StatusCode.NEEDS_CORRECTION,404);
  assert.equal(StatusCode.APPROVED,212);
  assert(editableReportStatuses.has(StatusCode.DRAFT));
  assert(editableReportStatuses.has(StatusCode.NEEDS_CORRECTION));
  assert(!editableReportStatuses.has(StatusCode.SUBMITTED));
});
