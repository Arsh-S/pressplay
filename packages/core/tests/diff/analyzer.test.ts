import { describe, it, expect } from 'vitest';
import { analyzeDiff } from '../../src/diff/analyzer.js';

const sampleDiff = `diff --git a/src/pages/dashboard.tsx b/src/pages/dashboard.tsx
index abc1234..def5678 100644
--- a/src/pages/dashboard.tsx
+++ b/src/pages/dashboard.tsx
@@ -10,6 +10,12 @@ export default function Dashboard() {
   return (
     <div>
+      <h1>Welcome back</h1>
+      <button onClick={handleCreate}>Create Project</button>
     </div>
   );
 }
diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 111..222 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,3 +1,4 @@
+import { Logo } from './Logo';
 export function Header() {
   return <header>Header</header>;
 }`;

describe('analyzeDiff', () => {
  const config = {
    include: ['src/**/*.{tsx,jsx}'],
    exclude: ['**/*.test.*'],
    maxTokens: 8000,
  };
  const routeMap = {
    'src/pages/dashboard.tsx': '/dashboard',
    'src/components/Header.tsx': '/',
  };

  it('extracts changed files from diff', () => {
    const result = analyzeDiff(sampleDiff, config, routeMap);
    expect(result.changedFiles).toHaveLength(2);
    expect(result.changedFiles[0].path).toBe('src/pages/dashboard.tsx');
    expect(result.changedFiles[1].path).toBe('src/components/Header.tsx');
  });

  it('categorizes page files as route changes', () => {
    const result = analyzeDiff(sampleDiff, config, routeMap);
    const dashboard = result.changedFiles.find(f => f.path.includes('dashboard'));
    expect(dashboard?.category).toBe('route');
  });

  it('categorizes component files as component changes', () => {
    const result = analyzeDiff(sampleDiff, config, routeMap);
    const header = result.changedFiles.find(f => f.path.includes('Header'));
    expect(header?.category).toBe('component');
  });

  it('resolves affected routes via routeMap', () => {
    const result = analyzeDiff(sampleDiff, config, routeMap);
    expect(result.affectedRoutes).toContain('/dashboard');
    expect(result.affectedRoutes).toContain('/');
  });

  it('generates a human-readable summary', () => {
    const result = analyzeDiff(sampleDiff, config, routeMap);
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe('string');
  });

  it('filters out non-frontend files', () => {
    const diffWithBackend = sampleDiff + `
diff --git a/server/api.go b/server/api.go
--- a/server/api.go
+++ b/server/api.go
@@ -1 +1,2 @@
+func handler() {}`;
    const result = analyzeDiff(diffWithBackend, config, routeMap);
    expect(result.changedFiles.every(f => !f.path.includes('server/'))).toBe(true);
  });
});
