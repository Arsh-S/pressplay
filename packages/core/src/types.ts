/** Diff analysis output */
export interface DiffAnalysis {
  changedFiles: ChangedFile[];
  affectedRoutes: string[];
  summary: string;
}

export interface ChangedFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted';
  category: 'route' | 'component' | 'style' | 'layout' | 'other';
  diff: string;
}

/** Playwright step types */
export type StepAction =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'waitForSelector'
  | 'screenshot'
  | 'press';

export interface Step {
  action: StepAction;
  url?: string;
  selector?: string;
  value?: string;
  y?: number;
  ms?: number;
  key?: string;
  name?: string;
  note?: string;
}

/** Recording result */
export interface RecordingResult {
  videoPath: string;
  screenshots: string[];
  steps: Step[];
  durationMs: number;
}

/** Post-production output */
export interface PostProdResult {
  mp4Path?: string;
  gifPath?: string;
}

/** Pipeline result */
export interface PipelineResult {
  success: boolean;
  diff: DiffAnalysis;
  steps: Step[];
  recording?: RecordingResult;
  postProd?: PostProdResult;
  commentUrl?: string;
  error?: string;
  fallback?: 'simplified-script' | 'screenshots-only';
}
