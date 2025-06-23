import os
import warnings
import tempfile
import numpy as np
from PIL import Image
from typing import Tuple, Union, BinaryIO
import io

# Suppress TensorFlow warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

DEEPFACE_AVAILABLE = False
DEEPFACE_ERROR = None

try:
    import cv2
    import tensorflow as tf
    
    # suppress tf warnings
    tf.get_logger().setLevel('ERROR')
    
    from deepface import DeepFace
    
    # test DeepFace with a dummy analysis to ensure it's working
    # create a small test image
    test_img = np.ones((48, 48, 3), dtype=np.uint8) * 128
    test_path = "temp_test.jpg"
    cv2.imwrite(test_path, test_img)
    
    try:
        _ = DeepFace.analyze(
            img_path=test_path,
            actions=["emotion"],
            enforce_detection=False,
            silent=True
        )
        DEEPFACE_AVAILABLE = True
        os.remove(test_path)
    except Exception as test_error:
        DEEPFACE_ERROR = f"DeepFace test failed: {str(test_error)}"
        if os.path.exists(test_path):
            os.remove(test_path)
    
except ImportError as e:
    DEEPFACE_ERROR = f"Import error: {str(e)}"
except Exception as e:
    DEEPFACE_ERROR = f"DeepFace initialization error: {str(e)}"

# mood keywords for validation
MOOD_KEYWORDS = {
    "happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"
}

def is_deepface_available() -> bool:
    """Check if DeepFace is available for use"""
    return DEEPFACE_AVAILABLE

def get_deepface_error() -> str:
    """Get the DeepFace error message if any"""
    return DEEPFACE_ERROR or "No error"

def analyze_emotion_deepface(img_input: Union[BinaryIO, io.BytesIO, bytes]) -> Tuple[str, float]:
    """
    Analyze emotion using DeepFace with enhanced error handling
    
    Args:
        img_input: Can be a file-like object, BytesIO, or bytes
        
    Returns:
        Tuple of (emotion, confidence)
    """
    if not DEEPFACE_AVAILABLE:
        print(f"⚠ DeepFace not available: {DEEPFACE_ERROR}")
        return "neutral", 50.0
    
    tmp_path = None
    try:
        # Handle different input types
        if isinstance(img_input, bytes):
            pil_image = Image.open(io.BytesIO(img_input))
        elif isinstance(img_input, (io.BytesIO, BinaryIO)):
            # Reset position if it's seekable
            if hasattr(img_input, 'seek'):
                img_input.seek(0)
            pil_image = Image.open(img_input)
        else:
            raise ValueError("Unsupported image input type")
        
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        img_array = np.array(pil_image)
        
        # create temporary file
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_file:
            tmp_path = tmp_file.name
            
        pil_image.save(tmp_path, 'JPEG')
        
        if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            raise Exception("Failed to save temporary image file")
        
        # analyze with DeepFace
        result = DeepFace.analyze(
            img_path=tmp_path,
            actions=["emotion"],
            enforce_detection=False,
            silent=True
        )
        
        # handle both single result and list of results
        if isinstance(result, list):
            result = result[0]
        
        dominant_emotion = result["dominant_emotion"]
        confidence = result["emotion"][dominant_emotion]
        
        # Clean up
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        # Validate results
        if dominant_emotion not in MOOD_KEYWORDS:
            print(f"Unknown emotion detected: {dominant_emotion}, using neutral")
            return "neutral", confidence
            
        return dominant_emotion, confidence
        
    except Exception as e:
        # Clean up on error
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass
        
        error_msg = str(e)
        print(f"❌ Emotion analysis failed: {error_msg}")
        
        # Provide more specific error information
        if "No face" in error_msg:
            print("💡 Tip: Make sure your face is clearly visible and well-lit in the photo")
        elif "enforce_detection" in error_msg:
            print("💡 Tip: Try taking a clearer photo with better lighting")
        
        return "neutral", 50.0

def validate_emotion(emotion: str) -> bool:
    """Validate if the emotion is supported"""
    return emotion.lower() in MOOD_KEYWORDS

def get_supported_emotions() -> list:
    """Get list of supported emotions"""
    return list(MOOD_KEYWORDS)