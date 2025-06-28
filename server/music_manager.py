import requests
from bs4 import BeautifulSoup
import random
import json
import time
import re
from typing import List, Dict, Optional, Set
from urllib.parse import quote_plus
import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Session-based search history with automatic cleanup
class SearchHistoryManager:
    def __init__(self, max_age_minutes: int = 30, auto_clean_threshold: int = 45, target_size: int = 25):
        self.history: Dict[str, datetime] = {}
        self.max_age = timedelta(minutes=max_age_minutes)
        self.auto_clean_threshold = auto_clean_threshold  # Auto-clean when entries exceed this
        self.target_size = target_size  # Target size after cleaning
    
    def add_url(self, url: str):
        """Add URL to history with timestamp and auto-clean if needed"""
        # Always cleanup old entries first
        self.cleanup_old_entries()
        
        # Add the new URL
        self.history[url] = datetime.now()
        
        # Auto-clean if we exceed the threshold
        if len(self.history) > self.auto_clean_threshold:
            self._auto_clean()
    
    def is_duplicate(self, url: str) -> bool:
        """Check if URL was recently searched"""
        self.cleanup_old_entries()
        return url in self.history
    
    def cleanup_old_entries(self):
        """Remove entries older than max_age"""
        cutoff_time = datetime.now() - self.max_age
        expired_urls = [url for url, timestamp in self.history.items() if timestamp < cutoff_time]
        for url in expired_urls:
            del self.history[url]
    
    def _auto_clean(self):
        """Automatically clean entries when threshold is exceeded"""
        if len(self.history) <= self.target_size:
            return
        
        # Sort by timestamp (oldest first) and keep only the most recent target_size entries
        sorted_entries = sorted(self.history.items(), key=lambda x: x[1], reverse=True)
        
        # Keep only the most recent entries
        entries_to_keep = sorted_entries[:self.target_size]
        
        # Clear and rebuild with recent entries
        self.history.clear()
        for url, timestamp in entries_to_keep:
            self.history[url] = timestamp
        
        logger.info(f"Auto-cleaned search history: kept {len(self.history)} most recent entries")
    
    def clear_session(self):
        """Clear all history for new session"""
        self.history.clear()
    
    def get_stats(self) -> Dict[str, int]:
        """Get history statistics"""
        self.cleanup_old_entries()
        return {
            "total_entries": len(self.history),
            "auto_clean_threshold": self.auto_clean_threshold,
            "target_size": self.target_size
        }

# Global search history manager with auto-clean at 45 entries, target 25
search_history_manager = SearchHistoryManager(
    max_age_minutes=30, 
    auto_clean_threshold=45, 
    target_size=25
)
last_search_time = 0

# mood mapping with keywords for diverse search results
MOOD_KEYWORDS: Dict[str, Dict[str, List[str]]] = {
    "happy": {
        "english": ["upbeat", "cheerful", "energetic", "feel good", "party", "dance"],
        "hindi": ["upbeat","bollywood dance", "energetic", "party", "dance", "celebration"],
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
        logger.error(f"Network error: {str(e)}")
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

def get_youtube_results(query: str, max_results: int = 20, allow_duplicates: bool = False) -> List[Dict[str, str]]:
    """Scrape YouTube search page for video links with improved error handling"""
    global last_search_time
    
    # Rate limiting
    current_time = time.time()
    if current_time - last_search_time < 1:
        time.sleep(1)
    last_search_time = current_time
    
    search_url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,/;q=0.8",
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
        # Try to extract from JSON data first
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
                                
                                # Check for duplicates only if not allowing them
                                if allow_duplicates or not search_history_manager.is_duplicate(url):
                                    results.append({"url": url, "title": title})
                                    search_history_manager.add_url(url)
                                    
                                if len(results) >= max_results:
                                    break
                        
                        if len(results) >= max_results:
                            break
                    break
                    
                except (json.JSONDecodeError, KeyError, IndexError) as e:
                    logger.warning(f"JSON parsing failed: {e}")
                    continue
        
        # Fallback to HTML parsing if JSON method fails
        if not results:
            links = soup.find_all("a", href=True)
            for link in links:
                href = link.get("href", "")
                if "/watch?v=" in href:
                    video_id = extract_video_id(href)
                    if video_id:
                        title = link.get_text(strip=True) or "Untitled"
                        url = f"https://www.youtube.com/watch?v={video_id}"
                        
                        # Check for duplicates only if not allowing them
                        if (allow_duplicates or not search_history_manager.is_duplicate(url)) and len(title) > 3:
                            results.append({"url": url, "title": title})
                            search_history_manager.add_url(url)
                            
                        if len(results) >= max_results:
                            break
                            
    except Exception as e:
        logger.error(f"Error parsing YouTube results: {str(e)}")
    
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

def fetch_recommendations(queries: List[str], total: int = 20) -> List[Dict[str, str]]:
    """Fetch video recommendations from multiple queries - ENHANCED VERSION with fallback"""
    accumulated: List[Dict[str, str]] = []
    max_attempts = 3
    min_per_query = 3
    
    logger.info(f"Fetching up to {total} recommendations from {len(queries)} queries")
    logger.info(f"Search history stats: {search_history_manager.get_stats()}")
    
    # First pass: Try to get fresh results
    for query in queries:
        attempts = 0
        while attempts < max_attempts:
            try:
                remaining = total - len(accumulated)
                per_query = max(min_per_query, remaining // max(1, len(queries) - queries.index(query)))
                
                logger.info(f"Attempt {attempts + 1} for: {query} (target: {per_query} results)")
                
                batch_results = get_youtube_results(query, max_results=per_query, allow_duplicates=False)
                if batch_results:
                    accumulated.extend(batch_results)
                    break
                    
            except Exception as e:
                logger.warning(f"Attempt {attempts + 1} failed: {str(e)}")
            
            attempts += 1
            if attempts < max_attempts:
                time.sleep(2 ** attempts)
        
        if len(accumulated) >= total:
            break
    
    # Fallback: If we don't have enough results, allow some duplicates
    if len(accumulated) < total // 2:  # Less than 50% of target
        logger.warning(f"Only got {len(accumulated)} results, trying fallback with duplicates allowed")
        
        # Clear some recent history to allow more results
        search_history_manager.cleanup_old_entries()
        
        for query in queries[:3]:
            try:
                remaining = total - len(accumulated)
                if remaining <= 0:
                    break
                    
                fallback_results = get_youtube_results(
                    query, 
                    max_results=remaining, 
                    allow_duplicates=True
                )
                accumulated.extend(fallback_results)
                
            except Exception as e:
                logger.warning(f"Fallback search failed: {str(e)}")
    
    # Enhanced deduplication by video ID
    seen_ids = set()
    unique_videos = []
    for video in accumulated:
        vid_id = extract_video_id(video["url"])
        if vid_id and vid_id not in seen_ids:
            seen_ids.add(vid_id)
            unique_videos.append(video)
    
    # Final shuffle and trim
    random.shuffle(unique_videos)
    final_results = unique_videos[:total]
    
    logger.info(f"Returning {len(final_results)} unique recommendations")
    return final_results

def clear_search_history():
    """Clear the search history - useful for new sessions"""
    search_history_manager.clear_session()
    logger.info("Search history cleared")

def get_search_history_stats() -> Dict[str, int]:
    """Get search history statistics"""
    return search_history_manager.get_stats()

def get_mood_keywords(mood: str, language: str) -> List[str]:
    """Get mood keywords for a specific mood and language"""
    lang_key = language.lower()
    if lang_key not in SUPPORTED_LANGS:
        lang_key = "english"
    
    return MOOD_KEYWORDS.get(mood, MOOD_KEYWORDS["neutral"]).get(
        lang_key, MOOD_KEYWORDS["neutral"]["english"]
    )

def validate_language(language: str) -> bool:
    """Validate if the language is supported"""
    return language.lower() in SUPPORTED_LANGS

def get_supported_languages() -> List[str]:
    """Get list of supported languages"""
    return list(SUPPORTED_LANGS)