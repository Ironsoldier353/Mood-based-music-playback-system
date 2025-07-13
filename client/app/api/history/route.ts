import { HistoryService } from '@/lib/history';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const songData = await req.json();
    
    // Validate required fields
    if (!songData.videoId || !songData.title) {
      return NextResponse.json(
        { error: 'Missing required fields (videoId, title)' },
        { status: 400 }
      );
    }

    // Add to history
    await HistoryService.addToHistory(clerkId, {
      videoId: songData.videoId,
      title: songData.title,
      artist: songData.artist || 'Unknown Artist',
      thumbnail: songData.thumbnail || '',
      duration: songData.duration ? parseInt(songData.duration) : 0
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to add to history:', error);
    return NextResponse.json(
      { error: 'Failed to add to history' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const history = await HistoryService.getHistory(clerkId);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    await HistoryService.clearHistory(clerkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear history:', error);
    return NextResponse.json(
      { error: 'Failed to clear history' },
      { status: 500 }
    );
  }
}