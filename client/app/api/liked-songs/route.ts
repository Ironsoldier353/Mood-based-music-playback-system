import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json([], { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        likedSongs: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const songs = user.likedSongs.map((song: {
      videoId: string;
      title: string;
      artist: string;
      url: string;
      thumbnail: string;
      duration?: string;
    }) => ({
      id: song.videoId,
      title: song.title,
      artist: song.artist,
      url: song.url,
      thumbnail: song.thumbnail,
      duration: song.duration || "0:00",
    }));

    return NextResponse.json(songs);
    
  } catch (error) {
    console.error('Error fetching liked songs:', error);
    return NextResponse.json(
      { error: "Failed to fetch liked songs" },
      { status: 500 }
    );
  }
}
