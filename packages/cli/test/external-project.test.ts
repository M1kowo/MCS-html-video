import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrap } from '../dist/context.js';
import {
  applyVideoPackage,
  attachProjectAudio,
  writeSingleHtml,
} from '../dist/external-project.js';
import { getDesignPlan } from '../dist/design-plan.js';

const roots: string[] = [];

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'html-video-external-'));
  roots.push(root);
  await mkdir(join(root, '.html-video'), { recursive: true });
  return { root, ctx: await bootstrap({ cwd: root }) };
}

test('single external HTML becomes a renderable one-frame project', async () => {
  const { ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'External single frame' });
  const result = await writeSingleHtml(
    ctx,
    project.id,
    '<!doctype html><html><body><h1 data-hv-text>Hello</h1></body></html>',
    { durationSec: 7 },
  );

  assert.equal(result.project.frames?.length, 1);
  assert.equal(result.frame.durationSec, 7);
  assert.match(await readFile(result.frame.htmlPath, 'utf8'), /Hello/);
  assert.equal((await ctx.orchestrator.readContentGraph(project.id))?.intent, 'single-frame');
});

test('video package imports a graph and every mapped frame', async () => {
  const { root, ctx } = await workspace();
  const packageDir = join(root, 'video-package');
  await mkdir(join(packageDir, 'frames'), { recursive: true });
  await writeFile(join(packageDir, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    name: 'External package',
    designPlan: 'design-plan.json',
    contentGraph: 'content-graph.json',
    frames: [
      { nodeId: 'intro', file: 'frames/intro.html' },
      { nodeId: 'outro', file: 'frames/outro.html' },
    ],
  }));
  await writeFile(join(packageDir, 'design-plan.json'), JSON.stringify({
    schemaVersion: 1,
    mode: 'fresh',
    customStyleName: 'Package Original',
    mood: 'editorial',
    canvas: 'light',
    palette: [{ color: '#F2EBDD', usage: 'canvas' }, { color: '#221F1A', usage: 'ink' }],
    typography: { heading: 'Fraunces', body: 'Source Sans 3' },
    layoutFamily: 'asymmetric magazine spread',
    motionFamily: 'measured page reveal',
    transitionFamily: 'paper wipe',
    components: ['title-card', 'chapter-transition'],
    motifs: ['crop marks'],
    antiPatterns: ['generic centered hero'],
    differentiators: ['oversized folio numbers'],
  }));
  await writeFile(join(packageDir, 'content-graph.json'), JSON.stringify({
    schemaVersion: 1,
    intent: 'promo',
    nodes: [
      { id: 'intro', kind: 'text', text: 'Intro', durationSec: 2 },
      { id: 'outro', kind: 'text', text: 'Outro', durationSec: 3 },
    ],
    edges: [{ from: 'intro', to: 'outro', kind: 'sequence' }],
  }));
  await writeFile(join(packageDir, 'frames', 'intro.html'), '<html><body>Intro</body></html>');
  await writeFile(join(packageDir, 'frames', 'outro.html'), '<html><body>Outro</body></html>');

  const result = await applyVideoPackage(ctx, packageDir);
  assert.equal(result.frameCount, 2);
  assert.deepEqual(result.project.frames?.map((frame) => frame.graphNodeId), ['intro', 'outro']);
  assert.equal(result.designPlan?.customStyleName, 'Package Original');
  assert.equal((await getDesignPlan(ctx, result.project.id)).exists, true);
});

test('external audio is attached as narration without invoking an agent', async () => {
  const { root, ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'Audio project' });
  const audioPath = join(root, 'voice.mp3');
  await writeFile(audioPath, Buffer.from('fake-audio-for-store-test'));

  const result = await attachProjectAudio(ctx, project.id, audioPath);
  assert.equal(result.project.soundtrack?.narrationAssetId, result.asset.id);
  assert.equal(result.role, 'narration');
});
