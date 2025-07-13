import { prisma } from './prisma';

export class HistoryService {
  static async addToHistory(clerkId: string, songData: {
    videoId: string;
    title: string;
    artist: string;
    thumbnail?: string;
    duration?: number;
  }) {
    return await prisma.$transaction(async (tx) => {
      // 1. Ensure user exists
      const user = await tx.user.upsert({
        where: { clerkId },
        create: {
          clerkId,
          fullName: '',
          // Add other default user fields if needed
        },
        update: {}
      });

      // 2. Add new history item
      await tx.historyItem.create({
        data: {
          userId: user.id,
          videoId: songData.videoId,
          title: songData.title,
          artist: songData.artist,
          thumbnail: songData.thumbnail,
          duration: songData.duration,
        }
      });

      // 3. Maintain history queue size (20 items)
      const count = await tx.historyItem.count({
        where: { userId: user.id }
      });

      if (count > 20) {
        const oldestItems = await tx.historyItem.findMany({
          where: { userId: user.id },
          orderBy: { playedAt: 'asc' },
          take: count - 20,
          select: { id: true }
        });

        await tx.historyItem.deleteMany({
          where: { 
            id: { in: oldestItems.map(item => item.id) }
          }
        });
      }
    });
  }

  static async getHistory(clerkId: string) {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true }
    });

    if (!user) return [];

    return await prisma.historyItem.findMany({
      where: { userId: user.id },
      orderBy: { playedAt: 'desc' },
      take: 20, // Only return the most recent 20 items
      select: {
        videoId: true,
        title: true,
        artist: true,
        thumbnail: true,
        duration: true,
        playedAt: true
      }
    });
  }

  static async clearHistory(clerkId: string) {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true }
    });

    if (!user) return;

    await prisma.historyItem.deleteMany({
      where: { userId: user.id }
    });
  }
}