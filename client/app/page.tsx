'use client';
import { useState, useRef, useEffect } from 'react';
import { Camera, Music, Heart, Smile, Frown, Volume2, X, Settings, SkipBack, SkipForward, Shuffle, Pause, Play } from 'lucide-react';
import ReactPlayer from 'react-player/youtube';

interface VideoElement extends HTMLVideoElement {
  srcObject: MediaStream | null;
}

interface Song {
  url: string;
  title: string;
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

export default function MoodMusicPlayer() {
  const videoRef = useRef<VideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [music, setMusic] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('english');
  const [preferences, setPreferences] = useState<string>('');
  const [webcamReady, setWebcamReady] = useState<boolean>(false);
  const [playlistSize, setPlaylistSize] = useState<number>(10); // New state for playlist size

  // Start webcam
  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setWebcamReady(true);
          };
        }
      } catch (err) {
        setError("Could not access webcam. Please ensure camera permissions are granted.");
        console.error('Webcam error:', err);
      }
    };

    startWebcam();
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const captureAndAnalyze = async () => {
    if (!webcamReady) {
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
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Updated API call with playlistSize
      const response = await fetch('http://localhost:8000/get-music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageData,
          language: language,
          custom_preferences: preferences,
          max_results: playlistSize // Use the selected playlist size
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to analyze mood");
      }

      const data: MusicResponse = await response.json();
      
      setMood(data.mood);
      setMusic(data.videos);
      setCurrentIndex(0);
      setIsPlaying(true);
      
      const moodResponse = await fetch('http://localhost:8000/detect-mood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageData,
          language: language,
          custom_preferences: preferences,
          max_results: playlistSize
        }),
      });
      
      if (moodResponse.ok) {
        const moodData: EmotionResponse = await moodResponse.json();
        setConfidence(moodData.confidence);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze mood. Please try again.");
      console.error('Capture error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMoodIcon = () => {
    if (!mood) return <Heart className="w-6 h-6 text-pink-400" />;
    
    const moodLower = mood.toLowerCase();
    if (moodLower.includes('happy')) {
      return <Smile className="w-6 h-6 text-yellow-400" />;
    } else if (moodLower.includes('sad')) {
      return <Frown className="w-6 h-6 text-blue-400" />;
    }
    return <Heart className="w-6 h-6 text-pink-400" />;
  };

  const clearResults = () => {
    setMood(null);
    setMusic([]);
    setError(null);
    setConfidence(0);
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
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % music.length);
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Music className="w-10 h-10 text-purple-400" />
            Mood Music Player
          </h1>
          <p className="text-gray-400 text-lg">
            AI-powered mood detection and music recommendations
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Webcam Section */}
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Camera
            </h2>
            
            <div className="relative rounded-lg overflow-hidden bg-black mb-4" style={{aspectRatio: '4/3'}}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              {!webcamReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                  <div className="text-center text-gray-400">
                    <Camera className="w-12 h-12 mx-auto mb-2" />
                    <p>Loading camera...</p>
                  </div>
                </div>
              )}
            </div>
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            <button 
              onClick={captureAndAnalyze} 
              disabled={loading || !webcamReady}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Capture & Analyze Mood
                </>
              )}
            </button>
          </div>

          {/* Settings Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="bengali">Bengali</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Music Preferences
                </label>
                <input
                  type="text"
                  placeholder="e.g., rock, jazz, pop"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* New Playlist Size Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Playlist Size
                </label>
                <select
                  value={playlistSize}
                  onChange={(e) => setPlaylistSize(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={5}>5 songs</option>
                  <option value={10}>10 songs</option>
                  <option value={15}>15 songs</option>
                  <option value={20}>20 songs</option>
                </select>
              </div>

              {(mood || error) && (
                <button 
                  onClick={clearResults}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Results
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-900/50 border border-red-500 rounded-lg p-4">
            <div className="flex items-start gap-2 text-red-200">
              <X className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">Error: </span>
                <span>{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {mood && (
          <div className="mt-6 space-y-6">
            {/* Mood Display */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                {getMoodIcon()}
                <div>
                  <h2 className="text-2xl font-bold capitalize">
                    Mood: {mood}
                  </h2>
                  {confidence > 0 && (
                    <p className="text-gray-400">
                      Confidence: {Math.round(confidence)}%
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Music Player */}
            {music.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Now Playing: {music[currentIndex]?.title || `Song ${currentIndex + 1}`}
                </h2>

                <div className="mb-4">
                  <ReactPlayer 
                    url={music[currentIndex]?.url} 
                    playing={isPlaying} 
                    controls={false} 
                    width="100%" 
                    height="360px" 
                  />
                </div>

                {/* Player Controls */}
                <div className="flex justify-center gap-4 mt-4">
                  <button 
                    onClick={handlePrevious} 
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
                    aria-label="Previous song"
                  >
                    <SkipBack className="w-6 h-6 text-white" />
                  </button>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)} 
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
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
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
                    aria-label="Next song"
                  >
                    <SkipForward className="w-6 h-6 text-white" />
                  </button>
                  <button 
                    onClick={shuffleMusic} 
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
                    aria-label="Shuffle playlist"
                  >
                    <Shuffle className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Playlist */}
            {music.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Playlist ({music.length} songs)
                </h2>
                
                <div className="space-y-3">
                  {music.map((song, index) => (
                    <div 
                      key={index} 
                      className={`bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer ${index === currentIndex ? 'ring-2 ring-purple-500' : ''}`}
                      onClick={() => {
                        setCurrentIndex(index);
                        setIsPlaying(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${index === currentIndex ? 'bg-purple-600' : 'bg-gray-600'}`}>
                          {index === currentIndex && isPlaying ? (
                            <Volume2 className="w-5 h-5 text-white" />
                          ) : (
                            <Music className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-white font-medium">
                            {song.title || `Song ${index + 1}`}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {index === currentIndex ? 'Now Playing' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}