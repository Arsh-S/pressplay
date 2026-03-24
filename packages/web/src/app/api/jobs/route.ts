import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repoId');

  const rows = repoId
    ? await db.select().from(jobs).where(eq(jobs.repoId, repoId)).orderBy(desc(jobs.createdAt)).limit(50)
    : await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(50);

  return NextResponse.json(rows);
}
