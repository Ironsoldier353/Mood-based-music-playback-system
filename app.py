import streamlit as st
from emotion_detector import (
    is_deepface_available, 
    get_deepface_error,
    render_emotion_detection_ui,
    process_emotion_detection
)
from music_manager import (
    render_playback_controls,
    render_now_playing,
    process_music_search
)
from sidebar import render_sidebar

# st configuration
st.set_page_config(
    page_title="Mood Based Music Player", 
    layout="wide", 
    page_icon="🎵",
    initial_sidebar_state="expanded"
)

# default session state keys
DEFAULT_KEYS = {
    "video_urls": [],
    "video_titles": [],
    "current_video_index": 0,
    "current_mood": None,
    "search_history": set(),
    "last_search_time": 0,
}

def init_session_state():
    """Initialize session state with default values"""
    for k, v in DEFAULT_KEYS.items():
        if k not in st.session_state:
            st.session_state[k] = v if not isinstance(v, set) else set()

def main():
    """Main application function"""
    init_session_state()
    
    st.title("🎵 Facial Expression Driven Audio Playback System")
    st.markdown("*Discover music that matches your mood using AI emotion detection*")

    # Show DeepFace status at the top if there's an issue
    if not is_deepface_available():
        st.warning(f"⚠️ **DeepFace Status:** Not Available - {get_deepface_error()}")
        st.info("🔧 **Quick Fix:** Try restarting the app or check if all dependencies are properly installed")

    # main layout
    left_col, right_col = st.columns([1, 1])

    with left_col:
        st.header("🎭 Mood Detection & Music Search")

        language = st.selectbox(
            "🌍 Preferred Language", 
            ["English", "Hindi", "Bengali"], 
            index=0,
            help="Select your preferred language for music recommendations"
        )
        
        custom_input = st.text_input(
            "🎯 Optional: Add specific preferences",
            placeholder="e.g., Arijit Singh, acoustic, 90s, rock, classical...",
            help="Add artist names, genres, or any specific preferences"
        )

        img_bytes, manual_mood = render_emotion_detection_ui()
        
        search_button = st.button("🎶 Find My Music", type="primary", use_container_width=True)

        if search_button:
            detected_mood, confidence = process_emotion_detection(img_bytes, manual_mood)
            
            if detected_mood and confidence:
                st.session_state["current_mood"] = detected_mood
                
                process_music_search(detected_mood, language, custom_input)

    with right_col:
        st.header("🎮 Playback Controls")
        render_playback_controls()

    render_now_playing()

    render_sidebar()

if __name__ == "__main__":
    main()