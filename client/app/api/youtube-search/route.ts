import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query =
    searchParams.get("query") || "hindi songs trending now in india";

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query
    )}`;
    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);
    const videos: VideoResult[] = [];

    $("ytd-video-renderer, ytd-rich-video-renderer").each((i, el) => {
      if (videos.length >= 15) return false;

      const $el = $(el);

      const videoId = $el
        .find("a#thumbnail")
        .attr("href")
        ?.split("v=")[1]
        ?.split("&")[0];
      if (!videoId) return;

      const title = $el.find("#video-title").text().trim();
      if (!title) return;

      const thumbnail =
        $el.find("img.yt-core-image").attr("src") ||
        $el.find("img.yt-img-shadow").attr("src") ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const metadata = $el
        .find("#metadata-line")
        .text()
        .trim()
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const views = metadata.length > 0 ? metadata[0] : "N/A";
      const published = metadata.length > 1 ? metadata[1] : "N/A";

      const duration =
        $el
          .find("span.ytd-thumbnail-overlay-time-status-renderer")
          .text()
          .trim() || "0:00";

      let artist = "Various Artists";
      const channelElement = $el.find("ytd-channel-name a.yt-simple-endpoint");
      if (channelElement.length) {
        artist = channelElement.text().trim();
      } else {
        const titleParts = title.split(" - ");
        if (titleParts.length > 1) {
          artist = titleParts.pop()?.trim() || artist;
        } else {
          const pipeParts = title.split("|");
          if (pipeParts.length > 1) {
            artist = pipeParts.pop()?.trim() || artist;
          }
        }
      }

      videos.push({
        id: videoId,
        title: title.split("|")[0].split("-")[0].trim(), // Clean up title
        artist,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail,
        duration,
        views,
        published,
      });
    });

    if (videos.length === 0) {
      const scriptData = data.match(/var ytInitialData = (.*?);<\/script>/);
      if (scriptData && scriptData[1]) {
        try {
          const jsonData = JSON.parse(scriptData[1]);
          const contents =
            jsonData.contents?.twoColumnSearchResultsRenderer?.primaryContents
              ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
              ?.contents || [];

          for (const item of contents) {
            if (videos.length >= 20) break;

            const videoRenderer = item.videoRenderer;
            if (!videoRenderer) continue;

            const videoId = videoRenderer.videoId;
            const title = videoRenderer.title?.runs?.[0]?.text || "Untitled";
            const thumbnail =
              videoRenderer.thumbnail?.thumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            const views = videoRenderer.viewCountText?.simpleText || "N/A";
            const published =
              videoRenderer.publishedTimeText?.simpleText || "N/A";
            const duration = videoRenderer.lengthText?.simpleText || "0:00";
            const artist =
              videoRenderer.ownerText?.runs?.[0]?.text || "Various Artists";

            videos.push({
              id: videoId,
              title,
              artist,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              thumbnail,
              duration,
              views,
              published,
            });
          }
        } catch (e) {
          console.error("JSON parse error:", e);
        }
      }
    }

    // Final fallback if still no videos
    if (videos.length === 0) {
      return NextResponse.json({
        videos: getFallbackVideos(),
      });
    }

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Scraping failed:", error);
    return NextResponse.json({
      videos: getFallbackVideos(),
    });
  }
}

function getFallbackVideos(): VideoResult[] {
  return [
    {
      id: "Pk5XZR4JhYQ",
      title: "Kesariya - Brahmāstra",
      artist: "Arijit Singh",
      url: "https://www.youtube.com/watch?v=Pk5XZR4JhYQ",
      thumbnail: "https://i.ytimg.com/vi/Pk5XZR4JhYQ/hqdefault.jpg",
      duration: "4:28",
      views: "450M views",
      published: "2 years ago",
    },
    {
      id: "yK3toXZKCwE",
      title: "Tum Hi Ho",
      artist: "Arijit Singh",
      url: "https://www.youtube.com/watch?v=yK3toXZKCwE",
      thumbnail: "https://i.ytimg.com/vi/yK3toXZKCwE/hqdefault.jpg",
      duration: "4:22",
      views: "1.2B views",
      published: "10 years ago",
    },
    {
      id: "JGwWNGJdvx8",
      title: "Shape of You",
      artist: "Ed Sheeran",
      url: "https://www.youtube.com/watch?v=JGwWNGJdvx8",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
      duration: "3:53",
      views: "5.8B views",
      published: "7 years ago",
    },
    {
      id: "RgKAFK5djSk",
      title: "See You Again",
      artist: "Wiz Khalifa ft. Charlie Puth",
      url: "https://www.youtube.com/watch?v=RgKAFK5djSk",
      thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg",
      duration: "3:58",
      views: "6.4B views",
      published: "9 years ago",
    },
    {
      id: "kJQP7kiw5Fk",
      title: "Despacito",
      artist: "Luis Fonsi ft. Daddy Yankee",
      url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
      thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
      duration: "4:41",
      views: "8.1B views",
      published: "7 years ago",
    },
  ];
}
