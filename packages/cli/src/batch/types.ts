import type { ContentGraph } from '@html-video/content-graph';

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface MediaPair {
  baseName: string;
  srtPath: string;
  mp3Path: string;
}

export interface MediaMatchResult {
  pairs: MediaPair[];
  unmatchedSrt: string[];
  unmatchedMp3: string[];
}

export const BATCH_TEMPLATE_IDS = [
  'frame-swiss-grid',
  'frame-kinetic-type',
  'frame-warm-grain',
  'frame-light-leak-cinema',
  'frame-bold-signal',
] as const;

export type BatchTemplateId = (typeof BATCH_TEMPLATE_IDS)[number];
export const BATCH_LAYOUTS = ['center', 'lower-third', 'split-left', 'split-right'] as const;
export type BatchLayout = (typeof BATCH_LAYOUTS)[number];
export const BATCH_THEMES = ['dark', 'light', 'warm', 'electric', 'cinema'] as const;
export type BatchTheme = (typeof BATCH_THEMES)[number];
export const BATCH_ANIMATIONS = ['fade-up', 'scale-in', 'wipe', 'type-focus'] as const;
export type BatchAnimation = (typeof BATCH_ANIMATIONS)[number];

export interface SceneDirection {
  cueIndex: number;
  templateId: BatchTemplateId;
  layout: BatchLayout;
  theme: BatchTheme;
  animation: BatchAnimation;
  emphasis?: string[];
}

export interface BatchStoryboard {
  graph: ContentGraph;
  directions: SceneDirection[];
  source: 'ai' | 'fallback' | 'manual';
  warning?: string;
}

export type BatchTaskStatus = 'waiting' | 'processing' | 'success' | 'failed';

export interface BatchTaskInput extends MediaPair {
  outputDir: string;
  style: 'ai-auto' | BatchTemplateId;
  agentId?: string;
  agentModel?: string;
}

export interface BatchTaskSnapshot extends BatchTaskInput {
  id: string;
  status: BatchTaskStatus;
  progress: number;
  stage: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  outputPath?: string;
  logPath?: string;
  error?: string;
  storyboardSource?: BatchStoryboard['source'];
  storyboardWarning?: string;
}
