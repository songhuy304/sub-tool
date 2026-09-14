import json
import logging
import random
import re
import string
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, List, Optional, Tuple
from urllib.parse import quote, urlencode, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.common.abogus import ABogus

logger = logging.getLogger(__name__)

USER_POST = "https://www.douyin.com/aweme/v1/web/aweme/post/?"
POST_DETAIL = "https://www.douyin.com/aweme/v1/web/aweme/detail/?"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
DOUYIN_HOSTS = ("douyin.com", "iesdouyin.com")
URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)

COMMON_PARAMS = {
    "device_platform": "webapp",
    "aid": "6383",
    "channel": "channel_pc_web",
    "pc_client_type": "1",
    "version_code": "190500",
    "version_name": "19.5.0",
    "cookie_enabled": "true",
    "screen_width": "1920",
    "screen_height": "1080",
    "browser_language": "zh-CN",
    "browser_platform": "Win32",
    "browser_name": "Chrome",
    "browser_version": "122.0.0.0",
    "browser_online": "true",
    "engine_name": "Blink",
    "engine_version": "122.0.0.0",
    "os_name": "Windows",
    "os_version": "10",
    "cpu_core_num": "8",
    "device_memory": "8",
    "platform": "PC",
    "downlink": "10",
    "effective_type": "4g",
    "round_trip_time": "50",
    "update_version_code": "170400",
}


class UnsupportedDouyinLink(ValueError):
    def __init__(self, message: str = "UNSUPPORTED_LINK"):
        super().__init__(message)


class DouyinCookieError(RuntimeError):
    """Raised when Douyin blocks the request and a browser cookie is needed."""


# Common Douyin web status codes that mean login / anti-bot / cookie issues.
COOKIE_STATUS_CODES = {8, 2154, 2156, 2096}


@dataclass
class VideoItem:
    aweme_id: str
    title: str
    play_url: str
    nickname: Optional[str] = None


ProgressCb = Callable[[int, int], None]


def extract_url(raw: str) -> str:
    match = URL_RE.search(raw or "")
    if not match:
        raise UnsupportedDouyinLink("INVALID_URL")
    return match.group(0).rstrip(".,);")


def is_douyin_host(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == item or host.endswith("." + item) for item in DOUYIN_HOSTS)


def first_url(value) -> Optional[str]:
    if isinstance(value, list) and value and isinstance(value[0], str):
        return value[0]
    return None


def pick_play_url(aweme: dict) -> Optional[str]:
    video = aweme.get("video") or {}
    bit_rate = video.get("bit_rate") or []
    if isinstance(bit_rate, list) and bit_rate:
        play = (bit_rate[0] or {}).get("play_addr") or {}
        url = first_url(play.get("url_list"))
        if url:
            return url
    play_addr = video.get("play_addr") or {}
    return first_url(play_addr.get("url_list"))


def normalize_aweme(aweme: dict) -> Optional[VideoItem]:
    if not aweme:
        return None
    if aweme.get("images"):
        return None
    aweme_id = str(aweme.get("aweme_id") or "")
    play_url = pick_play_url(aweme)
    if not aweme_id or not play_url:
        return None
    desc = str(aweme.get("desc") or "").strip()
    author = aweme.get("author") or {}
    return VideoItem(
        aweme_id=aweme_id,
        title=desc or f"video_{aweme_id}",
        play_url=play_url,
        nickname=str(author.get("nickname") or "") or None,
    )


def cookie_ms_token(cookie: Optional[str]) -> str:
    if not cookie:
        return ""
    match = re.search(r"(?:^|;\s*)msToken=([^;]+)", cookie)
    return match.group(1) if match else ""


def random_ms_token(length: int = 107) -> str:
    chars = string.ascii_letters + string.digits + "="
    return "".join(random.choice(chars) for _ in range(length))


def fetch_ttwid(session: requests.Session) -> str:
    payload = {
        "region": "cn",
        "aid": 1768,
        "needFid": False,
        "service": "www.ixigua.com",
        "migrate_info": {"ticket": "", "source": "node"},
        "cbUrlProtocol": "https",
        "union": True,
    }
    try:
        response = session.post(
            "https://ttwid.bytedance.com/ttwid/union/register/",
            data=json.dumps(payload),
            timeout=10,
        )
        return response.cookies.get("ttwid") or ""
    except Exception as exc:
        logger.warning("Cannot fetch ttwid: %s", exc)
        return ""


def build_guest_cookie(session: requests.Session) -> str:
    ttwid = fetch_ttwid(session)
    return (
        f"msToken={random_ms_token()}; ttwid={ttwid}; "
        "odin_tt=324fb4ea4a89c0c05827e18a1ed9cf9bf8a17f7705fcc793fec935b637867e2a5a9b8168c885554d029919117a18ba69; "
        "passport_csrf_token=f61602fc63757ae0e4fd9d6bdcee4810;"
    )


def parse_link(url: str) -> Tuple[Optional[str], Optional[str]]:
    path = urlparse(url).path or ""
    if "/user/" in path:
        key = re.findall(r"/user/([^/?]+)", path)
        return ("user", key[0]) if key else (None, None)
    if "/video/" in path:
        key = re.findall(r"/video/(\d+)", path)
        return ("aweme", key[0]) if key else (None, None)
    if "/note/" in path:
        key = re.findall(r"/note/(\d+)", path)
        return ("aweme", key[0]) if key else (None, None)
    return None, None


class DouyinDownloader:
    def __init__(self, cookie: Optional[str] = None, timeout: int = 30):
        self.timeout = timeout
        self.session = requests.Session()
        retries = Retry(
            total=2,
            backoff_factor=0.2,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["HEAD", "GET"],
        )
        adapter = HTTPAdapter(max_retries=retries, pool_connections=20, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.headers = {
            "User-Agent": UA,
            "referer": "https://www.douyin.com/",
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }
        provided = (cookie or "").strip()
        self.has_user_cookie = bool(provided)
        self.cookie = provided or build_guest_cookie(self.session)
        self.headers["Cookie"] = self.cookie
        self._warmed = False

    def expand(self, url: str, limit: int = 0) -> List[VideoItem]:
        kind, key = self.resolve(url)
        if kind == "aweme":
            item = self.fetch_aweme(key)
            return [item] if item else []
        if kind == "user":
            return self.fetch_user_posts(key, limit=limit)
        raise UnsupportedDouyinLink("UNSUPPORTED_LINK")

    def resolve(self, raw_url: str) -> tuple[str, str]:
        url = extract_url(raw_url)
        if not is_douyin_host(url):
            raise UnsupportedDouyinLink("INVALID_URL")
        kind, key = parse_link(url)
        if kind and key:
            return kind, key
        response = self.session.get(
            url,
            headers=self.headers,
            timeout=self.timeout,
            allow_redirects=True,
        )
        kind, key = parse_link(response.url or url)
        if kind and key:
            return kind, key
        raise UnsupportedDouyinLink("UNSUPPORTED_LINK")

    def fetch_aweme(self, aweme_id: str) -> Optional[VideoItem]:
        params = {
            **COMMON_PARAMS,
            "aweme_id": aweme_id,
            "version_code": "290100",
            "version_name": "29.1.0",
            "from_user_page": "1",
            "locate_query": "false",
            "need_time_list": "1",
            "pc_libra_divert": "Windows",
            "publish_video_strategy_type": "2",
            "show_live_replay_strategy": "1",
            "time_list_query": "0",
            "whale_cut_token": "",
            "msToken": cookie_ms_token(self.cookie),
        }
        data = self._get_json(POST_DETAIL, params)
        detail = (data or {}).get("aweme_detail") or {}
        item = normalize_aweme(detail)
        if not item:
            raise RuntimeError("NO_VIDEO")
        return item

    def fetch_user_posts(self, sec_uid: str, limit: int = 0) -> List[VideoItem]:
        items: List[VideoItem] = []
        cursor = 0
        page_size = 18
        max_items = limit if limit and limit > 0 else 50
        consecutive_errors = 0

        while len(items) < max_items:
            params = {
                **COMMON_PARAMS,
                "sec_user_id": sec_uid,
                "count": str(page_size),
                "max_cursor": str(cursor),
                "locate_query": "false",
                "show_live_replay_strategy": "1",
                "need_time_list": "1",
                "time_list_query": "0",
                "whale_cut_token": "",
                "publish_video_strategy_type": "2",
                "msToken": cookie_ms_token(self.cookie),
            }
            try:
                data = self._get_json(USER_POST, params)
                consecutive_errors = 0
            except Exception as exc:
                consecutive_errors += 1
                logger.warning("User posts fetch failed: %s", exc)
                if consecutive_errors >= 3:
                    break
                time.sleep(0.8)
                continue

            aweme_list = data.get("aweme_list") or []
            for aweme in aweme_list:
                item = normalize_aweme(aweme)
                if item:
                    items.append(item)
                if len(items) >= max_items:
                    break

            if not data.get("has_more") or not aweme_list:
                break
            cursor = int(data.get("max_cursor") or 0)
            time.sleep(0.25 + random.uniform(0, 0.25))

        return items

    def download(self, play_url: str, dest: Path, on_progress: Optional[ProgressCb] = None) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        headers = {**self.headers, "Referer": "https://www.douyin.com/"}
        last_error = None
        for attempt in range(4):
            try:
                with self.session.get(
                    play_url,
                    headers=headers,
                    stream=True,
                    timeout=(10, 180),
                ) as response:
                    if response.status_code >= 400:
                        raise RuntimeError(f"HTTP {response.status_code}")
                    total = int(response.headers.get("content-length") or 0)
                    received = 0
                    with open(dest, "wb") as handle:
                        for chunk in response.iter_content(chunk_size=256 * 1024):
                            if not chunk:
                                continue
                            handle.write(chunk)
                            received += len(chunk)
                            if on_progress:
                                on_progress(received, total)
                if dest.stat().st_size <= 0:
                    raise RuntimeError("empty file")
                return dest
            except Exception as exc:
                last_error = exc
                logger.warning("Download attempt %s failed: %s", attempt + 1, exc)
                time.sleep(min(2 ** attempt, 6))
        raise RuntimeError(f"DOWNLOAD_FAILED: {last_error}")

    def _warm_up(self) -> None:
        if self._warmed:
            return
        try:
            self.session.get(
                "https://www.douyin.com/",
                headers=self.headers,
                timeout=min(self.timeout, 10),
                allow_redirects=True,
            )
        except Exception as exc:
            logger.warning("Douyin warm-up failed: %s", exc)
        self._warmed = True

    def _refresh_guest_cookie(self) -> None:
        if self.has_user_cookie:
            return
        self.cookie = build_guest_cookie(self.session)
        self.headers["Cookie"] = self.cookie

    def _cookie_error(self) -> DouyinCookieError:
        if self.has_user_cookie:
            return DouyinCookieError("COOKIE_INVALID")
        return DouyinCookieError("COOKIE_REQUIRED")

    def _request_signed(self, endpoint: str, params: dict) -> requests.Response:
        signed = dict(params)
        signed["msToken"] = cookie_ms_token(self.cookie) or signed.get("msToken") or ""
        a_bogus = ABogus().get_value(signed)
        url = f"{endpoint}{urlencode(signed)}&a_bogus={quote(a_bogus, safe='')}"
        return self.session.get(url, headers=self.headers, timeout=self.timeout)

    def _get_json(self, endpoint: str, params: dict) -> dict:
        self._warm_up()
        last_status = None
        for attempt in range(3):
            response = self._request_signed(endpoint, params)
            if response.status_code in (401, 403):
                raise self._cookie_error()
            text = (response.text or "").strip()
            if not text:
                logger.warning(
                    "Empty Douyin response (attempt %s/3), refreshing guest cookie=%s",
                    attempt + 1,
                    not self.has_user_cookie,
                )
                self._refresh_guest_cookie()
                time.sleep(0.4 * (attempt + 1))
                continue
            try:
                data = response.json()
            except Exception:
                logger.warning("Non-JSON Douyin response (attempt %s/3)", attempt + 1)
                self._refresh_guest_cookie()
                time.sleep(0.4 * (attempt + 1))
                continue

            status = data.get("status_code")
            last_status = status
            if status in (0, None):
                return data
            if status in COOKIE_STATUS_CODES:
                raise self._cookie_error()
            logger.warning(
                "Douyin status_code=%s (attempt %s/3)", status, attempt + 1
            )
            self._refresh_guest_cookie()
            time.sleep(0.4 * (attempt + 1))

        if last_status in COOKIE_STATUS_CODES or last_status is None:
            raise self._cookie_error()
        raise RuntimeError(f"Douyin API status_code={last_status}")


def iter_unique_items(groups: Iterable[List[VideoItem]]) -> List[VideoItem]:
    seen = set()
    result: List[VideoItem] = []
    for group in groups:
        for item in group:
            if item.aweme_id in seen:
                continue
            seen.add(item.aweme_id)
            result.append(item)
    return result
