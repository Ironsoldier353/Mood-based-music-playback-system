import streamlit as st
from emotion_detector import is_deepface_available, get_deepface_error

def render_sidebar():
    """Render the sidebar with settings and options"""
    with st.sidebar:
        st.header("⚙️ Settings & Options")
        
        if st.button("🗑️ Clear Playlist", use_container_width=True):
            for key in ["video_urls", "video_titles", "current_video_index", "current_mood"]:
                if key in st.session_state:
                    if key == "current_video_index":
                        st.session_state[key] = 0
                    elif key in ["video_urls", "video_titles"]:
                        st.session_state[key] = []
                    else:
                        st.session_state[key] = None
            st.success("✅ Playlist cleared!")
            st.rerun()
        
        if st.button("🔄 Reset Search History", use_container_width=True):
            st.session_state["search_history"] = set()
            st.success("✅ Search history cleared!")
        
        st.markdown("---")
        
        st.subheader("ℹ️ About")
        st.markdown("""
        **Emotion-Aware Music Player** uses AI to detect your facial emotions and recommends music that matches your mood.
        
        **Features:**
        - 🎭 Real-time emotion detection
        - 🌍 Multi-language support
        - 🎵 Curated playlists
        - 🔀 Playlist controls
        """)
        
        with st.expander("🔧 Technical Details"):
            deepface_status = "✅ Working" if is_deepface_available() else f"❌ Error: {get_deepface_error()}"
            st.markdown(f"""
            - **DeepFace Status:** {deepface_status}
            - **Supported Languages:** English, Hindi, Bengali
            - **Supported Emotions:** Happy, Sad, Angry, Fear, Surprise, Disgust, Neutral
            - **Search History:** {len(st.session_state.get('search_history', set()))} unique videos
            """)
            
            if not is_deepface_available():
                st.markdown("### 🔧 Troubleshooting:")
                st.markdown("""
                1. **Restart** the Streamlit app
                2. **Check** if all dependencies are installed:
                   ```
                   pip install deepface opencv-python tensorflow
                   ```
                3. **Verify** camera permissions
                4. **Try** manual mood selection as fallback
                """)
        
        st.markdown("---")