import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectWhichResult } from '../dist/detect.js';

test('Windows ignores an extensionless npm shim returned before codex.cmd', () => {
  const output = [
    'D:\\Language\\nodejs\\codex',
    'D:\\Language\\nodejs\\codex.cmd',
    'C:\\Program Files\\OpenAI\\codex.exe',
  ].join('\r\n');

  assert.equal(
    selectWhichResult(output, 'win32'),
    'D:\\Language\\nodejs\\codex.cmd',
  );
});

test('Windows accepts a native executable', () => {
  assert.equal(
    selectWhichResult('C:\\Tools\\agent.exe\r\n', 'win32'),
    'C:\\Tools\\agent.exe',
  );
});

test('POSIX keeps the first which result', () => {
  assert.equal(selectWhichResult('/usr/local/bin/codex\n/usr/bin/codex\n', 'linux'), '/usr/local/bin/codex');
});
