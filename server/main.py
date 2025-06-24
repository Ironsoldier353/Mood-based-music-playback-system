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
    get_supported_languages
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Mood Music API",
    description="Music recommendation based on facial emotion from webcam captures",
    version="1.0.0"
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

class SystemStatus(BaseModel):
    deepface_available: bool
    deepface_error: Optional[str]
    supported_emotions: List[str]
    supported_languages: List[str]

@app.get("/status", response_model=SystemStatus)
async def get_system_status():
    """Check system status and supported features"""
    return SystemStatus(
        deepface_available=is_deepface_available(),
        deepface_error=get_deepface_error() if not is_deepface_available() else None,
        supported_emotions=get_supported_emotions(),
        supported_languages=get_supported_languages()
    )

@app.post("/detect-mood", response_model=EmotionResponse)
async def detect_mood_from_webcam(capture: WebcamCapture):
    """Analyze emotion from webcam capture"""
    try:
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
    """Get music recommendations based on webcam capture mood"""
    try:
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
        
        # Create search queries
        search_queries = create_search_queries(
            mood,
            capture.language.lower(),
            capture.custom_preferences or ""
        )
        
        # Fetch recommendations
        video_results = fetch_recommendations(search_queries, total=capture.max_results)
        
        if not video_results:
            raise HTTPException(status_code=404, detail="No music found for the detected mood")
        
        return MusicResponse(
            videos=[VideoResult(url=v["url"], title=v["title"]) for v in video_results],
            total_count=len(video_results),
            mood=mood,
            language=capture.language
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting music recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting recommendations: {str(e)}")
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)