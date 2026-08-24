import { spawn } from 'node:child_process';
import { basename, join } from 'node:path';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { validate as validateGraph } from '@html-video/content-graph';
import { detectAll, findAgent, spawnAgent } from '@html-video/runtime';
import type { CliContext } from '../context.js';
import type { BatchTaskResult, BatchTaskUpdate } from './queue.js';
import { parseSrt } from './srt.js';
import {
  buildControlledStoryboardPrompt,
  createFallbackStoryboard,
  storyboardFromAiReply,
} from './storyboard.js';
import type { BatchStoryboard, BatchTaskInput, SubtitleCue } from './types.js';

export function createBatchProcessor(ctx: CliContext) {
  return async (
    input: BatchTaskInput,
    taskId: string,
    update: (patch: BatchTaskUpdate) => void,
  ): Promise<BatchTaskResult> => {
    const taskDir = join(ctx.projectRoot, '.html-video', 'batch', 'tasks', taskId);
    const logPath = join(taskDir, 'task.log');
    await mkdir(taskDir, { recursive: true });
    await mkdir(input.outputDir, { recursive: true });
    update({ logPath, progress: 2, stage: '正在读取 SRT 字幕' });
    const log = async (message: string) => {
      const line = `[${new Date().toISOString()}] ${message}\n`;
      await writeFile(logPath, line, { encoding: 'utf8', flag: 'a' });
    };

    await log(`task ${taskId} started for ${input.baseName}`);
    await log(`SRT: ${input.srtPath}`);
    await log(`MP3: ${input.mp3Path}`);

    const cuesRaw = parseSrt(await readFile(input.srtPath));
    if (cuesRaw.length === 0) throw new Error('SRT 中没有可用的字幕段');
    if (!containsChineseText(cuesRaw)) {
      throw new Error('当前版本只生成中文版视频；请提供至少包含一段中文的 SRT 字幕');
    }

    update({ progress: 8, stage: '正在读取 MP3 时长' });
    const durationSec = await probeAudioDuration(input.mp3Path);
    const durationMs = Math.round(durationSec * 1000);
    const cues = normalizeCuesToAudio(cuesRaw, durationMs);
    if (cues.length === 0) throw new Error('MP3 有效时长内没有字幕内容');
    await log(`audio duration ${durationSec.toFixed(3)}s; ${cues.length} cue(s)`);

    update({
      progress: 14,
      stage: input.style === 'ai-auto' ? '正在进行受控 AI 编排' : '正在生成字幕故事板',
    });
    const storyboard = await createStoryboard(ctx, input, cues, taskDir, log);
    update({
      storyboardSource: storyboard.source,
      ...(storyboard.warning && { storyboardWarning: storyboard.warning }),
    });
    const validation = validateGraph(storyboard.graph);
    if (!validation.ok) {
      throw new Error(
        `生成的内容图谱无效：${validation.errors.map((item) => item.message).join('; ')}`,
      );
    }
    await writeFile(
      join(taskDir, 'content-graph.json'),
      JSON.stringify(storyboard.graph, null, 2),
      'utf8',
    );
    await log(
      `storyboard source: ${storyboard.source}${storyboard.warning ? ` (${storyboard.warning})` : ''}`,
    );

    update({ progress: 24, stage: '正在组装受控中文模板' });
    const template = ctx.templates.get('frame-srt-caption');
    if (!template.__dir) throw new Error('找不到 frame-srt-caption 模板目录');
    const templatePath = join(template.__dir, template.source_entry);
    const timelinePath = join(taskDir, 'timeline.html');
    const templateHtml = await readFile(templatePath, 'utf8');
    const payload = safeInlineJson({ cues, directions: storyboard.directions });
    const assembled = templateHtml.replace("'__HV_BATCH_DATA__'", payload);
    if (assembled === templateHtml) throw new Error('批量模板缺少数据占位标记');
    await writeFile(timelinePath, assembled, 'utf8');

    const silentVideoPath = join(taskDir, 'video-only.mp4');
    update({ progress: 30, stage: '正在通过 Chromium 渲染画面' });
    const adapter = ctx.engines.get('hyperframes');
    await adapter.render(
      {
        template: {
          id: 'frame-srt-caption',
          engine: 'hyperframes',
          sourcePath: timelinePath,
          mode: 'bridge',
        },
        variables: {},
        config: {
          format: 'mp4',
          resolution: { width: 1280, height: 720 },
          fps: 60,
          duration: durationSec,
          durationMode: 'explicit',
          outputPath: silentVideoPath,
        },
      },
      {
        workDir: taskDir,
        onProgress: (pct) =>
          update({
            progress: 30 + pct * 0.58,
            stage: '正在渲染视频画面',
          }),
      },
    );

    update({ progress: 90, stage: '正在合并 MP3 音频' });
    const tempOutput = join(taskDir, `${input.baseName}.mp4`);
    await muxAudio(silentVideoPath, input.mp3Path, tempOutput, durationSec);
    const outputPath = join(input.outputDir, `${input.baseName}.mp4`);
    await copyFile(tempOutput, outputPath);
    await log(`MP4 written: ${outputPath}`);

    update({ progress: 97, stage: '正在验证 MP4 参数' });
    const verification = await probeVideo(outputPath);
    assertVideoContract(verification);
    await log(`verified: ${JSON.stringify(verification)}`);

    const outputLogPath = join(input.outputDir, `${input.baseName}.html-video.log`);
    await copyFile(logPath, outputLogPath);
    await rm(tempOutput, { force: true });
    update({ progress: 100, stage: '已完成', logPath: outputLogPath });
    return {
      outputPath,
      logPath: outputLogPath,
      storyboardSource: storyboard.source,
      ...(storyboard.warning && { storyboardWarning: storyboard.warning }),
    };
  };
}

async function createStoryboard(
  ctx: CliContext,
  input: BatchTaskInput,
  cues: SubtitleCue[],
  taskDir: string,
  log: (message: string) => Promise<void>,
): Promise<BatchStoryboard> {
  if (input.style !== 'ai-auto') return createFallbackStoryboard(cues, input.style);
  try {
    const detected = await detectAll();
    const selected = input.agentId
      ? detected.find((agent) => agent.id === input.agentId && agent.available)
      : detected.find((agent) => agent.available);
    if (!selected) throw new Error('没有可用的本地 Agent 运行时');
    const def = findAgent(selected.id);
    if (!def) throw new Error(`Agent 运行时“${selected.id}”尚未注册`);
    await log(`using controlled AI storyboard via ${selected.id}`);
    const prompt = buildControlledStoryboardPrompt(cues);
    const controller = new AbortController();
    // Long-form SRT files can contain 100+ cues and require a sizeable but
    // still allowlisted JSON storyboard. Give the local agent enough time to
    // complete that structured response before taking the stable fallback.
    const timer = setTimeout(() => controller.abort(), 240_000);
    let output = '';
    let agentError = '';
    const handle = spawnAgent({
      def,
      prompt,
      context: {
        cwd: taskDir,
        ...(input.agentModel && { model: input.agentModel }),
      },
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'text') output += event.chunk;
        else if (event.type === 'error') agentError = event.message;
      },
    });
    const result = await handle.done.finally(() => clearTimeout(timer));
    if (result.exitCode !== 0)
      throw new Error(agentError || `agent exited with code ${result.exitCode}`);
    return storyboardFromAiReply(output, cues);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log(`AI storyboard failed; falling back: ${message}`);
    return createFallbackStoryboard(
      cues,
      'ai-auto',
      `AI 编排失败，已回退到稳定字幕模板：${message}`,
    );
  }
}

function normalizeCuesToAudio(cues: SubtitleCue[], durationMs: number): SubtitleCue[] {
  return cues
    .filter((cue) => cue.startMs < durationMs)
    .map((cue) => ({ ...cue, endMs: Math.min(cue.endMs, durationMs) }))
    .filter((cue) => cue.endMs > cue.startMs);
}

function containsChineseText(cues: SubtitleCue[]): boolean {
  return cues.some((cue) => /\p{Script=Han}/u.test(cue.text));
}

function safeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export async function probeAudioDuration(path: string): Promise<number> {
  const output = await runProcess('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    path,
  ]);
  const duration = Number(output.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(`Unable to read MP3 duration: ${basename(path)}`);
  return duration;
}

async function muxAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  durationSec: number,
): Promise<void> {
  await runProcess('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    durationSec.toFixed(3),
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

interface VideoProbe {
  streams?: Array<{
    codec_name?: string;
    pix_fmt?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
  }>;
  format?: { duration?: string };
}

async function probeVideo(path: string): Promise<VideoProbe> {
  const output = await runProcess('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,pix_fmt,width,height,r_frame_rate:format=duration',
    '-of',
    'json',
    path,
  ]);
  return JSON.parse(output.stdout) as VideoProbe;
}

function assertVideoContract(probe: VideoProbe): void {
  const video = probe.streams?.[0];
  if (!video) throw new Error('Rendered MP4 has no video stream');
  if (video.codec_name !== 'h264')
    throw new Error(`Expected H.264, got ${video.codec_name ?? 'unknown'}`);
  if (video.pix_fmt !== 'yuv420p')
    throw new Error(`Expected yuv420p, got ${video.pix_fmt ?? 'unknown'}`);
  if (video.width !== 1280 || video.height !== 720)
    throw new Error(`Expected 1280x720, got ${video.width}x${video.height}`);
  if (video.r_frame_rate !== '60/1')
    throw new Error(`Expected 60fps, got ${video.r_frame_rate ?? 'unknown'}`);
}

function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}
