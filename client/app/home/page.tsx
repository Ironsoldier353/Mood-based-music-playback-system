"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  Globe,
  Smile,
  ArrowRight,
} from "lucide-react";
import ReactPlayer from "react-player/youtube";
import Image from "next/image";
type VideoResult = {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string;
  duration: string;
  views: string;
  published: string;
};

type Language = "hindi" | "english" | "bengali" | "punjabi" | "tamil";
type ContentType = "trending" | "new-releases" | "top-hits";

import { useAuth } from "@clerk/nextjs"; // Add this import

export default function MusicApp() {
  const { userId } = useAuth();
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("hindi");
  const [contentType, setContentType] = useState<ContentType>("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const playerRef = useRef<ReactPlayer>(null);
  const languages = [
    { id: "hindi", name: "Hindi", flag: "🇮🇳" },
    { id: "english", name: "English", flag: "🇺🇸" },
    { id: "bengali", name: "Bengali", flag: "🇧🇩" },
    { id: "punjabi", name: "Punjabi", flag: "🇮🇳" },
    { id: "tamil", name: "Tamil", flag: "🇮🇳" },
  ];

  const contentTypes = [
    { id: "trending", name: "Trending Now" },
    { id: "new-releases", name: "New Releases" },
    { id: "top-hits", name: "Top Hits" },
  ];

  const generateSearchQuery = useCallback(() => {
    const languageMap = {
      hindi: "hindi songs",
      english: "english songs",
      bengali: "bengali songs",
      punjabi: "punjabi songs",
      tamil: "tamil songs",
    };

    const typeMap = {
      trending: "trending now",
      "new-releases": "new releases",
      "top-hits": "top hits",
    };

    return `${languageMap[selectedLanguage]} ${typeMap[contentType]}`;
  }, [selectedLanguage, contentType]);

  const fetchVideos = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/youtube-search?query=${encodeURIComponent(
          query
        )}&t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const { videos } = await res.json();
      if (!videos || videos.length === 0) {
        throw new Error("No videos found");
      }
      setVideos(videos);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load videos");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      const query = generateSearchQuery();
      fetchVideos(query);
    }
  }, [selectedLanguage, contentType, searchQuery, generateSearchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchVideos(searchQuery);
    }
  };

  const playVideo = (video: VideoResult) => {
    setCurrentVideo(video);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleProgress = (state: {
    played: number;
    playedSeconds: number;
    loaded: number;
    loadedSeconds: number;
  }) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayed(parseFloat(e.target.value));
  };

  const handleSeekMouseDown = () => {
    setSeeking(true);
  };

  const handleSeekMouseUp = () => {
    setSeeking(false);
    playerRef.current?.seekTo(played);
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, "0");

    if (hh) {
      return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const playNext = () => {
    if (!currentVideo || videos.length === 0) return;

    const currentIndex = videos.findIndex((v) => v.id === currentVideo.id);
    const nextIndex = (currentIndex + 1) % videos.length;
    setCurrentVideo(videos[nextIndex]);
    setIsPlaying(true);
  };

  const playPrevious = () => {
    if (!currentVideo || videos.length === 0) return;

    const currentIndex = videos.findIndex((v) => v.id === currentVideo.id);
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
    setCurrentVideo(videos[prevIndex]);
    setIsPlaying(true);
  };

  if (!userId) return <div>Unauthorized</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-pink-600 p-2 rounded-lg">
              <Play className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">MusicStream</h1>
          </div>

          <form onSubmit={handleSearch} className="flex-1 w-full md:max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, artists..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm md:text-base"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-white/10">
              <Heart className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-white/10">
              <ListMusic className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mood Recommendation Banner */}
      <div className="container mx-auto px-4 py-4">
        <div
          className="bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl p-4 mb-6 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => router.push("/mood")}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Smile className="h-8 w-8 text-yellow-300" />
              <div>
                <h3 className="font-semibold text-lg">
                  Switch to mood-based recommendations?
                </h3>
                <p className="text-sm text-white/80">
                  Discover music that matches your current vibe
                </p>
              </div>
            </div>
            <div className="bg-white text-purple-600 hover:bg-gray-100 px-6 py-2 rounded-full font-medium transition-colors flex items-center space-x-2 whitespace-nowrap">
              <span>Click Here</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Language Selector */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Globe className="mr-2" /> Select Language
          </h2>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setSelectedLanguage(lang.id as Language)}
                className={`flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-full transition-all text-sm ${
                  selectedLanguage === lang.id
                    ? "bg-pink-600 text-white"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <span className="mr-2">{lang.flag}</span>
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Type Selector */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Browse</h2>
          <div className="flex flex-wrap gap-2">
            {contentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setContentType(type.id as ContentType)}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full transition-all text-sm ${
                  contentType === type.id
                    ? "bg-pink-600 text-white"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>

        {/* Video Results */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {searchQuery
              ? `Results for "${searchQuery}"`
              : `${contentTypes.find((t) => t.id === contentType)?.name} in ${
                  languages.find((l) => l.id === selectedLanguage)?.name
                }`}
          </h2>

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
              <p className="text-red-200">{error}</p>
              <button
                onClick={() =>
                  fetchVideos(searchQuery || generateSearchQuery())
                }
                className="mt-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white/10 rounded-lg overflow-hidden animate-pulse"
                >
                  <div className="aspect-square bg-white/20 w-full"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-white/20 rounded w-3/4"></div>
                    <div className="h-3 bg-white/20 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all cursor-pointer group"
                  onClick={() => playVideo(video)}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      fill
                      className="object-cover"
                      loading="lazy"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {video.duration}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2">
                      {video.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                      {video.artist}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {video.views} • {video.published}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg">No results found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full text-sm"
                >
                  Show Trending
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Player */}
      {currentVideo && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-900 to-indigo-900 border-t border-white/10 z-50">
          <div className="container mx-auto px-4 py-3">
            {/* Progress bar */}
            <div className="w-full mb-2 flex items-center gap-2 text-xs text-gray-300">
              <span className="w-10">{formatTime(played * duration)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step="any"
                value={played}
                onChange={handleSeekChange}
                onMouseDown={handleSeekMouseDown}
                onMouseUp={handleSeekMouseUp}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500"
              />
              <span className="w-10">{formatTime(duration)}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Song Info */}
              <div className="flex items-center flex-1 min-w-0">
                <div className="relative h-12 w-12 rounded-md mr-3 flex-shrink-0">
                  <Image
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    fill
                    className="object-cover rounded-md"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm line-clamp-1">
                    {currentVideo.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {currentVideo.artist}
                  </p>
                </div>
                <button className="ml-2 text-pink-400 hover:text-pink-300 flex-shrink-0">
                  <Heart className="h-4 w-4" />
                </button>
              </div>

              {/* Player Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={playPrevious}
                  className="text-gray-300 hover:text-white p-1"
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="bg-white text-black p-2 rounded-full hover:bg-gray-200 flex items-center justify-center"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={playNext}
                  className="text-gray-300 hover:text-white p-1"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>

              {/* Volume Controls */}
              <div className="hidden sm:flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-gray-300 hover:text-white"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={changeVolume}
                  className="w-20 accent-pink-500"
                />
              </div>
            </div>
          </div>

          {/* React Player (hidden but needed for playback) */}
          <ReactPlayer
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${currentVideo.id}`}
            playing={isPlaying}
            volume={isMuted ? 0 : volume / 100}
            onProgress={handleProgress}
            onDuration={handleDuration}
            onEnded={playNext}
            width="0"
            height="0"
            config={{
              playerVars: {
                modestbranding: 1,
                rel: 0,
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
