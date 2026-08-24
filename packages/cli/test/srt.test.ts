import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parseSrt, parseSrtTimecode } from '../src/batch/srt.ts';

test('parses numbered Chinese UTF-8 SRT cues and timestamps', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/batch-demo/demo.srt', import.meta.url));
  const cues = parseSrt(await readFile(fixture));
  assert.deepEqual(cues, [
    { index: 1, startMs: 80, endMs: 520, text: '你好，欢迎使用本地视频工作台。' },
    { index: 2, startMs: 560, endMs: 920, text: '字幕会跟随声音准确出现。' },
  ]);
});

test('accepts BOM, CRLF, dot milliseconds and multiline text', () => {
  const cues = parseSrt('\uFEFF8\r\n01:02:03.4 --> 01:02:04.045\r\n第一行\r\n第二行\r\n');
  assert.equal(cues[0]?.index, 8);
  assert.equal(cues[0]?.startMs, 3_723_400);
  assert.equal(cues[0]?.endMs, 3_724_045);
  assert.equal(cues[0]?.text, '第一行\n第二行');
});

test('rejects invalid cue ranges', () => {
  assert.throws(() => parseSrt('1\n00:00:02,000 --> 00:00:01,000\n错误'), /ends before it starts/);
  assert.equal(parseSrtTimecode('00:01:02,003'), 62_003);
});
