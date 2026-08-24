import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrap } from '../dist/context.js';
import { getDesignContext, getDesignPlan, writeDesignPlan } from '../dist/design-plan.js';

const roots: string[] = [];

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'html-video-design-'));
  roots.push(root);
  await mkdir(join(root, '.html-video'), { recursive: true });
  return { root, ctx: await bootstrap({ cwd: root }) };
}

function plan(mode: 'fresh' | 'series' = 'fresh', withPack = true) {
  return {
    schemaVersion: 1,
    mode,
    ...(withPack && { stylePackId: ['swiss-pulse', 'deconstructed'] }),
    customStyleName: 'Editorial Signal Lab',
    mood: ['precise', 'restless'],
    canvas: 'mixed',
    palette: [
      { color: '#F4F0E8', usage: 'paper canvas' },
      { color: '#161616', usage: 'primary ink' },
      { color: '#E84A27', usage: 'signal accent' },
    ],
    typography: { heading: 'Archivo Black', body: 'IBM Plex Sans' },
    layoutFamily: ['offset editorial grid', 'edge crop'],
    motionFamily: ['directional snap', 'staggered reveal'],
    transitionFamily: ['paper wipe'],
    components: ['title-card', 'comparison', 'chapter-transition'],
    motifs: ['registration marks', 'torn paper edge'],
    antiPatterns: ['centered hero', 'blue-purple neon gradient'],
    differentiators: ['warm paper field', 'alternating left-edge anchors'],
  };
}

test('design context exposes optional style packs and component catalog', async () => {
  const { ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'Context' });
  const context = await getDesignContext(ctx, project.id);
  assert.equal(context.stylePacks.length, 8);
  assert.ok(context.stylePacks.some((item) => item.id === 'swiss-pulse'));
  assert.ok(context.componentCatalog.some((item) => item.id === 'title-card'));
  assert.match(context.freedom, /optional guidance/i);
});

test('custom design without stylePackId is valid and can be read back', async () => {
  const { ctx } = await workspace();
  const project = await ctx.orchestrator.create({ name: 'Custom' });
  const written = await writeDesignPlan(ctx, project.id, plan('fresh', false));
  assert.equal(written.designPlan.stylePackId, undefined);
  assert.equal(written.similarityReport.mostSimilarProject, null);

  const loaded = await getDesignPlan(ctx, project.id);
  assert.equal(loaded.exists, true);
  assert.equal(loaded.designPlan?.customStyleName, 'Editorial Signal Lab');
});

test('second highly similar fresh plan returns a non-blocking similarity warning', async () => {
  const { ctx } = await workspace();
  const first = await ctx.orchestrator.create({ name: 'First visual' });
  await writeDesignPlan(ctx, first.id, plan());
  const second = await ctx.orchestrator.create({ name: 'Second visual' });
  const result = await writeDesignPlan(ctx, second.id, plan());

  assert.equal(result.similarityReport.mostSimilarProject?.id, first.id);
  assert.equal(result.similarityReport.similarity, 1);
  assert.equal(result.similarityReport.blocked, false);
  assert.match(result.similarityReport.warning ?? '', /highly similar/i);
  assert.ok(result.similarityReport.repeatedFeatures.length >= 8);
});

test('series plan remains allowed and recommends varying layout or rhythm', async () => {
  const { ctx } = await workspace();
  const first = await ctx.orchestrator.create({ name: 'Series episode 1' });
  await writeDesignPlan(ctx, first.id, plan());
  const second = await ctx.orchestrator.create({ name: 'Series episode 2' });
  const result = await writeDesignPlan(ctx, second.id, plan('series'));

  assert.equal(result.similarityReport.blocked, false);
  assert.match(result.similarityReport.warning ?? '', /Series consistency is allowed/);
  assert.match(result.similarityReport.warning ?? '', /layout or motion rhythm/);
});
