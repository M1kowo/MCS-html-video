import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CliContext } from './context.js';
import { COMPONENT_CATALOG, DESIGN_PRINCIPLES, STYLE_PACKS } from './design-library.js';

export interface DesignPlan {
  schemaVersion: 1;
  mode: 'fresh' | 'series';
  stylePackId?: string | string[];
  customStyleName: string;
  mood: string | string[];
  canvas: 'light' | 'dark' | 'mixed';
  palette: Array<{ color: string; usage: string }>;
  typography: { heading: string; body: string };
  layoutFamily: string | string[];
  motionFamily: string | string[];
  transitionFamily: string | string[];
  components: string[];
  motifs: string[];
  antiPatterns: string[];
  differentiators: string[];
}

export interface SimilarityReport {
  threshold: number;
  mostSimilarProject: { id: string; name: string } | null;
  similarity: number;
  similarityPercent: number;
  repeatedFeatures: string[];
  suggestedReplacements: string[];
  warning: string | null;
  blocked: false;
}

interface RecentDesign {
  project: { id: string; name: string; updatedAt: string };
  plan: DesignPlan;
}

const SIMILARITY_THRESHOLD = 0.72;

export async function getDesignContext(ctx: CliContext, projectId: string, recentLimit = 8) {
  await ctx.orchestrator.load(projectId);
  const recent = await readRecentDesigns(ctx, projectId, recentLimit);
  return {
    stylePacks: STYLE_PACKS,
    componentCatalog: COMPONENT_CATALOG,
    principles: DESIGN_PRINCIPLES,
    recentDesigns: recent.map(({ project, plan }) => ({
      projectId: project.id,
      projectName: project.name,
      updatedAt: project.updatedAt,
      mode: plan.mode,
      stylePackId: plan.stylePackId ?? null,
      customStyleName: plan.customStyleName,
      canvas: plan.canvas,
      palette: plan.palette,
      typography: plan.typography,
      layoutFamily: plan.layoutFamily,
      motionFamily: plan.motionFamily,
      transitionFamily: plan.transitionFamily,
      components: plan.components,
      motifs: plan.motifs,
    })),
    avoidRepeatedFeatures: frequentFeatures(recent),
    freedom: 'Style packs, templates, and catalog components are optional guidance. Mix packs or create a fully custom visual identity and freely authored HTML.',
  };
}

export async function writeDesignPlan(ctx: CliContext, projectId: string, value: unknown) {
  await ctx.orchestrator.load(projectId);
  const plan = validateDesignPlan(value);
  const recent = await readRecentDesigns(ctx, projectId, 12);
  const similarityReport = compareWithHistory(plan, recent);
  const projectDir = await ctx.projects.ensureDir(projectId);
  const path = join(projectDir, 'design-plan.json');
  await writeFile(path, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return { projectId, path, designPlan: plan, similarityReport };
}

export async function getDesignPlan(ctx: CliContext, projectId: string) {
  await ctx.orchestrator.load(projectId);
  const path = designPlanPath(ctx, projectId);
  if (!existsSync(path)) return { projectId, path, exists: false as const, designPlan: null };
  const plan = validateDesignPlan(JSON.parse(await readFile(path, 'utf8')));
  return { projectId, path, exists: true as const, designPlan: plan };
}

export async function hasDesignPlan(ctx: CliContext, projectId: string): Promise<boolean> {
  return existsSync(designPlanPath(ctx, projectId));
}

export function validateDesignPlan(value: unknown): DesignPlan {
  if (!isRecord(value)) throw new Error('design plan must be an object');
  if (value.schemaVersion !== 1) throw new Error('designPlan.schemaVersion must be 1');
  if (value.mode !== 'fresh' && value.mode !== 'series') throw new Error('designPlan.mode must be fresh or series');
  if (value.canvas !== 'light' && value.canvas !== 'dark' && value.canvas !== 'mixed') {
    throw new Error('designPlan.canvas must be light, dark, or mixed');
  }
  const stylePackId = optionalStringOrStrings(value.stylePackId, 'stylePackId');
  if (stylePackId) {
    const known = new Set(STYLE_PACKS.map((pack) => pack.id));
    for (const id of asArray(stylePackId)) {
      if (!known.has(id)) throw new Error(`Unknown stylePackId: ${id}. Omit stylePackId for a fully custom design.`);
    }
  }
  const palette = requiredObjectArray(value.palette, 'palette').map((entry, index) => ({
    color: requiredString(entry.color, `palette[${index}].color`),
    usage: requiredString(entry.usage, `palette[${index}].usage`),
  }));
  if (palette.length < 2) throw new Error('designPlan.palette must contain at least two colors with usage');
  if (!isRecord(value.typography)) throw new Error('designPlan.typography must be an object');

  return {
    schemaVersion: 1,
    mode: value.mode,
    ...(stylePackId && { stylePackId }),
    customStyleName: requiredString(value.customStyleName, 'customStyleName'),
    mood: requiredStringOrStrings(value.mood, 'mood'),
    canvas: value.canvas,
    palette,
    typography: {
      heading: requiredString(value.typography.heading, 'typography.heading'),
      body: requiredString(value.typography.body, 'typography.body'),
    },
    layoutFamily: requiredStringOrStrings(value.layoutFamily, 'layoutFamily'),
    motionFamily: requiredStringOrStrings(value.motionFamily, 'motionFamily'),
    transitionFamily: requiredStringOrStrings(value.transitionFamily, 'transitionFamily'),
    components: requiredStrings(value.components, 'components'),
    motifs: requiredStrings(value.motifs, 'motifs'),
    antiPatterns: requiredStrings(value.antiPatterns, 'antiPatterns'),
    differentiators: requiredStrings(value.differentiators, 'differentiators'),
  };
}

function compareWithHistory(plan: DesignPlan, recent: RecentDesign[]): SimilarityReport {
  let best: { item: RecentDesign; score: number; repeated: string[]; suggestions: string[] } | undefined;
  for (const item of recent) {
    const comparison = comparePlans(plan, item.plan);
    if (!best || comparison.score > best.score) best = { item, ...comparison };
  }
  if (!best) return emptyReport();
  const tooSimilar = best.score >= SIMILARITY_THRESHOLD;
  const warning = plan.mode === 'fresh' && tooSimilar
    ? `Fresh design is highly similar to ${best.item.project.name}; vary the suggested elements before HTML generation.`
    : plan.mode === 'series'
      ? `Series consistency is allowed; keep the identity while varying shot layout or motion rhythm from ${best.item.project.name}.`
      : null;
  return {
    threshold: SIMILARITY_THRESHOLD,
    mostSimilarProject: { id: best.item.project.id, name: best.item.project.name },
    similarity: round(best.score),
    similarityPercent: Math.round(best.score * 100),
    repeatedFeatures: best.repeated,
    suggestedReplacements: best.suggestions,
    warning,
    blocked: false,
  };
}

function comparePlans(a: DesignPlan, b: DesignPlan) {
  const features = [
    compareFeature('style pack', a.stylePackId, b.stylePackId, 0.15, 'switch or remove the style pack'),
    compareFeature('palette', a.palette.map((item) => item.color), b.palette.map((item) => item.color), 0.15, 'change the dominant/background/accent color roles'),
    compareFeature('font', [a.typography.heading, a.typography.body], [b.typography.heading, b.typography.body], 0.10, 'choose a different heading/body type pairing'),
    compareFeature('layout', a.layoutFamily, b.layoutFamily, 0.15, 'change composition geometry or shot layout'),
    compareFeature('motion', a.motionFamily, b.motionFamily, 0.12, 'change entrance direction, easing, or motion rhythm'),
    compareFeature('transition', a.transitionFamily, b.transitionFamily, 0.10, 'use a different scene transition family'),
    compareFeature('component combination', a.components, b.components, 0.13, 'replace or reorder major component types'),
    compareFeature('visual motif', a.motifs, b.motifs, 0.10, 'introduce a distinct visual motif'),
  ];
  return {
    score: features.reduce((sum, feature) => sum + feature.score, 0),
    repeated: features.filter((feature) => feature.similarity >= 0.5).map((feature) => `${feature.name}: ${Math.round(feature.similarity * 100)}% overlap`),
    suggestions: features.filter((feature) => feature.similarity >= 0.5).map((feature) => feature.suggestion),
  };
}

function compareFeature(name: string, a: unknown, b: unknown, weight: number, suggestion: string) {
  const left = new Set(normalizedValues(a));
  const right = new Set(normalizedValues(b));
  const union = new Set([...left, ...right]);
  const intersection = [...left].filter((item) => right.has(item));
  const similarity = union.size === 0 ? 0 : intersection.length / union.size;
  return { name, similarity, score: similarity * weight, suggestion };
}

async function readRecentDesigns(ctx: CliContext, excludeProjectId: string, limit: number): Promise<RecentDesign[]> {
  const projects = await ctx.orchestrator.list();
  const result: RecentDesign[] = [];
  for (const project of projects) {
    if (project.id === excludeProjectId) continue;
    const path = designPlanPath(ctx, project.id);
    if (!existsSync(path)) continue;
    try {
      result.push({ project, plan: validateDesignPlan(JSON.parse(await readFile(path, 'utf8'))) });
    } catch {
      // Historical projects with malformed/older plans are ignored, not broken.
    }
    if (result.length >= limit) break;
  }
  return result;
}

function frequentFeatures(recent: RecentDesign[]) {
  const buckets: Record<string, string[]> = {
    stylePacks: [], palettes: [], fonts: [], layouts: [], motions: [], transitions: [], components: [], motifs: [],
  };
  for (const { plan } of recent.slice(0, 5)) {
    buckets.stylePacks!.push(...normalizedValues(plan.stylePackId));
    buckets.palettes!.push(...normalizedValues(plan.palette.map((item) => item.color)));
    buckets.fonts!.push(...normalizedValues([plan.typography.heading, plan.typography.body]));
    buckets.layouts!.push(...normalizedValues(plan.layoutFamily));
    buckets.motions!.push(...normalizedValues(plan.motionFamily));
    buckets.transitions!.push(...normalizedValues(plan.transitionFamily));
    buckets.components!.push(...normalizedValues(plan.components));
    buckets.motifs!.push(...normalizedValues(plan.motifs));
  }
  return Object.fromEntries(Object.entries(buckets).map(([key, values]) => [key, frequent(values)]));
}

function frequent(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

function designPlanPath(ctx: CliContext, projectId: string): string {
  return join(ctx.projectRoot, '.html-video', 'projects', projectId, 'design-plan.json');
}

function emptyReport(): SimilarityReport {
  return { threshold: SIMILARITY_THRESHOLD, mostSimilarProject: null, similarity: 0, similarityPercent: 0, repeatedFeatures: [], suggestedReplacements: [], warning: null, blocked: false };
}

function normalizedValues(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return asArray(value).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

function asArray<T>(value: T | T[]): T[] { return Array.isArray(value) ? value : [value]; }
function round(value: number): number { return Math.round(value * 1000) / 1000; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`designPlan.${field} is required`);
  return value.trim();
}

function requiredStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(`designPlan.${field} must be a string array`);
  return value.map((item) => (item as string).trim());
}

function requiredStringOrStrings(value: unknown, field: string): string | string[] {
  if (Array.isArray(value)) {
    const result = requiredStrings(value, field);
    if (result.length === 0) throw new Error(`designPlan.${field} must not be empty`);
    return result;
  }
  return requiredString(value, field);
}

function optionalStringOrStrings(value: unknown, field: string): string | string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredStringOrStrings(value, field);
}

function requiredObjectArray(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) throw new Error(`designPlan.${field} must be an object array`);
  return value as Record<string, unknown>[];
}
