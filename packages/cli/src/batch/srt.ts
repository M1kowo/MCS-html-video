import type { SubtitleCue } from './types.js';

/** Decode UTF-8 (with or without BOM), falling back to GB18030 for common
 * legacy Chinese subtitle files. */
export function decodeSrt(input: Buffer | string): string {
  if (typeof input === 'string') return stripBom(input);
  try {
    return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(input));
  } catch {
    return stripBom(new TextDecoder('gb18030').decode(input));
  }
}

export function parseSrt(input: Buffer | string): SubtitleCue[] {
  const text = decodeSrt(input).replace(/\r\n?/g, '\n').trim();
  if (!text) return [];

  const cues: SubtitleCue[] = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const indexText = lines.shift()?.trim() ?? '';
    const timing = lines.shift()?.trim() ?? '';
    if (!/^\d+$/.test(indexText)) {
      throw new Error(`Invalid SRT cue number: "${indexText || '(empty)'}"`);
    }
    const match =
      /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})(?:\s+.*)?$/.exec(
        timing,
      );
    if (!match?.[1] || !match[2]) {
      throw new Error(`Invalid SRT timing for cue ${indexText}: "${timing}"`);
    }
    const startMs = parseSrtTimecode(match[1]);
    const endMs = parseSrtTimecode(match[2]);
    if (endMs <= startMs) {
      throw new Error(`SRT cue ${indexText} ends before it starts`);
    }
    const cueText = lines.join('\n').trim();
    cues.push({
      index: Number(indexText),
      startMs,
      endMs,
      text: cueText,
    });
  }

  cues.sort((a, b) => a.startMs - b.startMs || a.index - b.index);
  return cues;
}

export function parseSrtTimecode(value: string): number {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid SRT timecode: "${value}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number((match[4] ?? '0').padEnd(3, '0'));
  if (minutes > 59 || seconds > 59) throw new Error(`Invalid SRT timecode: "${value}"`);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}
