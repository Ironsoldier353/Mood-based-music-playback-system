import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string; songId: string } }
) {
  const { userId: clerkId } = await auth();
  const { id, songId } = await Promise.resolve(context.params);

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id, userId: user.id },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    await prisma.playlistSong.delete({
      where: { id: songId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from playlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from playlist" },
      { status: 500 }
    );
  }
}
