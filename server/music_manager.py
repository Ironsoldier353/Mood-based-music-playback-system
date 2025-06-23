import requests
from bs4 import BeautifulSoup
import random
import json
import time
import re
from typing import List, Dict, Optional, Set
from urllib.parse import quote_plus
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global search history to avoid duplicate results
search_history: Set[str] = set()
last_search_time = 0

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

def get_youtube_results(query: str, max_results: int = 20) -> List[Dict[str, str]]:
    """Scrape YouTube search page for video links with improved error handling"""
    global last_search_time, search_history
    
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
                                
                                if url not in search_history:
                                    results.append({"url": url, "title": title})
                                    search_history.add(url)
                                    
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
                        
                        if url not in search_history and len(title) > 3:
                            results.append({"url": url, "title": title})
                            search_history.add(url)
                            
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
# In music_manager.py

def fetch_recommendations(queries: List[str], total: int = 20) -> List[Dict[str, str]]:
    """Fetch video recommendations from multiple queries - ENHANCED VERSION"""
    accumulated: List[Dict[str, str]] = []
    max_attempts = 3  # Number of retry attempts per query
    min_per_query = 3  # Minimum results to fetch per query
    
    logger.info(f"Fetching up to {total} recommendations from {len(queries)} queries")
    
    for query in queries:
        attempts = 0
        while attempts < max_attempts:
            try:
                # Dynamically adjust per-query targets based on remaining needs
                remaining = total - len(accumulated)
                per_query = max(min_per_query, remaining // max(1, len(queries) - queries.index(query)))
                
                logger.info(f"Attempt {attempts + 1} for: {query} (target: {per_query} results)")
                
                batch_results = get_youtube_results(query, max_results=per_query)
                if batch_results:
                    accumulated.extend(batch_results)
                    break  # Success - move to next query
                    
            except Exception as e:
                logger.warning(f"Attempt {attempts + 1} failed: {str(e)}")
            
            attempts += 1
            if attempts < max_attempts:
                time.sleep(2 ** attempts)  # Exponential backoff
        
        if len(accumulated) >= total:
            break
    
    # Enhanced deduplication
    seen_urls = set()
    unique_videos = []
    for video in accumulated:
        vid = video["url"].split("v=")[-1][:11]  # Normalize YouTube IDs
        if vid not in seen_urls:
            seen_urls.add(vid)
            unique_videos.append(video)
    
    # Final shuffle and trim
    random.shuffle(unique_videos)
    return unique_videos[:total]

def clear_search_history():
    """Clear the search history"""
    global search_history
    search_history.clear()

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