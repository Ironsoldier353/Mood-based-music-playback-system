from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import base64
import logging

# Import your existing modules
from emotion_detector import (
    is_deepface_available, 
    get_deepface_error,
    analyze_emotion_deepface,
    validate_emotion,
    get_supported_emotions
)
from music_manager import (
    create_search_queries,
    fetch_recommendations,
    SUPPORTED_LANGS,
    get_supported_languages,
    clear_search_history,
    get_search_history_stats
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Mood Music API",
    description="Music recommendation based on facial emotion from webcam captures with auto-clean functionality",
    version="1.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class WebcamCapture(BaseModel):
    image_data: str  # base64 encoded image
    language: str = "english"
    custom_preferences: Optional[str] = ""
    max_results: int = 15
    manual_mood: Optional[str] = None
    clear_history: bool = False  # Manual clear option (auto-clean happens automatically)

class EmotionResponse(BaseModel):
    emotion: str
    confidence: float
    deepface_available: bool

class VideoResult(BaseModel):
    url: str
    title: str

class MusicResponse(BaseModel):
    videos: List[VideoResult]
    total_count: int
    mood: str
    language: str
    search_stats: dict  # Includes auto-clean info

class SystemStatus(BaseModel):
    deepface_available: bool
    deepface_error: Optional[str]
    supported_emotions: List[str]
    supported_languages: List[str]
    search_history_stats: dict  # Includes auto-clean thresholds

class SessionResponse(BaseModel):
    message: str
    search_stats: dict

@app.get("/status", response_model=SystemStatus)
async def get_system_status():
    """Check system status and supported features"""
    return SystemStatus(
        deepface_available=is_deepface_available(),
        deepface_error=get_deepface_error() if not is_deepface_available() else None,
        supported_emotions=get_supported_emotions(),
        supported_languages=get_supported_languages(),
        search_history_stats=get_search_history_stats()
    )

@app.post("/clear-session", response_model=SessionResponse)
async def clear_session():
    """Manually clear search history for a fresh session"""
    try:
        clear_search_history()
        return SessionResponse(
            message="Search history cleared successfully",
            search_stats=get_search_history_stats()
        )
    except Exception as e:
        logger.error(f"Error clearing session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing session: {str(e)}")

@app.get("/search-stats", response_model=dict)
async def get_search_stats():
    """Get current search history statistics with auto-clean info"""
    stats = get_search_history_stats()
    return {
        **stats,
        "auto_clean_info": {
            "enabled": True,
            "threshold": stats.get("auto_clean_threshold", 45),
            "target_size": stats.get("target_size", 25),
            "description": "History automatically cleaned when exceeding threshold"
        }
    }

@app.post("/detect-mood", response_model=EmotionResponse)
async def detect_mood_from_webcam(capture: WebcamCapture):
    """Analyze emotion from webcam capture"""
    try:
        # Manual clear if requested (auto-clean happens automatically)
        if capture.clear_history:
            clear_search_history()
            logger.info("Search history manually cleared before mood detection")
        
        # Extract base64 image data (remove header if present)
        if "," in capture.image_data:
            header, image_data = capture.image_data.split(",", 1)
        else:
            image_data = capture.image_data
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Analyze emotion
        emotion, confidence = analyze_emotion_deepface(image_bytes)
        
        return EmotionResponse(
            emotion=emotion,
            confidence=confidence,
            deepface_available=is_deepface_available()
        )
        
    except Exception as e:
        logger.error(f"Error processing webcam image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.post("/get-music", response_model=MusicResponse)
async def get_music_recommendations(capture: WebcamCapture):
    """Get music recommendations based on webcam capture mood with auto-clean"""
    try:
        # Manual clear if requested (auto-clean happens automatically at threshold)
        if capture.clear_history:
            clear_search_history()
            logger.info("Search history manually cleared before music recommendation")
        
        # Use manual mood if provided, otherwise detect from image
        if capture.manual_mood:
            mood = capture.manual_mood.lower()
            if not validate_emotion(mood):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid manual mood. Must be one of: {get_supported_emotions()}"
                )
        else:
            # First detect mood
            mood_response = await detect_mood_from_webcam(capture)
            mood = mood_response.emotion
        
        # Validate language
        if capture.language.lower() not in SUPPORTED_LANGS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid language. Must be one of: {get_supported_languages()}"
            )
        
        # Get current search stats before fetching
        initial_stats = get_search_history_stats()
        logger.info(f"Starting search with {initial_stats['total_entries']} entries in history")
        
        # Create search queries
        search_queries = create_search_queries(
            mood,
            capture.language.lower(),
            capture.custom_preferences or ""
        )
        
        # Fetch recommendations (auto-clean happens automatically if threshold exceeded)
        video_results = fetch_recommendations(search_queries, total=capture.max_results)
        
        if not video_results:
            # If no results, try manual clear and search again
            logger.warning("No results found, manually clearing history and retrying")
            clear_search_history()
            video_results = fetch_recommendations(search_queries, total=capture.max_results)
            
            if not video_results:
                raise HTTPException(status_code=404, detail="No music found for the detected mood")
        
        # Get final search stats (may show auto-clean happened)
        final_stats = get_search_history_stats()
        
        return MusicResponse(
            videos=[VideoResult(url=v["url"], title=v["title"]) for v in video_results],
            total_count=len(video_results),
            mood=mood,
            language=capture.language,
            search_stats={
                **final_stats,
                "auto_clean_active": True,
                "notes": "History auto-manages at 45 entries, keeps 25 most recent"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting music recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting recommendations: {str(e)}")

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    stats = get_search_history_stats()
    return {
        "status": "healthy",
        "timestamp": "2025-06-29",
        "search_history": {
            "entries": stats.get("total_entries", 0),
            "auto_clean_enabled": True,
            "threshold": stats.get("auto_clean_threshold", 45)
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)