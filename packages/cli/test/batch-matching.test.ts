import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { matchMediaFiles } from '../src/batch/matching.ts';

test('matches same-name SRT and MP3 case-insensitively in the same directory', () => {
  const dir = resolve('test-media');
  const result = matchMediaFiles([
    join(dir, '演示.SRT'),
    join(dir, '演示.mp3'),
    join(dir, 'only.srt'),
    join(dir, 'audio-only.MP3'),
    join(dir, 'ignore.txt'),
  ]);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0]?.baseName, '演示');
  assert.deepEqual(result.unmatchedSrt, [join(dir, 'only.srt')]);
  assert.deepEqual(result.unmatchedMp3, [join(dir, 'audio-only.MP3')]);
});

test('does not cross-match identical stems from different folders', () => {
  const result = matchMediaFiles([resolve('a', 'demo.srt'), resolve('b', 'demo.mp3')]);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.unmatchedSrt.length, 1);
  assert.equal(result.unmatchedMp3.length, 1);
});
