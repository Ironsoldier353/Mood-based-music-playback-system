import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json([], { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        playlists: {
          include: {
            songs: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(user.playlists);
  } catch (error) {
    console.error("Error fetching playlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth(); // Rename for clarity

    if (!clerkId) {
      return NextResponse.json([], { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "Playlist name is required" },
        { status: 400 }
      );
    }

    const playlist = await prisma.playlist.create({
      data: {
        name,
        description,
        userId: user.id, // Use internal ID
      },
    });

    return NextResponse.json(playlist, { status: 201 });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
