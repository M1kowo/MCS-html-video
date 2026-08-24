import type { CliContext } from '../context.js';
import {
  applyVideoPackage,
  attachProjectAudio,
  writeContentGraphFile,
  writeFrameHtmlFile,
  writeSingleHtmlFile,
} from '../external-project.js';
import { ok } from '../output.js';
import { renderSubtitleVideo } from '../subtitle-video.js';
import { getDesignContext, getDesignPlan, writeDesignPlan } from '../design-plan.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function projectDesignContext(ctx: CliContext, id: string, recentLimit?: number) {
  ok(await getDesignContext(ctx, id, recentLimit));
}

export async function projectWriteDesignPlan(ctx: CliContext, id: string, planFile: string) {
  const plan = JSON.parse(await readFile(resolve(planFile), 'utf8')) as unknown;
  ok(await writeDesignPlan(ctx, id, plan));
}

export async function projectGetDesignPlan(ctx: CliContext, id: string) {
  ok(await getDesignPlan(ctx, id));
}

export async function projectWriteHtml(
  ctx: CliContext,
  id: string,
  opts: { htmlFile: string; duration?: number; nodeId?: string },
) {
  const result = await writeSingleHtmlFile(ctx, id, opts.htmlFile, {
    ...(opts.duration !== undefined && { durationSec: opts.duration }),
    ...(opts.nodeId !== undefined && { nodeId: opts.nodeId }),
  });
  ok({ project_id: id, frame: result.frame, preview_url: `/preview/${id}` });
}

export async function projectSetGraph(ctx: CliContext, id: string, graphFile: string) {
  const { project, graphPath } = await writeContentGraphFile(ctx, id, graphFile);
  ok({ project_id: project.id, graph_path: graphPath, frame_count: project.frames?.length ?? 0 });
}

export async function projectWriteFrame(
  ctx: CliContext,
  id: string,
  opts: { nodeId: string; htmlFile: string },
) {
  const { frame } = await writeFrameHtmlFile(ctx, id, opts.nodeId, opts.htmlFile);
  ok({ project_id: id, frame, preview_url: `/preview/${id}/frame/${opts.nodeId}` });
}

export async function projectApply(
  ctx: CliContext,
  packageDirectory: string,
  opts: { projectId?: string },
) {
  const result = await applyVideoPackage(ctx, packageDirectory, opts);
  ok({
    project_id: result.project.id,
    project: result.project,
    package_directory: result.packageDirectory,
    frame_count: result.frameCount,
  });
}

export async function subtitleRender(
  ctx: CliContext,
  opts: {
    srt: string;
    audio: string;
    outputDir: string;
    baseName?: string;
    style?: import('../batch/types.js').BatchTemplateId;
  },
) {
  const result = await renderSubtitleVideo(ctx, {
    srtPath: opts.srt,
    audioPath: opts.audio,
    outputDir: opts.outputDir,
    ...(opts.baseName && { baseName: opts.baseName }),
    ...(opts.style && { style: opts.style }),
  });
  ok(result);
}

export async function projectAttachAudio(
  ctx: CliContext,
  id: string,
  opts: { audioFile: string; role?: 'narration' | 'music'; volumeDb?: number },
) {
  const result = await attachProjectAudio(ctx, id, opts.audioFile, {
    ...(opts.role && { role: opts.role }),
    ...(opts.volumeDb !== undefined && { volumeDb: opts.volumeDb }),
  });
  ok({ project_id: id, asset: result.asset, soundtrack: result.project.soundtrack });
}
