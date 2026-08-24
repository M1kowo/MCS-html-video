import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildControlledStoryboardPrompt,
  storyboardFromAiReply,
  createFallbackStoryboard,
} from '../dist/batch/storyboard.js';
import type { SubtitleCue } from '../dist/batch/types.js';

const cues: SubtitleCue[] = [{ index: 1, startMs: 100, endMs: 900, text: '稳定的字幕编排' }];

test('controlled AI prompt locks output to Simplified Chinese without translating cues', () => {
  const prompt = buildControlledStoryboardPrompt(cues);
  assert.match(prompt, /Simplified Chinese/);
  assert.match(prompt, /never translate/);
  assert.match(prompt, /稳定的字幕编排/);
});

test('AI storyboard is reduced to allowlisted visual choices', () => {
  const result = storyboardFromAiReply(
    JSON.stringify({
      synopsis: '测试',
      scenes: [
        {
          cueIndex: 1,
          templateId: '<script>alert(1)</script>',
          layout: 'absolute-html',
          theme: 'frame-swiss-grid',
          animation: 'run-javascript',
          emphasis: ['字幕', '不存在的词'],
        },
      ],
    }),
    cues,
  );
  assert.equal(result.directions[0]?.templateId, 'frame-swiss-grid');
  assert.equal(result.directions[0]?.layout, 'center');
  assert.equal(result.directions[0]?.theme, 'light');
  assert.equal(result.directions[0]?.animation, 'fade-up');
  assert.deepEqual(result.directions[0]?.emphasis, ['字幕']);
});

test('fallback graph preserves absolute SRT timeline', () => {
  const result = createFallbackStoryboard(cues, 'ai-auto', 'offline');
  assert.equal(result.source, 'fallback');
  assert.equal(result.warning, 'offline');
  assert.deepEqual(result.graph.nodes[0]?.timeline, { startMs: 100, endMs: 900 });
  assert.equal(result.graph.nodes[0]?.durationSec, 0.8);
});
