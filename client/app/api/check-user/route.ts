import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clerkId = searchParams.get("clerkId");

  if (!clerkId) {
    return NextResponse.json({ error: "Missing Clerk ID" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  const onboarded = !!(user?.fullName && user?.dob);

  return NextResponse.json({ onboarded });
}
