import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate request body
    const body = await req.json();
    const { videoId, title, artist, url, thumbnail, duration } = body;
    
    if (!videoId || !title || !artist || !url || !thumbnail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already liked
    const existingLike = await prisma.likedSong.findFirst({ 
      where: { 
        userId: user.id,
        videoId 
      }
    });

    // Handle like/unlike
    if (existingLike) {
      await prisma.likedSong.delete({ 
        where: { id: existingLike.id } 
      });
      return NextResponse.json({ 
        success: true,
        liked: false
      });
    } else {
      const newLike = await prisma.likedSong.create({
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
      
      return NextResponse.json({ 
        success: true,
        liked: true,
        song: newLike
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}