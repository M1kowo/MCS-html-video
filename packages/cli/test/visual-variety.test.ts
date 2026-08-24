import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrap } from '../dist/context.js';
import { writeDesignPlan } from '../dist/design-plan.js';
import { writeSingleHtml } from '../dist/external-project.js';
import { assessHtmlVisualBeats, assessProjectVisualVariety, assertProjectVisualVariety } from '../dist/visual-variety.js';

const roots: string[] = [];

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'html-video-variety-'));
  roots.push(root);
  await mkdir(join(root, '.html-video'), { recursive: true });
  return { root, ctx: await bootstrap({ cwd: root }) };
}

function plan(varied: boolean) {
  return {
    schemaVersion: 1,
    mode: 'fresh',
    customStyleName: varied ? 'Varied editorial story' : 'Single subtitle card',
    mood: 'reflective',
    canvas: 'mixed',
    palette: [{ color: '#F3E7CF', usage: 'paper' }, { color: '#231F20', usage: 'ink' }],
    typography: { heading: 'KaiTi', body: 'Microsoft YaHei' },
    layoutFamily: varied ? ['editorial spread', 'split comparison'] : 'centered subtitle card',
    motionFamily: varied ? ['paper push', 'staggered blocks'] : 'fade up',
    transitionFamily: 'paper wipe',
    components: varied ? ['title-card', 'comparison', 'timeline'] : ['kinetic-captions'],
    motifs: ['notebook margin'],
    antiPatterns: ['single centered subtitle card'],
    differentiators: ['semantic visual beats'],
  };
}

test('single-layout 30 second HTML fails the visual variety gate', async () => {
  const { ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'Too simple' });
  await writeDesignPlan(ctx, project.id, plan(false));
  await writeSingleHtml(ctx, project.id, '<html><body><div class="caption">One layout</div></body></html>', { durationSec: 30 });

  const report = await assessProjectVisualVariety(ctx, project.id);
  assert.equal(report.ok, false);
  assert.equal(report.visualBeatCount, 1);
  assert.ok(report.issues.some((issue) => /3 are required/.test(issue)));
  await assert.rejects(() => assertProjectVisualVariety(ctx, project.id), /Visual variety gate failed/);
});

test('three semantic scenes plus a varied plan pass the visual variety gate', async () => {
  const { ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'Varied' });
  await writeDesignPlan(ctx, project.id, plan(true));
  const html = '<html><body><section class="scene">A</section><section class="scene">B</section><section class="scene">C</section></body></html>';
  await writeSingleHtml(ctx, project.id, html, { durationSec: 30 });

  assert.equal(assessHtmlVisualBeats(html), 3);
  const report = await assertProjectVisualVariety(ctx, project.id);
  assert.equal(report.ok, true);
  assert.equal(report.visualBeatCount, 3);
  assert.equal(report.layoutFamilyCount, 2);
  assert.equal(report.componentCount, 3);
});

test('short legacy HTML keeps the one-beat compatibility threshold', async () => {
  const { ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'Short legacy' });
  await writeDesignPlan(ctx, project.id, plan(false));
  await writeSingleHtml(ctx, project.id, '<html><body><h1>Short card</h1></body></html>', { durationSec: 7 });

  const report = await assertProjectVisualVariety(ctx, project.id);
  assert.equal(report.ok, true);
  assert.equal(report.requiredVisualBeats, 1);
});
