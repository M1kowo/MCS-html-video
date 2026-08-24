import { randomUUID } from 'node:crypto';
import { basename, extname, resolve } from 'node:path';
import type { CliContext } from './context.js';
import { createBatchProcessor } from './batch/processor.js';
import { BATCH_TEMPLATE_IDS, type BatchTemplateId } from './batch/types.js';

export interface RenderSubtitleVideoInput {
  srtPath: string;
  audioPath: string;
  outputDir: string;
  baseName?: string;
  style?: BatchTemplateId;
  onProgress?: (progress: number, stage: string) => void;
}

/**
 * High-level local tool used by GPT/other agents for the common “SRT + audio →
 * MP4” request. The caller is the AI: html-video performs deterministic visual
 * assembly and rendering and never selects or invokes a model here.
 */
export async function renderSubtitleVideo(ctx: CliContext, input: RenderSubtitleVideoInput) {
  const srtPath = resolve(input.srtPath);
  const audioPath = resolve(input.audioPath);
  const outputDir = resolve(input.outputDir);
  const baseName = input.baseName?.trim()
    || basename(srtPath, extname(srtPath));
  if (input.style && !(BATCH_TEMPLATE_IDS as readonly string[]).includes(input.style)) {
    throw new Error(`Unknown subtitle video style: ${input.style}`);
  }
  const processor = createBatchProcessor(ctx);
  let progress = 0;
  let stage = '准备中';
  const result = await processor(
    {
      baseName,
      srtPath,
      mp3Path: audioPath,
      outputDir,
      // The external AI chooses the style. Avoid the legacy internal-agent
      // `ai-auto` branch so this path remains provider independent.
      style: input.style ?? 'frame-swiss-grid',
    },
    `external-${randomUUID()}`,
    (patch) => {
      if (patch.progress !== undefined) progress = patch.progress;
      if (patch.stage !== undefined) stage = patch.stage;
      input.onProgress?.(progress, stage);
    },
  );
  return { ...result, progress: 100, stage: '已完成' };
}
