import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { repoSettings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ repoId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId } = await params;
  const body = await req.json();

  await db.insert(repoSettings).values({
    repoId,
    llmProvider: body.llmProvider || 'anthropic',
    llmApiKey: body.llmApiKey || null,
    previewUrlPattern: body.previewUrlPattern || null,
    configJson: body.configJson || null,
  }).onConflictDoUpdate({
    target: repoSettings.repoId,
    set: {
      llmProvider: body.llmProvider || 'anthropic',
      llmApiKey: body.llmApiKey || null,
      previewUrlPattern: body.previewUrlPattern || null,
      configJson: body.configJson || null,
    },
  });

  return NextResponse.json({ ok: true });
}
