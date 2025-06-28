"use client";
import { useState, useRef, useEffect } from "react";
import {
  Camera,
  Music,
  Heart,
  Home,
  Smile,
  Frown,
  Volume2,
  VolumeX,
  Volume1,
  X,
  Settings,
  SkipBack,
  SkipForward,
  Shuffle,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize,
  RotateCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import ReactPlayer from "react-player/youtube";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface VideoElement extends HTMLVideoElement {
  srcObject: MediaStream | null;
}

interface Song {
  url: string;
  title: string;
  thumbnail?: string;
  artist?: string;
}

interface EmotionResponse {
  emotion: string;
  confidence: number;
  deepface_available: boolean;
}

interface MusicResponse {
  videos: Song[];
  total_count: number;
  mood: string;
  language: string;
}

const MOOD_OPTIONS = [
  "happy",
  "sad",
  "angry",
  "fear",
  "surprise",
  "disgust",
  "neutral",
];

const MOOD_COLORS = {
  happy: "from-yellow-400 to-amber-500",
  sad: "from-blue-400 to-indigo-600",
  angry: "from-red-500 to-rose-600",
  fear: "from-purple-500 to-violet-700",
  surprise: "from-orange-400 to-pink-500",
  disgust: "from-green-500 to-emerald-600",
  neutral: "from-gray-400 to-slate-600",
};

const MOOD_EMOJIS = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  fear: "😨",
  surprise: "😲",
  disgust: "🤢",
  neutral: "😐",
};

export default function MoodMusicPlayer() {
  const router = useRouter();
  const videoRef = useRef<VideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<ReactPlayer>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [music, setMusic] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("english");
  const [preferences, setPreferences] = useState<string>("");
  const [webcamReady, setWebcamReady] = useState<boolean>(false);
  const [playlistSize, setPlaylistSize] = useState<number>(10);
  const [manualMood, setManualMood] = useState<string>("");
  const [useManualMood, setUseManualMood] = useState<boolean>(false);
  const [played, setPlayed] = useState<number>(0);
  const [playedSeconds, setPlayedSeconds] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [seeking, setSeeking] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [backendReady, setBackendReady] = useState<boolean>(false);
  const [checkingBackend, setCheckingBackend] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [fullscreenPlayer, setFullscreenPlayer] = useState<boolean>(false);
  const [visualizerActive, setVisualizerActive] = useState<boolean>(false);
  const [lastDetectedMood, setLastDetectedMood] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(true);
  const [showWebcam, setShowWebcam] = useState<boolean>(false);
  const [fetchingMusic, setFetchingMusic] = useState<boolean>(false);

  // Check backend status on mount
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        setCheckingBackend(true);
        const response = await fetch(`${API_URL}/status`);
        if (response.ok) {
          setBackendReady(true);
        } else {
          throw new Error("Backend not ready");
        }
      } catch {
        setError(
          "Backend is starting up (this may take a minute on free tier)..."
        );
        // Retry after 5 seconds
        setTimeout(checkBackendStatus, 5000);
      } finally {
        setCheckingBackend(false);
      }
    };

    checkBackendStatus();
  }, []);

  // Start webcam only when needed
  useEffect(() => {
    if (!showWebcam) return;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setWebcamReady(true);
          };
        }
      } catch (err) {
        setError(
          "Could not access webcam. Please ensure camera permissions are granted."
        );
        console.error("Webcam error:", err);
      }
    };

    startWebcam();
    // Capture the current value of videoRef for cleanup
    const currentVideo = videoRef.current;
    return () => {
      if (currentVideo?.srcObject) {
        const tracks = currentVideo.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [showWebcam]);

  const captureAndAnalyze = async () => {
    if (useManualMood && manualMood) {
      setMood(manualMood);
      setLastDetectedMood(manualMood);
      setConfidence(100);
      await fetchMusic(manualMood);
      return;
    }

    if (!webcamReady && !useManualMood) {
      setShowWebcam(true);
      setError("Webcam is not ready. Please wait a moment and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video) {
        throw new Error("Video elements not initialized");
      }

      if (!video.videoWidth || !video.videoHeight) {
        throw new Error("Video not ready. Please wait and try again.");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL("image/jpeg", 0.8);

      const moodResponse = await fetch(`${API_URL}/detect-mood`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_data: imageData,
          language: language,
          custom_preferences: preferences,
          max_results: playlistSize,
        }),
      });

      if (!moodResponse.ok) {
        throw new Error("Failed to detect mood");
      }

      const moodData: EmotionResponse = await moodResponse.json();
      setMood(moodData.emotion);
      setLastDetectedMood(moodData.emotion);
      setConfidence(moodData.confidence);

      await fetchMusic(moodData.emotion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze mood. Please try again."
      );
      console.error("Capture error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMusic = async (moodToUse: string) => {
    setFetchingMusic(true);
    try {
      const imageData = canvasRef.current?.toDataURL("image/jpeg", 0.8) || "";

      const response = await fetch(`${API_URL}/get-music`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_data: imageData,
          language: language,
          custom_preferences: preferences,
          max_results: playlistSize,
          manual_mood: useManualMood ? moodToUse : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || "Failed to get music recommendations"
        );
      }

      const data: MusicResponse = await response.json();
      setMusic(data.videos);
      setCurrentIndex(0);
      setIsPlaying(true);
      setPlayed(0);
      setPlayedSeconds(0);
      setVisualizerActive(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch music recommendations"
      );
      console.error("Music fetch error:", err);
    } finally {
      setFetchingMusic(false);
    }
  };

  const getMoodIcon = () => {
    if (!mood) return <Heart className="w-6 h-6 text-pink-400" />;

    const moodLower = mood.toLowerCase();
    if (moodLower.includes("happy")) {
      return <Smile className="w-6 h-6 text-yellow-400" />;
    } else if (moodLower.includes("sad")) {
      return <Frown className="w-6 h-6 text-blue-400" />;
    }
    return <Heart className="w-6 h-6 text-pink-400" />;
  };

  const clearResults = () => {
    setMood(null);
    setMusic([]);
    setError(null);
    setConfidence(0);
    setVisualizerActive(false);
    setShowWebcam(false);
  };

  const shuffleMusic = () => {
    const shuffled = [...music].sort(() => Math.random() - 0.5);
    setMusic(shuffled);
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : music.length - 1));
    setIsPlaying(true);
    setPlayed(0);
    setPlayedSeconds(0);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % music.length);
    setIsPlaying(true);
    setPlayed(0);
    setPlayedSeconds(0);
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

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    setSeeking(false);
    if (playerRef.current) {
      playerRef.current.seekTo(parseFloat(e.currentTarget.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(volume === 0 ? 0.8 : volume);
    } else {
      setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <VolumeX className="w-5 h-5" />;
    } else if (volume < 0.5) {
      return <Volume1 className="w-5 h-5" />;
    }
    return <Volume2 className="w-5 h-5" />;
  };

  const getMoodColor = () => {
    if (!mood) return "from-purple-600 to-indigo-800";
    const moodKey = mood.toLowerCase().split(" ")[0];
    return (
      MOOD_COLORS[moodKey as keyof typeof MOOD_COLORS] ||
      "from-purple-600 to-indigo-800"
    );
  };

  const getMoodEmoji = () => {
    if (!mood) return "🎵";
    const moodKey = mood.toLowerCase().split(" ")[0];
    return MOOD_EMOJIS[moodKey as keyof typeof MOOD_EMOJIS] || "🎵";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Backend Loading Overlay */}
      {checkingBackend && (
        <div className="fixed inset-0 bg-gray-900/90 z-50 flex flex-col items-center justify-center p-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <h2 className="text-2xl font-bold text-center mb-2">
            Checking Backend Status
          </h2>
          <p className="text-gray-300 text-center max-w-md">
            The backend is hosted on Render&apos;s free tier which spins down
            after inactivity. It may take 30-60 seconds to wake up on first
            request.
          </p>
          <p className="text-gray-400 text-sm mt-4">
            Trying to connect to the backend...
          </p>
        </div>
      )}

      {/* Music Fetching Overlay */}
      {fetchingMusic && (
        <div className="fixed inset-0 bg-gray-900/90 z-40 flex flex-col items-center justify-center p-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <h2 className="text-2xl font-bold text-center mb-2">
            Creating Your Playlist
          </h2>
          <p className="text-gray-300 text-center max-w-md">
            Analyzing your mood and selecting the perfect songs for you...
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors"
            >
              <Home className="w-6 h-6" />
            </button>
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${getMoodColor()} shadow-lg`}
            >
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1
                className="text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent 
                from-purple-400 via-pink-500 to-indigo-500 animate-text"
              >
                MusicStream
              </h1>
              <p className="text-sm text-gray-400">
                AI-powered mood detection and personalized music
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                showSettings
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-800 hover:bg-gray-700"
              } transition-colors`}
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Settings</span>
              {showSettings ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700 transition-all duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Manual Mood Toggle */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Mood Detection
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="manualMoodToggle"
                    checked={useManualMood}
                    onChange={(e) => setUseManualMood(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-gray-700 border-gray-600"
                  />
                  <label
                    htmlFor="manualMoodToggle"
                    className="text-sm font-medium"
                  >
                    Select Mood Manually
                  </label>
                </div>

                {/* Manual Mood Selection */}
                {useManualMood && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Select Mood
                    </label>
                    <select
                      value={manualMood}
                      onChange={(e) => setManualMood(e.target.value)}
                      className="w-full bg-gray-700 border-gray-600 border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select a mood</option>
                      {MOOD_OPTIONS.map((mood) => (
                        <option key={mood} value={mood}>
                          {mood.charAt(0).toUpperCase() + mood.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Webcam Toggle */}
                {!useManualMood && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Webcam
                    </label>
                    <button
                      onClick={() => setShowWebcam(!showWebcam)}
                      className={`w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        showWebcam
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      {showWebcam ? "Hide Webcam" : "Show Webcam"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Audio Preferences
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-gray-700 border-gray-600 border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="bengali">Bengali</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Music Preferences
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., rock, jazz, pop"
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    className="w-full bg-gray-700 border-gray-600 border rounded-lg py-2 px-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Playlist Settings
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Playlist Size
                  </label>
                  <select
                    value={playlistSize}
                    onChange={(e) => setPlaylistSize(Number(e.target.value))}
                    className="w-full bg-gray-700 border-gray-600 border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={5}>5 songs</option>
                    <option value={10}>10 songs</option>
                    <option value={15}>15 songs</option>
                    <option value={20}>20 songs</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <RotateCw className="w-4 h-4" />
                  Actions
                </h3>
                {(mood || error) && (
                  <button
                    onClick={clearResults}
                    className="w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600"
                  >
                    <X className="w-4 h-4" />
                    Clear Results
                  </button>
                )}
                {lastDetectedMood && !useManualMood && (
                  <button
                    onClick={() => {
                      setManualMood(lastDetectedMood);
                      setUseManualMood(true);
                    }}
                    className="w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600"
                  >
                    <RotateCw className="w-4 h-4" />
                    Use Last Detected Mood
                  </button>
                )}

                <button
                  onClick={captureAndAnalyze}
                  disabled={
                    loading ||
                    (!useManualMood && !webcamReady) ||
                    (useManualMood && !manualMood) ||
                    !backendReady
                  }
                  className={`w-full py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                    loading ||
                    (!useManualMood && !webcamReady) ||
                    (useManualMood && !manualMood) ||
                    !backendReady
                      ? "bg-gray-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4" />
                      {useManualMood ? "Get Music" : "Capture & Analyze Mood"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Webcam Section (Conditional) */}
        {showWebcam && !useManualMood && (
          <div className="rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Mood Detection
              </h2>
              <button
                onClick={() => setShowWebcam(false)}
                className="p-2 rounded-full hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="relative rounded-xl overflow-hidden bg-black mb-4"
              style={{ aspectRatio: "4/3" }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!webcamReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                  <div className="text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2" />
                    <p>Loading camera...</p>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}

        {/* Main Content - Swapped Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Now Playing Section (Left Column) */}
          <div className="lg:w-2/3 space-y-6">
            {music.length > 0 ? (
              <div className="rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    Now Playing
                  </h2>
                  <button
                    onClick={() => setFullscreenPlayer(!fullscreenPlayer)}
                    className={`p-2 rounded-full hover:bg-gray-700`}
                  >
                    {fullscreenPlayer ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div
                  className={`relative overflow-hidden rounded-xl mb-4 ${
                    fullscreenPlayer
                      ? "fixed inset-0 z-50 bg-gray-900 flex items-center justify-center"
                      : ""
                  }`}
                >
                  {fullscreenPlayer && (
                    <button
                      onClick={() => setFullscreenPlayer(false)}
                      className="absolute top-4 right-4 z-50 p-2 rounded-full bg-gray-800/80 hover:bg-gray-700"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  )}
                  <div
                    className={`${
                      fullscreenPlayer ? "w-full h-full" : "relative"
                    } ${fullscreenPlayer ? "" : "pb-[56.25%]"}`}
                  >
                    <ReactPlayer
                      ref={playerRef}
                      url={music[currentIndex]?.url}
                      playing={isPlaying}
                      controls={false}
                      width={fullscreenPlayer ? "100%" : "100%"}
                      height={fullscreenPlayer ? "100%" : "100%"}
                      volume={isMuted ? 0 : volume}
                      onProgress={handleProgress}
                      onDuration={handleDuration}
                      className={`${
                        fullscreenPlayer
                          ? "absolute inset-0"
                          : "absolute top-0 left-0"
                      } rounded-lg overflow-hidden`}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold truncate">
                    {music[currentIndex]?.title || `Song ${currentIndex + 1}`}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {mood
                      ? `${
                          mood.charAt(0).toUpperCase() + mood.slice(1)
                        } mood playlist`
                      : ""}
                  </p>
                </div>

                {/* Seek Bar */}
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-10 text-right text-gray-400">
                      {formatTime(playedSeconds)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={0.999999}
                      step="any"
                      value={played}
                      onChange={handleSeekChange}
                      onMouseDown={handleSeekMouseDown}
                      onMouseUp={handleSeekMouseUp}
                      className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                    />
                    <span className="text-xs w-10 text-gray-400">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex flex-col gap-4">
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={shuffleMusic}
                      className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                      aria-label="Shuffle playlist"
                    >
                      <Shuffle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handlePrevious}
                      className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                      aria-label="Previous song"
                    >
                      <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`p-4 rounded-full bg-gradient-to-br ${getMoodColor()} hover:brightness-110 transition-all shadow-lg`}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white" />
                      )}
                    </button>
                    <button
                      onClick={handleNext}
                      className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                      aria-label="Next song"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-full hover:bg-gray-700"
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {getVolumeIcon()}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700 flex flex-col items-center justify-center text-center min-h-64">
                <Music className="w-12 h-12 mb-4 text-purple-400" />
                <h2 className="text-xl font-semibold mb-2">No Music Yet</h2>
                <p className="text-gray-400 mb-4">
                  Analyze your mood or select one manually to generate a
                  playlist
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>

          {/* Mood Analysis and Playlist (Right Column) */}
          <div className="lg:w-1/3 space-y-6">
            {/* Mood Visualization */}
            {mood ? (
              <div className="rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {getMoodIcon()}
                    Your Mood Analysis
                  </h2>
                  <span className="text-2xl">{getMoodEmoji()}</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">
                        {mood.charAt(0).toUpperCase() + mood.slice(1)}
                      </span>
                      <span className="text-xs">{Math.round(confidence)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-700">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${getMoodColor()}`}
                        style={{ width: `${confidence}%` }}
                      ></div>
                    </div>
                  </div>

                  {visualizerActive && (
                    <div className="mt-6">
                      <div className="flex justify-center items-end h-24 gap-1">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-2 rounded-t-sm bg-purple-400"
                            style={{
                              height: `${Math.random() * 60 + 20}%`,
                              animationName: "pulse",
                              animationDuration: `${
                                0.5 + Math.random() * 0.5
                              }s`,
                              animationTimingFunction: "ease-in-out",
                              animationIterationCount: "infinite",
                              animationDirection: "alternate",
                              animationDelay: `${i * 0.05}s`,
                            }}
                          />
                        ))}
                      </div>
                      <style jsx>{`
                        @keyframes pulse {
                          from {
                            opacity: 0.6;
                          }
                          to {
                            opacity: 1;
                          }
                        }
                      `}</style>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700 flex flex-col items-center justify-center text-center min-h-64">
                <Heart className="w-12 h-12 mb-4 text-pink-400" />
                <h2 className="text-xl font-semibold mb-2">
                  No Mood Detected Yet
                </h2>
                <p className="text-gray-400 mb-4">
                  Use the settings panel to analyze your mood or select one
                  manually
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  Open Settings
                </button>
              </div>
            )}

            {/* Playlist */}
            {showPlaylist && music.length > 0 && (
              <div className="rounded-2xl p-6 bg-gray-800/80 shadow-xl backdrop-blur-sm border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    Playlist ({music.length} songs)
                  </h2>
                  <button
                    onClick={() => setShowPlaylist(false)}
                    className="p-2 rounded-full hover:bg-gray-700/50"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {music.map((song, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg transition-all cursor-pointer ${
                        index === currentIndex
                          ? "bg-gray-700 ring-2 ring-purple-500"
                          : "bg-gray-700/50 hover:bg-gray-700"
                      }`}
                      onClick={() => {
                        setCurrentIndex(index);
                        setIsPlaying(true);
                        setPlayed(0);
                        setPlayedSeconds(0);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            index === currentIndex
                              ? `bg-gradient-to-br ${getMoodColor()}`
                              : "bg-gray-600"
                          }`}
                        >
                          {index === currentIndex && isPlaying ? (
                            <Volume2 className="w-4 h-4 text-white" />
                          ) : (
                            <Music className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">
                            {song.title || `Song ${index + 1}`}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {index === currentIndex ? "Now Playing" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 rounded-xl p-4 animate-fade-in bg-red-900/50 border-red-500 border">
            <div className="flex items-start gap-2">
              <X className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-300" />
              <div>
                <span className="font-medium">Error: </span>
                <span>{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Now Playing Bar (Mobile) */}
        {music.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 lg:hidden z-40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 truncate">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${getMoodColor()}`}
                >
                  {isPlaying ? (
                    <Volume2 className="w-5 h-5 text-white" />
                  ) : (
                    <Music className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="truncate">
                  <h3 className="font-medium truncate">
                    {music[currentIndex]?.title || `Song ${currentIndex + 1}`}
                  </h3>
                  <p className="text-xs text-gray-400 truncate">
                    {mood ? mood.charAt(0).toUpperCase() + mood.slice(1) : ""}{" "}
                    mood
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleNext}
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
