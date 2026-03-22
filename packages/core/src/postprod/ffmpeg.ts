import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PostProdResult } from '../types.js';

const execFileAsync = promisify(execFile);

export function buildMp4Command(input: string, output: string): string[] {
  return [
    '-i', input,
    '-vcodec', 'libx264',
    '-crf', '23',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-y',
    output,
  ];
}

export interface GifOptions {
  maxWidth: number;
  fps: number;
}

export function buildGifPaletteCommand(input: string, palettePath: string, opts: GifOptions): string[] {
  return [
    '-i', input,
    '-vf', `fps=${opts.fps},scale=${opts.maxWidth}:-1:flags=lanczos,palettegen`,
    '-y',
    palettePath,
  ];
}

export function buildGifCommand(input: string, output: string, palettePath: string, opts: GifOptions): string[] {
  return [
    '-i', input,
    '-i', palettePath,
    '-lavfi', `fps=${opts.fps},scale=${opts.maxWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    '-y',
    output,
  ];
}

export async function convertVideo(
  inputPath: string,
  options: {
    mp4: boolean;
    gif: boolean;
    gifMaxWidth: number;
    gifFps: number;
  },
): Promise<PostProdResult> {
  const result: PostProdResult = {};

  if (options.mp4) {
    const mp4Path = inputPath.replace(/\.webm$/, '.mp4');
    const args = buildMp4Command(inputPath, mp4Path);
    await execFileAsync('ffmpeg', args);
    result.mp4Path = mp4Path;
  }

  if (options.gif) {
    const gifPath = inputPath.replace(/\.webm$/, '.gif');
    const palettePath = inputPath.replace(/\.webm$/, '-palette.png');
    const gifOpts = { maxWidth: options.gifMaxWidth, fps: options.gifFps };

    const paletteArgs = buildGifPaletteCommand(inputPath, palettePath, gifOpts);
    await execFileAsync('ffmpeg', paletteArgs);

    const gifArgs = buildGifCommand(inputPath, gifPath, palettePath, gifOpts);
    await execFileAsync('ffmpeg', gifArgs);
    result.gifPath = gifPath;
  }

  return result;
}
