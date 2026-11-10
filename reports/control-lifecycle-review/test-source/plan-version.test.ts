import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextPlanVersion} from '../src/services/planVersion.ts';
test('versions remain unique across blank plans and revisions',()=>{
 assert.equal(nextPlanVersion([]),'v1.0');
 assert.equal(nextPlanVersion(['v1.0','v1.1','v1.2']),'v1.3');
 assert.equal(nextPlanVersion(['v1.9','v1.10']),'v1.11');
 assert.equal(nextPlanVersion(['v1.9','v2.0']),'v2.1');
});
