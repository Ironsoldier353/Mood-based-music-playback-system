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
  X,
  Shuffle,
  Plus,
  MoreVertical,
  Trash2,
  AudioLines,
  Loader2,
  Check,
} from "lucide-react";

import ReactPlayer from "react-player/youtube";
import Image from "next/image";
import toast from "react-hot-toast";

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

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  songs: PlaylistSong[];
};

type PlaylistSong = {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string;
  duration: string;
};

export default function MusicApp() {
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
  const [liked, setLiked] = useState(false);
  const [showLikedLibrary, setShowLikedLibrary] = useState(false);
  const [likedSongs, setLikedSongs] = useState<VideoResult[]>([]);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [isPlayingFromLibrary, setIsPlayingFromLibrary] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null
  );
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const playerRef = useRef<ReactPlayer>(null);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const historySubmitted = useRef<boolean>(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<VideoResult[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showPlaylistDropdown &&
        !(event.target as Element).closest(".relative")
      ) {
        setShowPlaylistDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPlaylistDropdown]);
  const languages = [
    { id: "hindi", name: "Hindi", flag: "🇮🇳" },
    { id: "english", name: "English", flag: "🇺🇸" },
    { id: "bengali", name: "Bengali", flag: "🇮🇳" },
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

  // Load liked songs and playlists on initial render
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [likedRes, playlistsRes] = await Promise.all([
          fetch("/api/liked-songs"),
          fetch("/api/playlists"),
        ]);

        if (likedRes.ok) {
          const likedData = await likedRes.json();
          setLikedSongs(likedData);
        }

        if (playlistsRes.ok) {
          const playlistsData = await playlistsRes.json();
          setPlaylists(playlistsData);
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        toast.error("Failed to load your data");
      } finally {
        setInitialLoad(false);
      }
    };

    loadInitialData();
  }, []);

  // Update liked status when current video changes
  useEffect(() => {
    if (currentVideo) {
      const isLiked = likedSongs.some((song) => song.id === currentVideo.id);
      setLiked(isLiked);
    }
  }, [currentVideo, likedSongs]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        openDropdownId &&
        !(e.target as Element).closest(".dropdown-container")
      ) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId]);

  // Close sidebar when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (showLikedLibrary || showPlaylists || selectedPlaylist)
      ) {
        setShowLikedLibrary(false);
        setShowPlaylists(false);
        setSelectedPlaylist(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showLikedLibrary, showPlaylists, selectedPlaylist]);

  const fetchVideos = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/youtube-search?query=${encodeURIComponent(
          query
        )}&t=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

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

  const playVideo = (video: VideoResult, fromLibrary = false) => {
    setCurrentVideo(video);
    setIsPlaying(true);
    const isLiked = likedSongs.some((song) => song.id === video.id);
    setLiked(isLiked);
    setIsPlayingFromLibrary(fromLibrary);
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
      setPlayedSeconds(state.playedSeconds);
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
    if (!currentVideo) return;

    if (isPlayingFromLibrary && selectedPlaylist?.songs) {
      const currentIndex = selectedPlaylist.songs.findIndex(
        (v) => v.videoId === currentVideo.id
      );
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % selectedPlaylist.songs.length;
        setCurrentVideo({
          id: selectedPlaylist.songs[nextIndex].videoId,
          title: selectedPlaylist.songs[nextIndex].title,
          artist: selectedPlaylist.songs[nextIndex].artist,
          url: selectedPlaylist.songs[nextIndex].url,
          thumbnail: selectedPlaylist.songs[nextIndex].thumbnail,
          duration: selectedPlaylist.songs[nextIndex].duration,
          views: "",
          published: "",
        });
        setIsPlaying(true);
      }
    } else if (isPlayingFromLibrary && likedSongs.length > 0) {
      const currentIndex = likedSongs.findIndex(
        (v) => v.id === currentVideo.id
      );
      const nextIndex = (currentIndex + 1) % likedSongs.length;
      setCurrentVideo(likedSongs[nextIndex]);
      setIsPlaying(true);
    } else if (videos.length > 0) {
      const currentIndex = videos.findIndex((v) => v.id === currentVideo.id);
      const nextIndex = (currentIndex + 1) % videos.length;
      setCurrentVideo(videos[nextIndex]);
      setIsPlaying(true);
    }
  };

  const playPrevious = () => {
    if (!currentVideo) return;

    if (isPlayingFromLibrary && selectedPlaylist?.songs) {
      const currentIndex = selectedPlaylist.songs.findIndex(
        (v) => v.videoId === currentVideo.id
      );
      if (currentIndex !== -1) {
        const prevIndex =
          (currentIndex - 1 + selectedPlaylist.songs.length) %
          selectedPlaylist.songs.length;
        setCurrentVideo({
          id: selectedPlaylist.songs[prevIndex].videoId,
          title: selectedPlaylist.songs[prevIndex].title,
          artist: selectedPlaylist.songs[prevIndex].artist,
          url: selectedPlaylist.songs[prevIndex].url,
          thumbnail: selectedPlaylist.songs[prevIndex].thumbnail,
          duration: selectedPlaylist.songs[prevIndex].duration,
          views: "",
          published: "",
        });
        setIsPlaying(true);
      }
    } else if (isPlayingFromLibrary && likedSongs.length > 0) {
      const currentIndex = likedSongs.findIndex(
        (v) => v.id === currentVideo.id
      );
      const prevIndex =
        (currentIndex - 1 + likedSongs.length) % likedSongs.length;
      setCurrentVideo(likedSongs[prevIndex]);
      setIsPlaying(true);
    } else if (videos.length > 0) {
      const currentIndex = videos.findIndex((v) => v.id === currentVideo.id);
      const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
      setCurrentVideo(videos[prevIndex]);
      setIsPlaying(true);
    }
  };

  const toggleLike = async (video?: VideoResult) => {
    const videoToLike = video || currentVideo;
    if (!videoToLike) return;

    setIsLiking(true);
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoToLike.id,
          title: videoToLike.title,
          artist: videoToLike.artist,
          url: videoToLike.url,
          thumbnail: videoToLike.thumbnail,
          duration: videoToLike.duration,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle like");

      const data = await res.json();

      // Update liked songs list
      const songsRes = await fetch("/api/liked-songs");
      if (songsRes.ok) {
        const updatedSongs = await songsRes.json();
        setLikedSongs(updatedSongs);
      }

      // Update like status if current video is the one being liked/unliked
      if (!video || video.id === currentVideo?.id) {
        setLiked(data.liked);
      }

      // Show feedback to user
      toast.success(
        data.liked ? "Added to liked songs" : "Removed from liked songs"
      );
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update liked songs");
    } finally {
      setIsLiking(false);
    }
  };

  useEffect(() => {
    // Reset submission flag when song changes
    historySubmitted.current = false;

    return () => {
      // Cleanup if needed
    };
  }, [currentVideo?.id]);

  useEffect(() => {
    if (!currentVideo || historySubmitted.current) return;

    const durationParts = currentVideo.duration
      .split(":")
      .map((part) => parseInt(part));
    let durationInSeconds = 0;

    if (durationParts.length === 3) {
      // HH:MM:SS
      durationInSeconds =
        durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];
    } else if (durationParts.length === 2) {
      // MM:SS
      durationInSeconds = durationParts[0] * 60 + durationParts[1];
    }

    const threshold = Math.min(60, durationInSeconds * 0.5);

    if (playedSeconds >= threshold) {
      const submitHistory = async () => {
        try {
          historySubmitted.current = true;

          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoId: currentVideo.id,
              title: currentVideo.title,
              artist: currentVideo.artist,
              thumbnail: currentVideo.thumbnail,
              duration: durationInSeconds,
            }),
          });
        } catch (error) {
          console.error("Failed to record history:", error);
          historySubmitted.current = false;
        }
      };

      submitHistory();
    }
  }, [playedSeconds, currentVideo?.id]);

  const fetchPlaylists = async () => {
    try {
      const res = await fetch("/api/playlists");
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (err) {
      console.error("Failed to fetch playlists:", err);
      toast.error("Failed to load playlists");
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast.error("Playlist name is required");
      return;
    }

    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDescription,
        }),
      });

      if (!res.ok) throw new Error("Failed to create playlist");

      const newPlaylist = await res.json();
      setPlaylists([...playlists, newPlaylist]);
      setNewPlaylistName("");
      setNewPlaylistDescription("");
      toast.success("Playlist created successfully");
    } catch (error) {
      console.error("Error creating playlist:", error);
      toast.error("Failed to create playlist");
    }
  };

  const addToPlaylist = async (playlistId: string, video?: VideoResult) => {
    const videoToAdd = video || currentVideo;
    if (!videoToAdd) return;

    try {
      const res = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoToAdd.id,
          title: videoToAdd.title,
          artist: videoToAdd.artist,
          url: videoToAdd.url,
          thumbnail: videoToAdd.thumbnail,
          duration: videoToAdd.duration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 &&
          data.error === "Song already exists in playlist"
        ) {
          toast.error("Song already exists in this playlist");
        } else {
          toast.error(data.error || "Failed to add to playlist");
        }
        return;
      }

      // Refresh playlists
      fetchPlaylists();
      toast.success("Added to playlist");
    } catch (error) {
      console.error("Error adding to playlist:", error);
      toast.error("Something went wrong.");
    }
  };

  const removeFromPlaylist = async (playlistId: string, songId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove from playlist");

      // Refresh playlists
      fetchPlaylists();
      // If we're currently viewing this playlist, update the selected playlist
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist({
          ...selectedPlaylist,
          songs: selectedPlaylist.songs.filter((s) => s.id !== songId),
        });
      }
      toast.success("Removed from playlist");
    } catch (error) {
      console.error("Error removing from playlist:", error);
      toast.error("Failed to remove from playlist");
    }
  };

  const playAllLikedSongs = (shuffle = false) => {
    if (likedSongs.length === 0) {
      toast.error("No songs in your library");
      return;
    }

    let songsToPlay = [...likedSongs];
    if (shuffle) {
      songsToPlay = songsToPlay.sort(() => Math.random() - 0.5);
    }

    setCurrentVideo(songsToPlay[0]);
    setIsPlaying(true);
    setIsPlayingFromLibrary(true);
    setShowLikedLibrary(false);
    toast.success(`Playing ${shuffle ? "shuffled" : "all"} liked songs`);
  };

  const filteredLikedSongs = likedSongs.filter(
    (song) =>
      song.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(librarySearchQuery.toLowerCase())
  );

  const PlaylistDropdown = ({ video }: { video: VideoResult }) => {
    return (
      <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 rounded-md shadow-lg z-50 border border-white/10">
        <div className="py-1">
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-white/10">
            Add to playlist
          </div>
          {playlists.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">
              No playlists found
            </div>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={(e) => {
                  e.stopPropagation();
                  addToPlaylist(playlist.id, video);
                  setOpenDropdownId(null);
                }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-white/10"
              >
                {playlist.name}
              </button>
            ))
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaylists(true);
              setNewPlaylistName(`${video.title} - ${video.artist}`);
              setOpenDropdownId(null);
            }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-white/10 border-t border-white/10 text-pink-400 items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Create new playlist
          </button>
        </div>
      </div>
    );
  };
  const deletePlaylist = async (playlistId: string) => {
    if (!confirm("Are you sure you want to delete this playlist?")) return;

    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh the playlists after successful deletion
      const updatedPlaylists = playlists.filter((p) => p.id !== playlistId);
      setPlaylists(updatedPlaylists);

      // If the deleted playlist was selected, clear the selection
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(null);
      }

      console.log("Playlist deleted successfully");
    } catch (error) {
      console.error("Failed to delete playlist:", error);
      alert("Failed to delete playlist. Please try again.");
    }
  };
  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const res = await fetch("/api/recommend");
      if (!res.ok) throw new Error("Failed to fetch recommendations");

      const data = await res.json();
      setRecommendations(data.recommendations);
      setShowRecommendations(true);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast.error("Failed to load recommendations");
    } finally {
      setLoadingRecommendations(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 text-white relative">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          {/* Mobile Header */}
          <div className="flex items-center justify-between h-16 md:hidden">
            <div className="flex items-center space-x-2">
              <div className="bg-pink-600 p-1.5 rounded-lg">
                <AudioLines className="h-4 w-4" />
              </div>
              <h1 className="text-lg font-bold">MusicStream</h1>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowLikedLibrary(!showLikedLibrary)}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                  showLikedLibrary
                    ? "bg-pink-600/30 text-pink-400"
                    : "text-gray-400"
                }`}
              >
                <Heart className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setShowPlaylists(!showPlaylists);
                  if (!showPlaylists) {
                    fetchPlaylists();
                  }
                }}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                  showPlaylists
                    ? "bg-pink-600/30 text-pink-400"
                    : "text-gray-400"
                }`}
              >
                <ListMusic className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="pb-4 md:hidden">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search songs, artists..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </form>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-pink-600 p-2 rounded-lg">
                <AudioLines className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold">MusicStream</h1>
            </div>

            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search songs, artists..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </form>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowLikedLibrary(!showLikedLibrary)}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                  showLikedLibrary
                    ? "bg-pink-600/30 text-pink-400"
                    : "text-gray-400"
                }`}
              >
                <Heart className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setShowPlaylists(!showPlaylists);
                  if (!showPlaylists) {
                    fetchPlaylists();
                  }
                }}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                  showPlaylists
                    ? "bg-pink-600/30 text-pink-400"
                    : "text-gray-400"
                }`}
              >
                <ListMusic className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Liked Songs Library Sidebar */}
      {showLikedLibrary && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowLikedLibrary(false)}
          />

          {/* Sidebar */}
          <div className="fixed top-16 right-0 bottom-0 w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-800 border-l border-white/10 shadow-xl z-50 flex flex-col">
            <div className="p-4 bg-gray-900/90 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-400" />
                  Liked Library
                </h2>
                <button
                  onClick={() => setShowLikedLibrary(false)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => playAllLikedSongs(false)}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full text-sm flex items-center justify-center gap-2 transition-colors"
                  disabled={likedSongs.length === 0}
                >
                  <Play className="h-4 w-4" />
                  Play All
                </button>
                <button
                  onClick={() => playAllLikedSongs(true)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm flex items-center justify-center gap-2 transition-colors"
                  disabled={likedSongs.length === 0}
                >
                  <Shuffle className="h-4 w-4" />
                  Shuffle
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Search your library..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {initialLoad ? (
                  <div className="space-y-2">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 animate-pulse"
                      >
                        <div className="h-12 w-12 rounded-md bg-white/10 flex-shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 rounded bg-white/10"></div>
                          <div className="h-3 w-1/2 rounded bg-white/10"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredLikedSongs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    {librarySearchQuery ? (
                      <>
                        <Search className="w-8 h-8 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No matching songs found</p>
                        <p className="text-sm text-gray-500">
                          Try adjusting your search query
                        </p>
                      </>
                    ) : (
                      <>
                        <Heart className="w-8 h-8 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">
                          Your liked songs will appear here
                        </p>
                        <p className="text-sm text-gray-500">
                          Like songs by clicking the heart icon
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLikedSongs.map((song) => (
                      <div
                        key={song.id}
                        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
                          currentVideo?.id === song.id
                            ? "bg-pink-600/20 border border-pink-600/30"
                            : ""
                        }`}
                        onClick={() => playVideo(song, true)}
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden">
                          <Image
                            src={song.thumbnail}
                            alt={song.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          {currentVideo?.id === song.id && isPlaying && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm line-clamp-1">
                            {song.title}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-1">
                            {song.artist}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(song);
                            }}
                            className={`p-1 transition-colors ${
                              isLiking &&
                              likedSongs.some((s) => s.id === song.id)
                                ? "text-transparent"
                                : "text-pink-400 hover:text-pink-300"
                            }`}
                            disabled={isLiking}
                          >
                            {isLiking &&
                            likedSongs.some((s) => s.id === song.id) ? (
                              <div className="h-4 w-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Heart className="h-4 w-4 fill-pink-400" />
                            )}
                          </button>
                          <div className="relative dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  openDropdownId === song.id ? null : song.id
                                );
                              }}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openDropdownId === song.id && (
                              <PlaylistDropdown video={song} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Playlists Sidebar */}
      {showPlaylists && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowPlaylists(false)}
          />

          {/* Sidebar */}
          <div className="fixed top-16 right-0 bottom-0 w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-800 border-l border-white/10 shadow-xl z-50 flex flex-col">
            <div className="p-4 bg-gray-900/90 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ListMusic className="h-5 w-5 text-pink-400" />
                  Your Playlists
                </h2>
                <button
                  onClick={() => setShowPlaylists(false)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Create new playlist form */}
              <div className="mb-4 space-y-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="New playlist name"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
                <textarea
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  rows={2}
                />
                <button
                  onClick={createPlaylist}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Create Playlist
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Search your playlists..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            {/* Playlist Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {playlists.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ListMusic className="w-8 h-8 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No playlists yet</p>
                    <p className="text-sm text-gray-500">
                      Create your first playlist above
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playlists.map((playlist) => (
                      <div
                        key={playlist.id}
                        className={`p-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group ${
                          selectedPlaylist?.id === playlist.id
                            ? "bg-pink-600/20 border border-pink-600/30"
                            : "bg-white/5"
                        }`}
                        onClick={() => setSelectedPlaylist(playlist)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{playlist.name}</h3>
                            <p className="text-xs text-gray-400">
                              {playlist.songs?.length || 0} songs
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {selectedPlaylist?.id === playlist.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlaylist(null);
                                }}
                                className="p-1 text-gray-400 hover:text-white"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePlaylist(playlist.id);
                              }}
                              className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Delete playlist"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {playlist.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {playlist.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selected Playlist View */}
      {selectedPlaylist && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setSelectedPlaylist(null)}
          />

          {/* Sidebar */}
          <div className="fixed top-16 right-0 bottom-0 w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-800 border-l border-white/10 shadow-xl z-50 flex flex-col">
            <div className="p-4 bg-gray-900/90 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ListMusic className="h-5 w-5 text-pink-400" />
                  Your Playlists
                </h2>
                <button
                  onClick={() => setShowPlaylists(false)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Create new playlist form */}
              <div className="mb-4 space-y-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="New playlist name"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
                <textarea
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  rows={2}
                />
                <button
                  onClick={createPlaylist}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Create Playlist
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Search your playlists..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            {/* Playlist Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {playlists.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ListMusic className="w-8 h-8 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No playlists yet</p>
                    <p className="text-sm text-gray-500">
                      Create your first playlist above
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playlists.map((playlist) => (
                      <div
                        key={playlist.id}
                        className={`p-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group ${
                          selectedPlaylist?.id === playlist.id
                            ? "bg-pink-600/20 border border-pink-600/30"
                            : "bg-white/5"
                        }`}
                        onClick={() => setSelectedPlaylist(playlist)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{playlist.name}</h3>
                            <p className="text-xs text-gray-400">
                              {playlist.songs?.length || 0} songs
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {selectedPlaylist?.id === playlist.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlaylist(null);
                                }}
                                className="p-1 text-gray-400 hover:text-white"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePlaylist(playlist.id);
                              }}
                              className="p-1 text-gray-400 hover:text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                              aria-label="Delete playlist"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {playlist.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {playlist.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selected Playlist View */}
      {selectedPlaylist && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setSelectedPlaylist(null)}
          />

          {/* Sidebar */}
          <div className="fixed top-16 right-0 bottom-0 w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-800 border-l border-white/10 shadow-xl z-50 flex flex-col">
            <div className="p-4 bg-gray-900/90 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">{selectedPlaylist.name}</h2>
                <button
                  onClick={() => setSelectedPlaylist(null)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {selectedPlaylist.description && (
                <p className="text-sm text-gray-400 mb-4">
                  {selectedPlaylist.description}
                </p>
              )}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    if (selectedPlaylist.songs.length > 0) {
                      playVideo(
                        {
                          id: selectedPlaylist.songs[0].videoId,
                          title: selectedPlaylist.songs[0].title,
                          artist: selectedPlaylist.songs[0].artist,
                          url: selectedPlaylist.songs[0].url,
                          thumbnail: selectedPlaylist.songs[0].thumbnail,
                          duration: selectedPlaylist.songs[0].duration,
                          views: "",
                          published: "",
                        },
                        true
                      );
                    }
                  }}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-full text-sm flex items-center justify-center gap-2 transition-colors"
                  disabled={selectedPlaylist.songs.length === 0}
                >
                  <Play className="h-4 w-4" />
                  Play All
                </button>
                <button
                  onClick={() => {
                    if (selectedPlaylist.songs.length > 0) {
                      const shuffled = [...selectedPlaylist.songs].sort(
                        () => Math.random() - 0.5
                      );
                      playVideo(
                        {
                          id: shuffled[0].videoId,
                          title: shuffled[0].title,
                          artist: shuffled[0].artist,
                          url: shuffled[0].url,
                          thumbnail: shuffled[0].thumbnail,
                          duration: shuffled[0].duration,
                          views: "",
                          published: "",
                        },
                        true
                      );
                    }
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm flex items-center justify-center gap-2 transition-colors"
                  disabled={selectedPlaylist.songs.length === 0}
                >
                  <Shuffle className="h-4 w-4" />
                  Shuffle
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Search in playlist..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            {/* Playlist Songs */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {selectedPlaylist.songs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ListMusic className="w-8 h-8 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No songs in this playlist</p>
                    <p className="text-sm text-gray-500">
                      Add songs from the main library
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedPlaylist.songs
                      .filter(
                        (song) =>
                          song.title
                            .toLowerCase()
                            .includes(librarySearchQuery.toLowerCase()) ||
                          song.artist
                            .toLowerCase()
                            .includes(librarySearchQuery.toLowerCase())
                      )
                      .map((song) => (
                        <div
                          key={song.id}
                          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
                            currentVideo?.id === song.videoId
                              ? "bg-pink-600/20 border border-pink-600/30"
                              : ""
                          }`}
                          onClick={() =>
                            playVideo(
                              {
                                id: song.videoId,
                                title: song.title,
                                artist: song.artist,
                                url: song.url,
                                thumbnail: song.thumbnail,
                                duration: song.duration,
                                views: "",
                                published: "",
                              },
                              true
                            )
                          }
                        >
                          <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden">
                            <Image
                              src={song.thumbnail}
                              alt={song.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            {currentVideo?.id === song.videoId && isPlaying && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm line-clamp-1">
                              {song.title}
                            </h3>
                            <p className="text-xs text-gray-400 line-clamp-1">
                              {song.artist}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromPlaylist(selectedPlaylist.id, song.id);
                            }}
                            className="p-1 text-gray-400 hover:text-pink-400 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

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
      <div className="container mx-auto px-4 py-4">
        <div
          className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-4 mb-6 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={fetchRecommendations}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <ListMusic className="h-8 w-8 text-yellow-300" />
              <div>
                <h3 className="font-semibold text-lg">Recommended For You</h3>
                <p className="text-sm text-white/80">
                  Personalized recommendations based on your listening history
                </p>
              </div>
            </div>
            <div className="bg-white text-blue-600 hover:bg-gray-100 px-6 py-2 rounded-full font-medium transition-colors flex items-center space-x-2 whitespace-nowrap">
              {loadingRecommendations ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Show Recommendations</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRecommendations && (
        <div className="container mx-auto px-4 py-4">
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recommended For You</h2>
              <button
                onClick={() => setShowRecommendations(false)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingRecommendations ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
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
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recommendations.map((video) => (
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No recommendations available</p>
                <p className="text-sm mt-1">
                  Listen to more songs to get personalized recommendations
                </p>
              </div>
            )}
          </div>
        </div>
      )}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(video);
                      }}
                      className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-colors ${
                        likedSongs.some((s) => s.id === video.id)
                          ? "bg-pink-600/80 text-white"
                          : "bg-black/70 text-gray-300 hover:bg-black/80"
                      }`}
                      disabled={isLiking}
                    >
                      {isLiking && likedSongs.some((s) => s.id === video.id) ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Heart
                          className={`h-4 w-4 ${
                            likedSongs.some((s) => s.id === video.id)
                              ? "fill-white"
                              : ""
                          }`}
                        />
                      )}
                    </button>
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
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No videos found</p>
              <p className="text-sm">Try searching for something else</p>
            </div>
          )}
        </div>
      </main>

      {/* Music Player */}
      {currentVideo && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10 p-3 z-40">
          <div className="container mx-auto">
            {/* Progress Bar - on top */}
            <div className="mb-2 w-full">
              <input
                type="range"
                min={0}
                max={1}
                step="any"
                value={played}
                onChange={handleSeekChange}
                onMouseDown={handleSeekMouseDown}
                onMouseUp={handleSeekMouseUp}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(played * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col">
              {/* Song Info Row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className="relative h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      src={currentVideo.thumbnail}
                      alt={currentVideo.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm line-clamp-1">
                      {currentVideo.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-1">
                      {currentVideo.artist}
                    </p>
                  </div>
                </div>

                {/* Like and Add buttons */}
                <div className="flex items-center space-x-2 ml-2">
                  <button
                    onClick={() => toggleLike(currentVideo)}
                    className={`p-1.5 rounded-full ${
                      likedSongs.some((s) => s.id === currentVideo.id)
                        ? "text-pink-400"
                        : "text-gray-400"
                    }`}
                    disabled={isLiking}
                  >
                    {isLiking &&
                    likedSongs.some((s) => s.id === currentVideo.id) ? (
                      <div className="h-4 w-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Heart
                        className="h-4 w-4"
                        fill={
                          likedSongs.some((s) => s.id === currentVideo.id)
                            ? "#ec4899"
                            : "none"
                        }
                      />
                    )}
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlaylistDropdown(!showPlaylistDropdown);
                      }}
                      className="p-1.5 rounded-full text-gray-400 hover:text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    {/* Playlist Dropdown for mobile */}
                    {showPlaylistDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowPlaylistDropdown(false)}
                        />
                        <div className="absolute bottom-full mb-2 right-0 w-48 bg-gray-800 rounded-lg shadow-lg border border-white/10 z-50">
                          <div className="p-2 max-h-60 overflow-y-auto">
                            {playlists.length === 0 ? (
                              <div className="p-2 text-center text-sm text-gray-400">
                                <p>No playlists yet</p>
                                <button
                                  onClick={() => {
                                    setShowPlaylistDropdown(false);
                                    setShowPlaylists(true);
                                  }}
                                  className="mt-2 text-pink-400 hover:text-pink-300 text-sm"
                                >
                                  Create one
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="px-3 py-2 text-xs text-gray-500 border-b border-white/10">
                                  Add to playlist
                                </div>
                                {playlists.map((playlist) => (
                                  <button
                                    key={playlist.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToPlaylist(playlist.id, {
                                        id: currentVideo.id,
                                        title: currentVideo.title,
                                        artist: currentVideo.artist,
                                        url: currentVideo.url,
                                        thumbnail: currentVideo.thumbnail,
                                        duration: currentVideo.duration,
                                        views: currentVideo.views,
                                        published: currentVideo.published,
                                      });
                                      setShowPlaylistDropdown(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center justify-between"
                                  >
                                    <span className="truncate">
                                      {playlist.name}
                                    </span>
                                    {playlist.songs.some(
                                      (s) => s.videoId === currentVideo.id
                                    ) && (
                                      <Check className="h-4 w-4 text-pink-400" />
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-center space-x-4">
                {/* Playback controls */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={playPrevious}
                    className="p-2 rounded-full hover:bg-white/10"
                  >
                    <SkipBack className="h-5 w-5" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="p-3 bg-pink-600 hover:bg-pink-700 rounded-full"
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="h-6 w-6" />
                    )}
                  </button>
                  <button
                    onClick={playNext}
                    className="p-2 rounded-full hover:bg-white/10"
                  >
                    <SkipForward className="h-5 w-5" />
                  </button>
                </div>

                {/* Volume control */}
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 rounded-full hover:bg-white/10"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={changeVolume}
                    className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center justify-between">
              {/* Song Info */}
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm line-clamp-1">
                    {currentVideo.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {currentVideo.artist}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-4 mx-4">
                <button
                  onClick={playPrevious}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="p-3 bg-pink-600 hover:bg-pink-700 rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </button>
                <button
                  onClick={playNext}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <SkipForward className="h-5 w-5" />
                </button>

                {/* Volume Control */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
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
                    className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden ReactPlayer */}
      {currentVideo && (
        <div className="hidden">
          <ReactPlayer
            ref={playerRef}
            url={currentVideo.url}
            playing={isPlaying}
            volume={isMuted ? 0 : volume / 100}
            onProgress={handleProgress}
            onDuration={handleDuration}
            onEnded={playNext}
            controls={false}
            config={{
              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                showinfo: 0,
              },
            }}
          />
        </div>
      )}

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ec4899;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.3);
        }

        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ec4899;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.3);
        }

        .slider::-webkit-slider-track {
          background: linear-gradient(
            to right,
            #ec4899 0%,
            #ec4899 ${played * 100}%,
            rgba(255, 255, 255, 0.2) ${played * 100}%,
            rgba(255, 255, 255, 0.2) 100%
          );
          height: 4px;
          border-radius: 2px;
        }

        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
