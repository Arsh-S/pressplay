import { NextRequest, NextResponse } from 'next/server';
import { runWorkerOnce } from '@/lib/worker';

export async function POST(req: NextRequest) {
  // Simple auth — check for a bearer token
  const authHeader = req.headers.get('authorization');
  const workerSecret = process.env.WORKER_SECRET;

  if (workerSecret && authHeader !== `Bearer ${workerSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const processed = await runWorkerOnce();
  return NextResponse.json({ processed });
}
