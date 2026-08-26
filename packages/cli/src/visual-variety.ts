import { readFile } from 'node:fs/promises';
import type { CliContext } from './context.js';
import { getDesignPlan, type DesignPlan } from './design-plan.js';

export interface VisualVarietyReport {
  ok: boolean;
  durationSec: number;
  requiredVisualBeats: number;
  visualBeatCount: number;
  layoutFamilyCount: number;
  motionFamilyCount: number;
  componentCount: number;
  transitionFamilyCount: number;
  issues: string[];
  guidance: string[];
}

/**
 * Finished-video quality gate for every user-facing export path (MCP, CLI, and
 * Studio). It checks the authored artifact rather than forcing a particular
 * template or DOM shape.
 */
export async function assessProjectVisualVariety(
  ctx: CliContext,
  projectId: string,
): Promise<VisualVarietyReport> {
  const project = await ctx.orchestrator.load(projectId);
  const frames = [...(project.frames ?? [])].sort((a, b) => a.order - b.order);
  const durationSec = frames.reduce((sum, frame) => sum + frame.durationSec, 0);
  const requiredVisualBeats = durationSec >= 12 ? 3 : 1;
  const planResult = await getDesignPlan(ctx, projectId);
  const plan = planResult.designPlan;
  const htmlDocuments = await Promise.all(frames.map((frame) => readFile(frame.htmlPath, 'utf8')));
  const declaredBeats = htmlDocuments.reduce((sum, html) => sum + declaredVisualBeats(html), 0);
  const visualBeatCount = frames.length > 1
    ? Math.max(frames.length, declaredBeats)
    : declaredBeats;

  const layoutFamilyCount = distinctCount(plan?.layoutFamily);
  const motionFamilyCount = distinctCount(plan?.motionFamily);
  const componentCount = distinctCount(plan?.components);
  const transitionFamilyCount = distinctCount(plan?.transitionFamily);
  const issues: string[] = [];

  if (!plan) issues.push('design-plan.json is required before final MCP rendering');
  if (visualBeatCount < requiredVisualBeats) {
    issues.push(`video has ${visualBeatCount} visual beat(s); ${requiredVisualBeats} are required for ${durationSec.toFixed(1)}s`);
  }
  if (durationSec >= 12 && layoutFamilyCount < 2) issues.push('design plan must use at least 2 distinct layout families');
  if (durationSec >= 12 && motionFamilyCount < 2) issues.push('design plan must use at least 2 distinct motion families or rhythms');
  if (durationSec >= 12 && componentCount < 3) issues.push('design plan must use at least 3 narrative component types');
  if (durationSec >= 12 && transitionFamilyCount < 1) issues.push('design plan must declare a transition family');

  return {
    ok: issues.length === 0,
    durationSec,
    requiredVisualBeats,
    visualBeatCount,
    layoutFamilyCount,
    motionFamilyCount,
    componentCount,
    transitionFamilyCount,
    issues,
    guidance: [
      'Group narration into semantic visual beats instead of placing every cue on the same subtitle card.',
      'Change composition geometry, focal scale, or information form between beats while preserving one visual identity.',
      'For single-page HTML, use repeated data-hv-scene attributes/classes or declare data-hv-visual-beats on the composition root.',
      'Use transitions to cover fully visible outgoing scenes; do not replace variety with random decorative motion.',
    ],
  };
}

export async function assertProjectVisualVariety(
  ctx: CliContext,
  projectId: string,
): Promise<VisualVarietyReport> {
  const report = await assessProjectVisualVariety(ctx, projectId);
  if (!report.ok) {
    throw new Error(`Visual variety gate failed: ${report.issues.join('; ')}. ${report.guidance.join(' ')}`);
  }
  return report;
}

export function assessHtmlVisualBeats(html: string): number {
  return declaredVisualBeats(html);
}

function declaredVisualBeats(html: string): number {
  const declared = /data-hv-visual-beats\s*=\s*["'](\d+)["']/i.exec(html);
  const declaredCount = declared ? Number(declared[1]) : 0;
  const explicitScenes = countMatches(html, /data-hv-scene(?:\s|=|>)/gi);
  const semanticScenes = countSceneClassTokens(html);
  return Math.max(declaredCount, explicitScenes, semanticScenes, 1);
}

function countMatches(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
}

function countSceneClassTokens(html: string): number {
  const tags = html.matchAll(/<(?:section|article|div)\b[^>]*class\s*=\s*["']([^"']*)["']/gi);
  return Array.from(tags).filter((match) => (match[1] ?? '').split(/\s+/).includes('scene')).length;
}

function distinctCount(value: DesignPlan[keyof DesignPlan] | undefined): number {
  if (value === undefined || value === null) return 0;
  const values = Array.isArray(value) ? value : [value];
  return new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean)).size;
}
