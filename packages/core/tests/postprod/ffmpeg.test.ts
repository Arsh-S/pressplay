import { describe, it, expect } from 'vitest';
import { buildMp4Command, buildGifPaletteCommand, buildGifCommand } from '../../src/postprod/ffmpeg.js';

describe('buildMp4Command', () => {
  it('builds correct ffmpeg args for mp4 conversion', () => {
    const args = buildMp4Command('input.webm', 'output.mp4');
    expect(args).toContain('-i');
    expect(args).toContain('input.webm');
    expect(args).toContain('output.mp4');
    expect(args).toContain('libx264');
  });
});

describe('buildGifPaletteCommand', () => {
  it('builds palette generation args', () => {
    const args = buildGifPaletteCommand('input.webm', 'palette.png', { maxWidth: 800, fps: 10 });
    expect(args).toContain('input.webm');
    expect(args).toContain('palette.png');
    expect(args.join(' ')).toContain('palettegen');
  });
});

describe('buildGifCommand', () => {
  it('builds two-pass gif args with palette', () => {
    const args = buildGifCommand('input.webm', 'output.gif', 'palette.png', { maxWidth: 800, fps: 10 });
    expect(args).toContain('input.webm');
    expect(args).toContain('output.gif');
    expect(args).toContain('palette.png');
    expect(args.join(' ')).toContain('paletteuse');
    expect(args.join(' ')).toContain('fps=10');
    expect(args.join(' ')).toContain('scale=800');
  });
});
