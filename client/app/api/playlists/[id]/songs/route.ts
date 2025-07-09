import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { userId: clerkId } = await auth();

  const { id } = await Promise.resolve(context.params);

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

    const { videoId, title, artist, url, thumbnail, duration } =
      await request.json();

    const existingSong = await prisma.playlistSong.findFirst({
      where: { playlistId: id, videoId },
    });

    if (existingSong) {
      return NextResponse.json(
        { error: "Song already exists in playlist" },
        { status: 400 }
      );
    }

    const lastSong = await prisma.playlistSong.findFirst({
      where: { playlistId: id },
      orderBy: { order: "desc" },
    });

    const newOrder = lastSong ? (lastSong.order || 0) + 1 : 0;

    const song = await prisma.playlistSong.create({
      data: {
        playlistId: id,
        videoId,
        title,
        artist,
        url,
        thumbnail,
        duration,
        order: newOrder,
      },
    });

    return NextResponse.json(song, { status: 201 });
  } catch (error) {
    console.error("Error adding to playlist:", error);
    return NextResponse.json(
      { error: "Failed to add to playlist" },
      { status: 500 }
    );
  }
}
