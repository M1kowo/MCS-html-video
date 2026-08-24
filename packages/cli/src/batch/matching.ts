import { readdir } from 'node:fs/promises';
import { extname, join, dirname, basename, resolve } from 'node:path';
import type { MediaMatchResult, MediaPair } from './types.js';

export async function scanInputDirectory(inputDir: string): Promise<MediaMatchResult> {
  const files = await walk(resolve(inputDir));
  return matchMediaFiles(files);
}

export function matchMediaFiles(paths: string[]): MediaMatchResult {
  const srt = new Map<string, string>();
  const mp3 = new Map<string, string>();

  for (const rawPath of paths) {
    const path = resolve(rawPath);
    const rawExt = extname(path);
    const ext = rawExt.toLowerCase();
    if (ext !== '.srt' && ext !== '.mp3') continue;
    const stem = basename(path).slice(0, -rawExt.length);
    const key = join(dirname(path), stem).toLocaleLowerCase('zh-CN');
    const target = ext === '.srt' ? srt : mp3;
    if (!target.has(key)) target.set(key, path);
  }

  const pairs: MediaPair[] = [];
  const unmatchedSrt: string[] = [];
  const unmatchedMp3: string[] = [];
  for (const [key, srtPath] of srt) {
    const mp3Path = mp3.get(key);
    if (!mp3Path) {
      unmatchedSrt.push(srtPath);
      continue;
    }
    pairs.push({
      baseName: basename(srtPath).slice(0, -extname(srtPath).length),
      srtPath,
      mp3Path,
    });
  }
  for (const [key, mp3Path] of mp3) {
    if (!srt.has(key)) unmatchedMp3.push(mp3Path);
  }

  pairs.sort((a, b) => a.baseName.localeCompare(b.baseName, 'zh-CN'));
  unmatchedSrt.sort();
  unmatchedMp3.sort();
  return { pairs, unmatchedSrt, unmatchedMp3 };
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}
