import type { ContentGraph } from '@html-video/content-graph';
import {
  BATCH_ANIMATIONS,
  BATCH_LAYOUTS,
  BATCH_TEMPLATE_IDS,
  BATCH_THEMES,
  type BatchAnimation,
  type BatchLayout,
  type BatchStoryboard,
  type BatchTemplateId,
  type BatchTheme,
  type SceneDirection,
  type SubtitleCue,
} from './types.js';

interface AiStoryboardReply {
  synopsis?: string;
  scenes?: Array<{
    cueIndex?: number;
    templateId?: string;
    layout?: string;
    theme?: string;
    animation?: string;
    emphasis?: unknown;
  }>;
}

export function buildControlledStoryboardPrompt(cues: SubtitleCue[]): string {
  const compact = cues.map((cue) => ({
    cueIndex: cue.index,
    startMs: cue.startMs,
    endMs: cue.endMs,
    text: cue.text,
  }));
  return [
    'Analyze these subtitles and return a controlled visual storyboard as JSON only.',
    'This is a Simplified Chinese video workflow. Keep every subtitle exactly as provided; never translate, romanize, or replace Chinese text. Write synopsis in Simplified Chinese.',
    'You are NOT allowed to output HTML, CSS, JavaScript, image prompts, URLs, or new option names.',
    `templateId must be one of: ${BATCH_TEMPLATE_IDS.join(', ')}`,
    `layout must be one of: ${BATCH_LAYOUTS.join(', ')}`,
    `theme must be one of: ${BATCH_THEMES.join(', ')}`,
    `animation must be one of: ${BATCH_ANIMATIONS.join(', ')}`,
    'Return exactly one scene for every cueIndex. emphasis is optional and may contain at most 3 exact words/phrases copied from that cue.',
    'Schema: {"synopsis":"short summary","scenes":[{"cueIndex":1,"templateId":"frame-swiss-grid","layout":"center","theme":"dark","animation":"fade-up","emphasis":[]}]}',
    `Subtitles: ${JSON.stringify(compact)}`,
  ].join('\n');
}

export function storyboardFromAiReply(text: string, cues: SubtitleCue[]): BatchStoryboard {
  const raw = extractJson(text);
  const parsed = JSON.parse(raw) as AiStoryboardReply;
  const fallback = fallbackDirections(cues, 'frame-swiss-grid');
  const byCue = new Map<number, NonNullable<AiStoryboardReply['scenes']>[number]>();
  for (const scene of parsed.scenes ?? []) {
    if (typeof scene?.cueIndex === 'number') byCue.set(scene.cueIndex, scene);
  }

  const directions = cues.map((cue, position) => {
    const safe = fallback[position];
    if (!safe) throw new Error(`Missing fallback direction for cue ${cue.index}`);
    const scene = byCue.get(cue.index);
    if (!scene) return safe;
    return {
      cueIndex: cue.index,
      templateId: includes(BATCH_TEMPLATE_IDS, scene.templateId)
        ? scene.templateId
        : safe.templateId,
      layout: includes(BATCH_LAYOUTS, scene.layout) ? scene.layout : safe.layout,
      theme: includes(BATCH_THEMES, scene.theme) ? scene.theme : safe.theme,
      animation: includes(BATCH_ANIMATIONS, scene.animation) ? scene.animation : safe.animation,
      emphasis: sanitizeEmphasis(scene.emphasis, cue.text),
    };
  });

  return {
    graph: buildGraph(cues, directions, parsed.synopsis?.trim() || 'SRT 中文语义故事板'),
    directions,
    source: 'ai',
  };
}

export function createFallbackStoryboard(
  cues: SubtitleCue[],
  style: 'ai-auto' | BatchTemplateId,
  warning?: string,
): BatchStoryboard {
  const template = style === 'ai-auto' ? 'frame-swiss-grid' : style;
  const directions = fallbackDirections(cues, template);
  return {
    graph: buildGraph(cues, directions, '稳定的中文定时字幕故事板'),
    directions,
    source: style === 'ai-auto' ? 'fallback' : 'manual',
    ...(warning && { warning }),
  };
}

function buildGraph(
  cues: SubtitleCue[],
  directions: SceneDirection[],
  synopsis: string,
): ContentGraph {
  const visualByCue = new Map(directions.map((direction) => [direction.cueIndex, direction]));
  return {
    schemaVersion: 1,
    intent: 'explainer',
    synopsis,
    nodes: cues.map((cue) => {
      const direction = visualByCue.get(cue.index);
      if (!direction) throw new Error(`Missing visual direction for cue ${cue.index}`);
      return {
        id: cueId(cue.index),
        kind: 'text' as const,
        label: `#${cue.index}`,
        frameIntent: 'timed-subtitle',
        durationSec: (cue.endMs - cue.startMs) / 1000,
        timeline: { startMs: cue.startMs, endMs: cue.endMs },
        visual: {
          templateId: direction.templateId,
          layout: direction.layout,
          theme: direction.theme,
          animation: direction.animation,
        },
        text: cue.text,
      };
    }),
    edges: cues.slice(1).flatMap((cue, index) => {
      const previous = cues[index];
      return previous
        ? [
            {
              from: cueId(previous.index),
              to: cueId(cue.index),
              kind: 'sequence' as const,
              reason: 'SRT 时间轴顺序',
            },
          ]
        : [];
    }),
  };
}

function fallbackDirections(cues: SubtitleCue[], templateId: BatchTemplateId): SceneDirection[] {
  const preset = presetForTemplate(templateId);
  return cues.map((cue) => ({ cueIndex: cue.index, templateId, ...preset }));
}

function presetForTemplate(templateId: BatchTemplateId): {
  layout: BatchLayout;
  theme: BatchTheme;
  animation: BatchAnimation;
} {
  switch (templateId) {
    case 'frame-kinetic-type':
      return { layout: 'center', theme: 'electric', animation: 'scale-in' };
    case 'frame-warm-grain':
      return { layout: 'split-left', theme: 'warm', animation: 'fade-up' };
    case 'frame-light-leak-cinema':
      return { layout: 'lower-third', theme: 'cinema', animation: 'wipe' };
    case 'frame-bold-signal':
      return { layout: 'split-right', theme: 'dark', animation: 'scale-in' };
    default:
      return { layout: 'center', theme: 'light', animation: 'fade-up' };
  }
}

function sanitizeEmphasis(value: unknown, cueText: string): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 24 && cueText.includes(item))
    .slice(0, 3);
}

function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI reply did not contain a JSON object');
  return candidate.slice(start, end + 1);
}

function includes<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function cueId(index: number): string {
  return `cue_${String(index).padStart(4, '0')}`;
}
