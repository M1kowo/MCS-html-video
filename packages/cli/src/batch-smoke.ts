import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap } from './context.js';
import { BatchQueue } from './batch/queue.js';
import { createBatchProcessor } from './batch/processor.js';

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..', '..', '..');
  const fixture = join(root, 'packages', 'cli', 'test', 'fixtures', 'batch-demo');
  const outputDir = await mkdtemp(join(tmpdir(), 'html-video-batch-smoke-'));
  const ctx = await bootstrap({ cwd: root });
  const queue = new BatchQueue(createBatchProcessor(ctx));
  queue.enqueue([
    {
      baseName: 'demo',
      srtPath: join(fixture, 'demo.srt'),
      mp3Path: join(fixture, 'demo.mp3'),
      outputDir,
      style: 'frame-swiss-grid',
    },
  ]);
  await queue.waitForIdle();
  const task = queue.list()[0];
  if (!task || task.status !== 'success' || !task.outputPath) {
    throw new Error(`batch smoke failed: ${task?.error ?? task?.status ?? 'missing task'}`);
  }
  process.stdout.write(`✓ batch fixture rendered: ${task.outputPath}\n`);
  process.stdout.write(`✓ attempts=${task.attempts} storyboard=${task.storyboardSource}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
