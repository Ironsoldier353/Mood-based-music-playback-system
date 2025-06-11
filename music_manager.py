import requests
from bs4 import BeautifulSoup
import random
import json
import time
import re
from typing import List, Dict, Optional
from urllib.parse import quote_plus
import streamlit as st

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

def render_playback_controls():
    """Render the playback controls UI"""
    if not st.session_state["video_urls"]:
        st.info("👈 Detect your mood first to see playback controls!")
        st.markdown("### 🎵 How it works:")
        st.markdown("1. **Capture** a selfie or select your mood")
        st.markdown("2. **Choose** your preferred language")
        st.markdown("3. **Add** specific preferences (optional)")
        st.markdown("4. **Click** 'Find My Music' to get started!")
        return

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

def render_now_playing():
    """Render the now playing section"""
    if not st.session_state["video_urls"]:
        return
        
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

def process_music_search(detected_mood: str, language: str, custom_input: str):
    """Process music search and update session state"""
    with st.spinner("🔍 Finding perfect music for your mood..."):
        search_queries = create_search_queries(detected_mood, language, custom_input)
        video_results = fetch_recommendations(search_queries, total=15)

        if video_results:
            # Update session state
            st.session_state["video_urls"] = [v["url"] for v in video_results]
            st.session_state["video_titles"] = [v["title"] for v in video_results]
            st.session_state["current_video_index"] = 0
            
            st.success(f"🎉 Found {len(video_results)} perfect tracks for your {detected_mood} mood!")
            return True
        else:
            st.error("😔 No videos found. Please try different preferences or check your internet connection.")
            return False