/**
 * External-AI project ingestion.
 *
 * This module is deliberately model/provider agnostic. Codex, GPT, Claude, or
 * any other tool can write HTML + a ContentGraph, then hand those files to the
 * CLI or MCP server without being registered in @html-video/runtime.
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ContentGraph } from '@html-video/content-graph';
import { AssetStore } from '@html-video/core';
import type { CliContext } from './context.js';
import { writeDesignPlan } from './design-plan.js';
import { assertPortableHtml } from './html-portability.js';

export interface VideoPackageManifest {
  schemaVersion: 1;
  name: string;
  intent?: string;
  aspect?: string;
  commercial?: boolean;
  templateId?: string;
  /** Optional project-level design plan path, relative to the package directory. */
  designPlan?: string;
  /** Single-frame HTML. Mutually exclusive with contentGraph/frames. */
  html?: string;
  /** ContentGraph JSON path, relative to the package directory. */
  contentGraph?: string;
  /** Explicit node → HTML mapping. If omitted, frames/<node-id>.html is inferred. */
  frames?: Array<{ nodeId: string; file: string }>;
  /** Files copied into the project's asset store. */
  assets?: string[];
}

export interface ApplyPackageOptions {
  projectId?: string;
}

export async function writeSingleHtml(
  ctx: CliContext,
  projectId: string,
  html: string,
  opts: { durationSec?: number; nodeId?: string } = {},
) {
  if (!html.trim()) throw new Error('HTML is empty');
  assertPortableHtml(html);
  const nodeId = normaliseNodeId(opts.nodeId ?? 'main');
  const durationSec = positiveDuration(opts.durationSec ?? 5);
  const graph: ContentGraph = {
    schemaVersion: 1,
    intent: 'single-frame',
    synopsis: 'Externally generated single-frame video',
    nodes: [{ id: nodeId, kind: 'text', text: '', durationSec }],
    edges: [],
  };
  await ctx.orchestrator.writeContentGraph(projectId, graph);
  const { project, frame } = await ctx.orchestrator.writeFrameHtml(projectId, nodeId, html);
  return { project, frame, graph };
}

export async function writeSingleHtmlFile(
  ctx: CliContext,
  projectId: string,
  htmlFile: string,
  opts: { durationSec?: number; nodeId?: string } = {},
) {
  const path = resolveExistingFile(htmlFile, 'HTML file');
  return writeSingleHtml(ctx, projectId, await readFile(path, 'utf8'), opts);
}

export async function writeContentGraphValue(
  ctx: CliContext,
  projectId: string,
  graph: ContentGraph,
) {
  return ctx.orchestrator.writeContentGraph(projectId, graph);
}

export async function writeContentGraphFile(
  ctx: CliContext,
  projectId: string,
  graphFile: string,
) {
  const path = resolveExistingFile(graphFile, 'ContentGraph file');
  const graph = JSON.parse(await readFile(path, 'utf8')) as ContentGraph;
  return writeContentGraphValue(ctx, projectId, graph);
}

export async function writeFrameHtmlValue(
  ctx: CliContext,
  projectId: string,
  nodeId: string,
  html: string,
) {
  if (!html.trim()) throw new Error('HTML is empty');
  assertPortableHtml(html);
  return ctx.orchestrator.writeFrameHtml(projectId, nodeId, html);
}

export async function writeFrameHtmlFile(
  ctx: CliContext,
  projectId: string,
  nodeId: string,
  htmlFile: string,
) {
  const path = resolveExistingFile(htmlFile, 'frame HTML file');
  return writeFrameHtmlValue(ctx, projectId, nodeId, await readFile(path, 'utf8'));
}

export async function attachProjectAudio(
  ctx: CliContext,
  projectId: string,
  audioFile: string,
  opts: { role?: 'narration' | 'music'; volumeDb?: number } = {},
) {
  const path = resolveExistingFile(audioFile, 'audio file');
  const assetId = await AssetStore.computeId(path);
  const withAsset = await ctx.orchestrator.addFileAsset(projectId, path, opts.role === 'music' ? 'Background music' : 'Narration audio');
  const asset = withAsset.assets.find((item) => item.id === assetId);
  if (!asset) throw new Error('Audio asset was not created');
  const project = await ctx.orchestrator.load(projectId);
  const soundtrack = { ...(project.soundtrack ?? {}) };
  if (opts.role === 'music') {
    soundtrack.musicAssetId = asset.id;
    if (opts.volumeDb !== undefined) soundtrack.musicVolumeDb = opts.volumeDb;
  } else {
    soundtrack.narrationAssetId = asset.id;
    if (opts.volumeDb !== undefined) soundtrack.narrationVolumeDb = opts.volumeDb;
  }
  project.soundtrack = soundtrack;
  await ctx.projects.save(project);
  return { project, asset, role: opts.role ?? 'narration' };
}

export async function applyVideoPackage(
  ctx: CliContext,
  packageDirectory: string,
  opts: ApplyPackageOptions = {},
) {
  const packageDir = resolve(packageDirectory);
  const manifestPath = insidePackage(packageDir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`manifest.json not found in ${packageDir}`);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as VideoPackageManifest;
  validateManifest(manifest);

  const project = opts.projectId
    ? await ctx.orchestrator.load(opts.projectId)
    : await ctx.orchestrator.create({
        name: manifest.name,
        ...(manifest.intent !== undefined && { intent: manifest.intent }),
        preferences: {
          ...(manifest.aspect !== undefined && { aspect: manifest.aspect }),
          ...(manifest.commercial !== undefined && { commercial: manifest.commercial }),
        },
      });

  if (manifest.templateId !== undefined && project.templateId !== manifest.templateId) {
    await ctx.orchestrator.setTemplate(project.id, manifest.templateId);
  }

  const designPlanResult = manifest.designPlan
    ? await writeDesignPlan(
        ctx,
        project.id,
        JSON.parse(await readFile(insidePackage(packageDir, manifest.designPlan), 'utf8')),
      )
    : undefined;

  for (const assetFile of manifest.assets ?? []) {
    await ctx.orchestrator.addFileAsset(project.id, insidePackage(packageDir, assetFile));
  }

  if (manifest.html) {
    const htmlPath = insidePackage(packageDir, manifest.html);
    await writeSingleHtml(ctx, project.id, await readFile(htmlPath, 'utf8'));
  } else {
    const graphPath = insidePackage(packageDir, manifest.contentGraph!);
    const graph = JSON.parse(await readFile(graphPath, 'utf8')) as ContentGraph;
    await ctx.orchestrator.writeContentGraph(project.id, graph);
    const frameEntries = manifest.frames?.length
      ? manifest.frames
      : await inferFrames(packageDir, graph);
    if (frameEntries.length !== graph.nodes.length) {
      throw new Error(`Expected ${graph.nodes.length} frame HTML files, found ${frameEntries.length}`);
    }
    for (const entry of frameEntries) {
      const htmlPath = insidePackage(packageDir, entry.file);
      await writeFrameHtmlValue(ctx, project.id, entry.nodeId, await readFile(htmlPath, 'utf8'));
    }
  }

  const updated = await ctx.orchestrator.load(project.id);
  return {
    project: updated,
    packageDirectory: packageDir,
    frameCount: updated.frames?.length ?? 0,
    designPlan: designPlanResult?.designPlan ?? null,
    similarityReport: designPlanResult?.similarityReport ?? null,
  };
}

function validateManifest(manifest: VideoPackageManifest): void {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error('manifest.schemaVersion must be 1');
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) throw new Error('manifest.name is required');
  const single = typeof manifest.html === 'string' && manifest.html.length > 0;
  const multi = typeof manifest.contentGraph === 'string' && manifest.contentGraph.length > 0;
  if (single === multi) throw new Error('Manifest must specify exactly one of html or contentGraph');
  if (manifest.frames && !multi) throw new Error('manifest.frames requires manifest.contentGraph');
  if (manifest.designPlan !== undefined && (typeof manifest.designPlan !== 'string' || !manifest.designPlan.trim())) {
    throw new Error('manifest.designPlan must be a non-empty relative path');
  }
}

async function inferFrames(packageDir: string, graph: ContentGraph) {
  const framesDir = insidePackage(packageDir, 'frames');
  if (!existsSync(framesDir)) return [];
  const files = (await readdir(framesDir)).filter((name) => name.toLowerCase().endsWith('.html'));
  const result: Array<{ nodeId: string; file: string }> = [];
  for (const node of graph.nodes) {
    const exact = `${node.id}.html`;
    const match = files.find((name) => name === exact)
      ?? files.find((name) => name.endsWith(`-${node.id}.html`));
    if (match) result.push({ nodeId: node.id, file: `frames/${match}` });
  }
  return result;
}

function insidePackage(packageDir: string, childPath: string): string {
  if (!childPath || isAbsolute(childPath)) throw new Error(`Package path must be relative: ${childPath}`);
  const target = resolve(packageDir, childPath);
  const rel = relative(packageDir, target);
  if (rel === '..' || rel.startsWith(`..\\`) || rel.startsWith('../') || isAbsolute(rel)) {
    throw new Error(`Package path escapes its directory: ${childPath}`);
  }
  if (!existsSync(target)) throw new Error(`Package file not found: ${childPath}`);
  return target;
}

function resolveExistingFile(path: string, label: string): string {
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`${label} not found: ${resolved}`);
  return resolved;
}

function positiveDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error('durationSec must be greater than zero');
  return value;
}

function normaliseNodeId(value: string): string {
  const id = value.trim().replace(/[^a-z0-9_-]/gi, '_');
  if (!id) throw new Error('nodeId is empty');
  return id;
}
