
// app/api/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { videoId, title, artist, url, thumbnail, duration } = body;
    
    if (!videoId || !title || !artist || !url || !thumbnail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          fullName: "New User",
        }
      });
    }

    const existingLike = await prisma.likedSong.findFirst({ 
      where: { 
        userId: user.id,
        videoId 
      } 
    });

    if (existingLike) {
      await prisma.likedSong.delete({ where: { id: existingLike.id } });
      return NextResponse.json({ liked: false, action: "removed" });
    } else {
      await prisma.likedSong.create({
        data: { 
          userId: user.id, 
          videoId, 
          title, 
          artist, 
          url, 
          thumbnail,
          duration: duration || "0:00"
        }
      });
      return NextResponse.json({ liked: true, action: "added" });
    }

  } catch (error) {
    console.error('Error in like route:', error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}