import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BatchQueue } from '../src/batch/queue.ts';
import type { BatchTaskInput } from '../src/batch/types.ts';

function input(baseName: string): BatchTaskInput {
  return {
    baseName,
    srtPath: `${baseName}.srt`,
    mp3Path: `${baseName}.mp3`,
    outputDir: 'out',
    style: 'frame-swiss-grid',
  };
}

test('runs serially and retries a first failure exactly once', async () => {
  let active = 0;
  let maxActive = 0;
  const calls = new Map<string, number>();
  const queue = new BatchQueue(async (task, _id, update) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    calls.set(task.baseName, (calls.get(task.baseName) ?? 0) + 1);
    update({ progress: 50, stage: 'halfway' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    if (task.baseName === 'retry' && calls.get(task.baseName) === 1) throw new Error('transient');
    return { outputPath: `${task.outputDir}/${task.baseName}.mp4` };
  });

  queue.enqueue([input('retry'), input('next')]);
  await queue.waitForIdle();
  const tasks = queue.list();
  assert.equal(maxActive, 1);
  assert.deepEqual(
    tasks.map((task) => task.status),
    ['success', 'success'],
  );
  assert.deepEqual(
    tasks.map((task) => task.attempts),
    [2, 1],
  );
  assert.equal(tasks[0]?.progress, 100);
});

test('a task that fails after retry does not stop the queue', async () => {
  const queue = new BatchQueue(async (task) => {
    if (task.baseName === 'broken') throw new Error('permanent');
    return { outputPath: `${task.baseName}.mp4` };
  });
  queue.enqueue([input('broken'), input('healthy')]);
  await queue.waitForIdle();
  const tasks = queue.list();
  assert.equal(tasks[0]?.status, 'failed');
  assert.equal(tasks[0]?.attempts, 2);
  assert.match(tasks[0]?.error ?? '', /permanent/);
  assert.equal(tasks[1]?.status, 'success');
});
