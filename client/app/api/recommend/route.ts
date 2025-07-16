import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { HistoryService } from "@/lib/history";
import { google , youtube_v3 } from "googleapis";

const youtube = google.youtube("v3");

interface Song {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  duration?: string;
}

interface RecommendationResult {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string;
  duration: string;
  views: string;
  published: string;
  source: "recommended" | "history" | "liked";
}

function convertISO8601Duration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(match?.[1] || "0");
  const minutes = parseInt(match?.[2] || "0");
  const seconds = parseInt(match?.[3] || "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatNumber(n: string): string {
  return parseInt(n).toLocaleString("en-US");
}

async function getUserSongs(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        likedSongs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const history = await HistoryService.getHistory(userId);

    const likedSongs = user?.likedSongs.map((song) => ({
      videoId: song.videoId,
      title: song.title,
      artist: song.artist,
      source: "liked" as const,
    })) || [];

    const historySongs = history.map((song) => ({
      videoId: song.videoId,
      title: song.title,
      artist: song.artist,
      source: "history" as const,
    }));

    const uniqueHistory = historySongs.filter(
      (histSong) => !likedSongs.some((likedSong) => likedSong.videoId === histSong.videoId)
    );

    return {
      liked: likedSongs,
      history: uniqueHistory,
      all: [...likedSongs, ...uniqueHistory],
    };
  } catch (error) {
    console.error("Error fetching user songs:", error);
    return { liked: [], history: [], all: [] };
  }
}

async function generateRecommendations(
  songs: Song[],
  count: number = 15
): Promise<{ title: string; artist: string }[]> {
  const topSongs = songs.slice(0, 20);

  const prompt = `Based on the following songs that a user has liked or listened to recently:\n\n${topSongs
    .map((song) => `- "${song.title}" by ${song.artist}`)
    .join("\n")}\n\nPlease recommend ${count} new songs that this user might enjoy. Consider the music style, genre, artists, and mood. Return only the song titles and artists in this exact format:\n\n1. "Song Title" by Artist Name\n...\n\nDo not include any explanations or additional text.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const lines: string[] = text.split("\n").filter((line: string) => line.trim());

    return lines
      .map((line: string) => {
        const match = line.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
        if (match) {
          return { title: match[1].trim(), artist: match[2].trim() };
        }
        return null;
      })
      .filter((rec): rec is { title: string; artist: string } => rec !== null);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return [];
  }
}

async function searchMultipleSongs(
  queries: string[],
  batchSize: number = 10
): Promise<(RecommendationResult & { query: string })[]> {
  const results: { query: string; videoId: string; snippet: youtube_v3.Schema$SearchResultSnippet  }[] = [];
  const allVideoIds: string[] = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);

    try {
      const searchResponses = await Promise.all(
        batch.map(async (query) => {
          const searchResponse = await youtube.search.list({
            key: process.env.YOUTUBE_API_KEY!,
            q: query,
            maxResults: 3,
            type: ["video"],
            part: ["snippet"],
            videoCategoryId: "10",
          });

          return {
            query,
            results: searchResponse.data.items || [],
          };
        })
      );

      for (const queryResult of searchResponses) {
        const bestMatch = queryResult.results[0];
        if (bestMatch?.id?.videoId) {
          allVideoIds.push(bestMatch.id.videoId);
          results.push({
            query: queryResult.query,
            videoId: bestMatch.id.videoId,
            snippet: bestMatch.snippet as youtube_v3.Schema$SearchResultSnippet,
          });
        }
      }

      if (i + batchSize < queries.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error searching batch ${i}-${i + batchSize}:`, error);
    }
  }

  if (allVideoIds.length === 0) return [];

  try {
    const videoDetailsResponses = await Promise.all(
      Array.from({ length: Math.ceil(allVideoIds.length / 50) }, (_, i) =>
        youtube.videos.list({
          key: process.env.YOUTUBE_API_KEY!,
          id: allVideoIds.slice(i * 50, i * 50 + 50),
          part: ["snippet", "statistics", "contentDetails"],
        })
      )
    );

    const allVideoDetails = videoDetailsResponses.flatMap((res) => res.data.items || []);

    return results
      .map((result) => {
        const video = allVideoDetails.find((v) => v.id === result.videoId);
        if (!video) return null;

        return {
          query: result.query,
          id: video.id!,
          title: video.snippet?.title?.split("|")[0].split("-")[0].trim() || "Untitled",
          artist: video.snippet?.channelTitle || "Various Artists",
          url: `https://www.youtube.com/watch?v=${video.id}`,
          thumbnail: video.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
          duration: convertISO8601Duration(video.contentDetails?.duration || "PT0M0S"),
          views: formatNumber(video.statistics?.viewCount || "0") + " views",
          published: new Date(video.snippet?.publishedAt || "").toDateString(),
        };
      })
      .filter((res): res is RecommendationResult & { query: string } => !!res);
  } catch (error) {
    console.error("Error getting video details:", error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("includeHistory") !== "false";
    const includeLiked = searchParams.get("includeLiked") !== "false";

    const userSongs = await getUserSongs(userId);
    if (userSongs.all.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: "No listening history found. Start listening to some songs to get personalized recommendations!",
      });
    }

    const aiRecommendations = await generateRecommendations(userSongs.all, 15);

    const finalSongs: { query: string; source: RecommendationResult["source"] }[] = [];

    aiRecommendations.forEach((rec: { title: string; artist: string }) => {
      finalSongs.push({
        query: `${rec.title} ${rec.artist} official audio`,
        source: "recommended",
      });
    });

    if (includeLiked && userSongs.liked.length > 0) {
      userSongs.liked.slice(0, 8).forEach((song) => {
        finalSongs.push({
          query: `${song.title} ${song.artist} official audio`,
          source: "liked",
        });
      });
    }

    if (includeHistory && userSongs.history.length > 0) {
      userSongs.history.slice(0, 7).forEach((song) => {
        finalSongs.push({
          query: `${song.title} ${song.artist} official audio`,
          source: "history",
        });
      });
    }

    const searchResults = await searchMultipleSongs(finalSongs.map((s) => s.query), 5);

    const finalResults: RecommendationResult[] = [];
    const usedIds = new Set<string>();

    for (const result of searchResults) {
      if (!result?.id || usedIds.has(result.id)) continue;
      const sourceInfo = finalSongs.find((s) => s.query === result.query);
      if (sourceInfo) {
        finalResults.push({ ...result, source: sourceInfo.source });
        usedIds.add(result.id);
      }
    }

    return NextResponse.json({
      recommendations: finalResults,
      basedOn: userSongs.all.slice(0, 10).map((s) => ({
        title: s.title,
        artist: s.artist,
        source: s.source,
      })),
      summary: {
        total: finalResults.length,
        breakdown: {
          recommended: finalResults.filter((r) => r.source === "recommended").length,
          liked: finalResults.filter((r) => r.source === "liked").length,
          history: finalResults.filter((r) => r.source === "history").length,
        },
        apiCallsUsed: Math.ceil(finalSongs.length / 5) + Math.ceil(finalResults.length / 50),
      },
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
