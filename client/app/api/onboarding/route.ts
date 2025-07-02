import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { clerkId, fullName, dob } = await req.json();

  if (!clerkId || !fullName || !dob) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { clerkId } });

    if (!existing) {
      await prisma.user.create({
        data: {
          clerkId,
          fullName,
          dob: new Date(dob),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
  }
}
