import { google } from "googleapis";
import { NextResponse } from "next/server";

const youtube = google.youtube("v3");

export const dynamic = "force-dynamic";

interface VideoResult {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string;
  duration: string;
  views: string;
  published: string;
}

function convertISO8601Duration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(match?.[1] || "0");
  const minutes = parseInt(match?.[2] || "0");
  const seconds = parseInt(match?.[3] || "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatNumber(n: string) {
  return parseInt(n).toLocaleString("en-US");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "hindi songs trending now in india";

  try {
    // Search videos by query
    const searchResponse = await youtube.search.list({
      key: process.env.YOUTUBE_API_KEY!,
      q: query,
      maxResults: 15,
      type: ["video"],
      part: ["snippet"],
    });

    const videoIds = (searchResponse.data.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds.length) {
      return NextResponse.json({ videos: [] });
    }

    // Get details for those videos
    const videosResponse = await youtube.videos.list({
      key: process.env.YOUTUBE_API_KEY!,
      id: videoIds,
      part: ["snippet", "statistics", "contentDetails"],
    });

    const videos: VideoResult[] = (videosResponse.data.items || []).map(
      (video) => ({
        id: video.id!,
        title: video.snippet?.title?.split("|")[0].split("-")[0].trim() || "Untitled",
        artist: video.snippet?.channelTitle || "Various Artists",
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnail:
          video.snippet?.thumbnails?.high?.url ||
          `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        duration: convertISO8601Duration(video.contentDetails?.duration || "PT0M0S"),
        views: formatNumber(video.statistics?.viewCount || "0") + " views",
        published: new Date(video.snippet?.publishedAt || "").toDateString(),
      })
    );

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("YouTube API error:", error);
    return NextResponse.json({ videos: getFallbackVideos() });
  }
}

function getFallbackVideos(): VideoResult[] {
  return [
    {
      id: "BddP6PYo2gs",
      title: "Kesariya - Brahmāstra",
      artist: "Arijit Singh",
      url: "https://www.youtube.com/watch?v=BddP6PYo2gs",
      thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg",
      duration: "4:28",
      views: "450M views",
      published: "2 years ago",
    }
  ];
}
