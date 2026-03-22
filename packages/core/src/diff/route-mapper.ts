import { minimatch } from 'minimatch';

export function mapFilesToRoutes(
  files: string[],
  routeMap: Record<string, string>,
): string[] {
  const routes = new Set<string>();

  for (const file of files) {
    for (const [pattern, route] of Object.entries(routeMap)) {
      if (file === pattern || minimatch(file, pattern)) {
        routes.add(route);
      }
    }
  }

  return [...routes];
}
