import streamlit as st

st.set_page_config(
    page_title="Mood Based Music Player", 
    layout="wide", 
    page_icon="🎵",
    initial_sidebar_state="expanded"
)

import os, warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# python

from pathlib import Path
import tempfile, random, json, time, re
from typing import List, Dict, Optional, Tuple
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup
import numpy as np
from PIL import Image

# Enhanced DeepFace import with better error handling
DEEPFACE_AVAILABLE = False
DEEPFACE_ERROR = None

try:
    import cv2
    import tensorflow as tf
    
    # suppress tf warnings
    tf.get_logger().setLevel('ERROR')
    
    # Import DeepFace with specific error handling
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

init_session_state()

# mood mapping with keywords for diverse search results
MOOD_KEYWORDS: Dict[str, Dict[str, List[str]]] = {
    "happy": {
        "english": ["upbeat", "cheerful", "energetic", "feel good", "party", "dance"],
        "hindi": ["khushi", "energetic", "party", "dance", "celebration", "bollywood dance"],
        "bengali": ["anondo", "energetic", "dance", "celebration", "upbeat", "rabindra sangeet"],
    },
    "sad": {
        "english": ["melancholy", "soulful", "heartbreak", "acoustic", "emotional"],
        "hindi": ["dukh", "gham", "sad", "soulful", "ghazal", "romantic sad"],
        "bengali": ["dukkho", "birohi", "sad", "mon kharap", "rabindra sangeet sad"],
    },
    "angry": {
        "english": ["intense", "rock", "aggressive", "hard", "metal","gym"],
        "hindi": ["gussa", "intense", "rock", "powerful", "hard rock","anger","adrenaline booster"],
        "bengali": ["intense", "rock", "powerful", "protest song"],
    },
    "fear": {
        "english": ["calming", "peaceful", "ambient", "relaxing", "meditation"],
        "hindi": ["shanti", "peaceful", "calming", "relax", "devotional"],
        "bengali": ["shanti", "peaceful", "calming", "relax", "spiritual"],
    },
    "surprise": {
        "english": ["exciting", "dynamic", "uplifting", "vibrant", "pop"],
        "hindi": ["exciting", "dynamic", "energetic", "josh", "bollywood upbeat"],
        "bengali": ["exciting", "dynamic", "energetic", "josh", "modern bengali"],
    },
    "disgust": {
        "english": ["alternative", "indie", "experimental", "underground"],
        "hindi": ["alternative", "indie", "unique", "alag", "fusion"],
        "bengali": ["alternative", "indie", "unique", "notun", "experimental bengali"],
    },
    "neutral": {
        "english": ["chill", "mellow", "easy listening", "ambient", "lofi"],
        "hindi": ["chill", "mellow", "smooth", "normal", "classical"],
        "bengali": ["chill", "mellow", "smooth", "normal", "adhunik"],
    },
}

SUPPORTED_LANGS = {"english", "hindi", "bengali"}


def safe_request(url: str, headers: dict, timeout: int = 10) -> Optional[requests.Response]:
    """Make a safe HTTP request with error handling"""
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response
    except requests.RequestException as e:
        st.error(f"Network error: {str(e)}")
        return None

def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
        r'(?:watch\?v=)([0-9A-Za-z_-]{11})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_youtube_results(query: str, max_results: int = 20) -> List[Dict[str, str]]:
    """Scrape YouTube search page for video links with improved error handling"""
    
    # Rate limiting
    current_time = time.time()
    if current_time - st.session_state.get("last_search_time", 0) < 1:
        time.sleep(1)
    st.session_state["last_search_time"] = current_time
    
    search_url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    }
    
    response = safe_request(search_url, headers, timeout=15)
    if not response:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    results: List[Dict[str, str]] = []
    
    try:
        for script in soup.find_all("script"):
            if "var ytInitialData" in script.text:
                try:
                    script_text = script.text
                    start = script_text.find("var ytInitialData = ") + len("var ytInitialData = ")
                    end = script_text.find(";</script>", start)
                    if end == -1:
                        end = script_text.find(";", start)
                    
                    json_str = script_text[start:end].strip()
                    if json_str.endswith('};'):
                        json_str = json_str[:-1]
                    elif json_str.endswith('}'):
                        pass
                    else:
                        json_str += '}'
                        
                    data = json.loads(json_str)
                    
                    contents = data.get("contents", {})
                    two_col = contents.get("twoColumnSearchResultsRenderer", {})
                    primary = two_col.get("primaryContents", {})
                    section_list = primary.get("sectionListRenderer", {})
                    sections = section_list.get("contents", [])
                    
                    for section in sections:
                        item_section = section.get("itemSectionRenderer", {})
                        items = item_section.get("contents", [])
                        
                        for item in items:
                            if "videoRenderer" in item:
                                video = item["videoRenderer"]
                                video_id = video.get("videoId")
                                if not video_id:
                                    continue
                                    
                                title_obj = video.get("title", {})
                                if "runs" in title_obj:
                                    title = title_obj["runs"][0].get("text", "Untitled")
                                elif "simpleText" in title_obj:
                                    title = title_obj["simpleText"]
                                else:
                                    title = "Untitled"
                                
                                url = f"https://www.youtube.com/watch?v={video_id}"
                                
                                if url not in st.session_state["search_history"]:
                                    results.append({"url": url, "title": title})
                                    st.session_state["search_history"].add(url)
                                    
                                if len(results) >= max_results:
                                    break
                        
                        if len(results) >= max_results:
                            break
                    break
                    
                except (json.JSONDecodeError, KeyError, IndexError) as e:
                    continue
        
        if not results:
            links = soup.find_all("a", href=True)
            for link in links:
                href = link.get("href", "")
                if "/watch?v=" in href:
                    video_id = extract_video_id(href)
                    if video_id:
                        title = link.get_text(strip=True) or "Untitled"
                        url = f"https://www.youtube.com/watch?v={video_id}"
                        
                        if url not in st.session_state["search_history"] and len(title) > 3:
                            results.append({"url": url, "title": title})
                            st.session_state["search_history"].add(url)
                            
                        if len(results) >= max_results:
                            break
                            
    except Exception as e:
        st.warning(f"Error parsing YouTube results: {str(e)}")
    
    return results

def create_search_queries(mood: str, language: str, custom: str = "") -> List[str]:
    """Create diverse search queries based on mood and language"""
    lang_key = language.lower()
    if lang_key not in SUPPORTED_LANGS:
        lang_key = "english"

    descriptors = MOOD_KEYWORDS.get(mood, MOOD_KEYWORDS["neutral"]).get(
        lang_key, MOOD_KEYWORDS["neutral"]["english"]
    )

    base_queries = [f"{desc} music {language}" for desc in descriptors[:4]]
    
    if custom.strip():
        custom_queries = [
            f"{custom} {mood} songs {language}",
            f"best {custom} {language} music",
            f"{custom} playlist {language}",
        ]
    else:
        custom_queries = [
            f"best {mood} songs {language}",
            f"{mood} playlist {language}",
            f"top {mood} music {language}",
            f"{language} {mood} hits",
        ]
    
    return base_queries + custom_queries

def fetch_recommendations(queries: List[str], total: int = 12) -> List[Dict[str, str]]:
    """Fetch video recommendations from multiple queries with progress tracking"""
    accumulated: List[Dict[str, str]] = []
    per_query = max(2, total // len(queries))
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    for i, query in enumerate(queries):
        status_text.text(f"🔍 Searching: {query}")
        
        batch_results = get_youtube_results(query, max_results=per_query)
        accumulated.extend(batch_results)
        
        progress = (i + 1) / len(queries)
        progress_bar.progress(progress)
        
        if len(accumulated) >= total:
            break
        
        time.sleep(0.5)
    
    progress_bar.empty()
    status_text.empty()

    seen_urls = set()
    unique_videos = []
    
    for video in accumulated:
        if video["url"] not in seen_urls:
            seen_urls.add(video["url"])
            unique_videos.append(video)

    random.shuffle(unique_videos)
    return unique_videos[:total]

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


# header
st.title("🎵 Facial Expression Driven Audio Playback System")
st.markdown("*Discover music that matches your mood using AI emotion detection*")

# Show DeepFace status at the top if there's an issue
if not DEEPFACE_AVAILABLE:
    st.warning(f"⚠️ **DeepFace Status:** Not Available - {DEEPFACE_ERROR}")
    st.info("🔧 **Quick Fix:** Try restarting the app or check if all dependencies are properly installed")

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

    search_button = st.button("🎶 Find My Music", type="primary", use_container_width=True)

    if search_button:
        if img_bytes is None and manual_mood is None:
            st.error("⚠️ Please capture an image or select your mood manually first!")
            st.stop()

        detected_mood = manual_mood or "neutral"
        confidence = 100.0

        if img_bytes is not None:
            with st.spinner("🧠 Analyzing your emotion..."):
                detected_mood, confidence = analyze_emotion_deepface(img_bytes)

        st.success(f"😊 Detected Mood: **{detected_mood.title()}** (Confidence: {confidence:.1f}%)")
        st.session_state["current_mood"] = detected_mood

        with st.spinner("🔍 Finding perfect music for your mood..."):
            search_queries = create_search_queries(detected_mood, language, custom_input)
            video_results = fetch_recommendations(search_queries, total=15)

            if video_results:
                # Update session state
                st.session_state["video_urls"] = [v["url"] for v in video_results]
                st.session_state["video_titles"] = [v["title"] for v in video_results]
                st.session_state["current_video_index"] = 0
                
                st.success(f"🎉 Found {len(video_results)} perfect tracks for your {detected_mood} mood!")
            else:
                st.error("😔 No videos found. Please try different preferences or check your internet connection.")

with right_col:
    st.header("🎮 Playback Controls")

    if st.session_state["video_urls"]:
        total_tracks = len(st.session_state["video_urls"])
        current_idx = st.session_state["current_video_index"]
        current_mood = st.session_state.get("current_mood", "Unknown")
        
        st.success(f"🎵 {total_tracks} songs in your *{current_mood.title()}* playlist")

        control_cols = st.columns(4)
        
        with control_cols[0]:
            if st.button("⏮️ Previous", use_container_width=True):
                if current_idx > 0:
                    st.session_state["current_video_index"] -= 1
                    st.rerun()

        with control_cols[1]:
            if st.button("🔀 Shuffle", use_container_width=True):
                combined = list(zip(st.session_state["video_urls"], st.session_state["video_titles"]))
                random.shuffle(combined)
                urls, titles = zip(*combined) if combined else ([], [])
                st.session_state["video_urls"] = list(urls)
                st.session_state["video_titles"] = list(titles)
                st.session_state["current_video_index"] = 0
                st.rerun()

        with control_cols[2]:
            if st.button("⏭️ Next", use_container_width=True):
                st.session_state["current_video_index"] = (current_idx + 1) % total_tracks
                st.rerun()
                
        with control_cols[3]:
            if st.button("🔄 Refresh", use_container_width=True):
                if st.session_state.get("current_mood"):
                    st.session_state["search_history"].clear()
                    st.rerun()

        st.subheader("🎯 Quick Track Selection")
        display_titles = [
            f"{i+1}. {title[:45]}{'...' if len(title) > 45 else ''}" 
            for i, title in enumerate(st.session_state["video_titles"])
        ]
        
        selected_track = st.selectbox(
            "Choose a track:",
            display_titles,
            index=current_idx,
            key="track_selector"
        )
        
        new_idx = int(selected_track.split(".")[0]) - 1
        if new_idx != current_idx:
            st.session_state["current_video_index"] = new_idx
            st.rerun()

    else:
        st.info("👈 Detect your mood first to see playback controls!")
        st.markdown("### 🎵 How it works:")
        st.markdown("1. **Capture** a selfie or select your mood")
        st.markdown("2. **Choose** your preferred language")
        st.markdown("3. **Add** specific preferences (optional)")
        st.markdown("4. **Click** 'Find My Music' to get started!")

if st.session_state["video_urls"]:
    st.markdown("---")
    
    current_idx = st.session_state["current_video_index"]
    current_url = st.session_state["video_urls"][current_idx]
    current_title = st.session_state["video_titles"][current_idx]
    current_mood = st.session_state.get("current_mood", "Unknown")

    st.header("🎵 Now Playing")
    st.subheader(current_title)
    
    try:
        st.video(current_url)
    except Exception as e:
        st.error(f"Error loading video: {str(e)}")
        st.markdown(f"[🔗 Open in YouTube]({current_url})")
    
    st.caption(f"Track {current_idx + 1} of {len(st.session_state['video_urls'])} • Mood: {current_mood.title()}")

    with st.expander("📋 View Full Playlist", expanded=False):
        for i, (url, title) in enumerate(zip(st.session_state["video_urls"], st.session_state["video_titles"])):
            icon = "🔊" if i == current_idx else "🎵"
            playing_indicator = " **(Currently Playing)**" if i == current_idx else ""
            st.markdown(f"{icon} **{i+1}.** {title}{playing_indicator}")

# Sidebar

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
    
    # if st.button("🔧 Test DeepFace", use_container_width=True):
    #     if DEEPFACE_AVAILABLE:
    #         st.success("✅ DeepFace is working correctly!")
    #     else:
    #         st.error(f"❌ DeepFace Error: {DEEPFACE_ERROR}")
    #         st.info("💡 Try restarting the application or reinstalling dependencies")
    
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
        deepface_status = "✅ Working" if DEEPFACE_AVAILABLE else f"❌ Error: {DEEPFACE_ERROR}"
        st.markdown(f"""
        - **DeepFace Status:** {deepface_status}
        - **Supported Languages:** English, Hindi, Bengali
        - **Supported Emotions:** Happy, Sad, Angry, Fear, Surprise, Disgust, Neutral
        - **Search History:** {len(st.session_state.get('search_history', set()))} unique videos
        """)
        
        if not DEEPFACE_AVAILABLE:
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
    