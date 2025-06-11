import os
import warnings
import tempfile
import numpy as np
from PIL import Image
from typing import Tuple
import streamlit as st

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

def analyze_emotion_deepface(img_bytes) -> Tuple[str, float]:
    """Analyze emotion using DeepFace with enhanced error handling"""
    if not DEEPFACE_AVAILABLE:
        st.warning(f"⚠️ DeepFace not available: {DEEPFACE_ERROR}")
        return "neutral", 50.0
    
    tmp_path = None
    try:
        pil_image = Image.open(img_bytes)
        
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
        
        # both single result and list of results
        if isinstance(result, list):
            result = result[0]
        
        dominant_emotion = result["dominant_emotion"]
        confidence = result["emotion"][dominant_emotion]
        
        # Clean up
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        # Validate results
        if dominant_emotion not in MOOD_KEYWORDS:
            st.warning(f"Unknown emotion detected: {dominant_emotion}, using neutral")
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
        st.error(f"❌ Emotion analysis failed: {error_msg}")
        
        # more specific error information
        if "No face" in error_msg:
            st.info("💡 Tip: Make sure your face is clearly visible and well-lit in the photo")
        elif "enforce_detection" in error_msg:
            st.info("💡 Tip: Try taking a clearer photo with better lighting")
        
        return "neutral", 50.0

def render_emotion_detection_ui():
    """Render the emotion detection UI components"""
    st.subheader("📸 Capture Your Mood")
    img_bytes = st.camera_input("Take a selfie to detect your emotion")
    
    manual_mood = None
    if not img_bytes:
        st.info("💡 No camera? No problem! Select your mood manually below:")
        manual_mood = st.selectbox(
            "🤔 How are you feeling?",
            [None, "happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"],
            format_func=lambda x: "Select your mood..." if x is None else x.title(),
        )
    
    return img_bytes, manual_mood

def process_emotion_detection(img_bytes, manual_mood):
    """Process emotion detection and return results"""
    if img_bytes is None and manual_mood is None:
        st.error("⚠️ Please capture an image or select your mood manually first!")
        return None, None

    detected_mood = manual_mood or "neutral"
    confidence = 100.0

    if img_bytes is not None:
        with st.spinner("🧠 Analyzing your emotion..."):
            detected_mood, confidence = analyze_emotion_deepface(img_bytes)

    st.success(f"😊 Detected Mood: **{detected_mood.title()}** (Confidence: {confidence:.1f}%)")
    return detected_mood, confidence