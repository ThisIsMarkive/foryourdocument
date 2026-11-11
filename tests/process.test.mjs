import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../plugins/hwpx-bridge/server/process.mjs';

test('process arguments are literal and Unicode output stays intact', async () => {
  const literal = '한글; echo SHOULD_NOT_RUN & $(whoami)';
  const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', literal]);
  assert.equal(result.code, 0); assert.equal(result.stdout, literal);
});
test('timeout terminates an owned engine process', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 150 }), /exceeded/);
});
