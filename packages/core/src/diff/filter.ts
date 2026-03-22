import { minimatch } from 'minimatch';

export function filterFiles(
  files: string[],
  include: string[],
  exclude: string[],
): string[] {
  return files.filter((file) => {
    const included = include.some((pattern) => minimatch(file, pattern));
    const excluded = exclude.some((pattern) => minimatch(file, pattern));
    return included && !excluded;
  });
}
