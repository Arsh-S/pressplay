export interface TruncationResult {
  text: string;
  truncated: boolean;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateDiff(diff: string, maxTokens: number): TruncationResult {
  const tokens = estimateTokens(diff);

  if (tokens <= maxTokens) {
    return { text: diff, truncated: false };
  }

  const maxChars = maxTokens * 4;
  const truncated = diff.slice(0, maxChars);

  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = lastNewline > 0 ? lastNewline : maxChars;

  return {
    text: truncated.slice(0, cutPoint) + '\n\n[truncated — diff exceeded token budget]',
    truncated: true,
  };
}
