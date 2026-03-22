import type { DiffAnalysis, ChangedFile } from '../types.js';
import { filterFiles } from './filter.js';
import { mapFilesToRoutes } from './route-mapper.js';
import { truncateDiff } from './truncator.js';

interface DiffConfig {
  include: string[];
  exclude: string[];
  maxTokens: number;
}

interface ParsedFileDiff {
  path: string;
  diff: string;
}

function parseDiffFiles(rawDiff: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const fileDiffs = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const section of fileDiffs) {
    const headerMatch = section.match(/^a\/(.+?) b\/(.+)/m);
    if (!headerMatch) continue;
    const path = headerMatch[2];
    files.push({ path, diff: section });
  }

  return files;
}

function categorizeFile(path: string): ChangedFile['category'] {
  const lower = path.toLowerCase();
  if (/\/(pages|app|routes)\//.test(lower)) return 'route';
  if (/\/(layouts?|layout)\b/.test(lower)) return 'layout';
  if (/\.(css|scss|sass|less)$/.test(lower)) return 'style';
  if (/\/(components?|ui)\//.test(lower)) return 'component';
  return 'other';
}

function detectChangeType(diff: string): ChangedFile['changeType'] {
  if (diff.includes('new file mode')) return 'added';
  if (diff.includes('deleted file mode')) return 'deleted';
  return 'modified';
}

export function analyzeDiff(
  rawDiff: string,
  config: DiffConfig,
  routeMap: Record<string, string>,
): DiffAnalysis {
  const parsedFiles = parseDiffFiles(rawDiff);
  const allPaths = parsedFiles.map((f) => f.path);
  const frontendPaths = filterFiles(allPaths, config.include, config.exclude);

  const changedFiles: ChangedFile[] = parsedFiles
    .filter((f) => frontendPaths.includes(f.path))
    .map((f) => {
      const { text } = truncateDiff(f.diff, Math.floor(config.maxTokens / frontendPaths.length));
      return {
        path: f.path,
        changeType: detectChangeType(f.diff),
        category: categorizeFile(f.path),
        diff: text,
      };
    });

  const affectedRoutes = mapFilesToRoutes(frontendPaths, routeMap);

  const summary = [
    `${changedFiles.length} frontend file(s) changed.`,
    changedFiles.map((f) => `- ${f.changeType} ${f.path} (${f.category})`).join('\n'),
    affectedRoutes.length > 0
      ? `Affected routes: ${affectedRoutes.join(', ')}`
      : 'No mapped routes affected.',
  ].join('\n');

  return { changedFiles, affectedRoutes, summary };
}
