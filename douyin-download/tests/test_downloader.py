import unittest

from app.services.downloader.douyin import (
    extract_url,
    is_douyin_host,
    normalize_aweme,
    parse_link,
    pick_play_url,
)


class TestDownloaderHelpers(unittest.TestCase):
    def test_extract_url_from_share_text(self):
        raw = "Sao chép link này https://v.douyin.com/abc123/ nha"
        self.assertEqual(extract_url(raw), "https://v.douyin.com/abc123/")

    def test_parse_video_link(self):
        kind, key = parse_link("https://www.douyin.com/video/7685259506536394986")
        self.assertEqual(kind, "aweme")
        self.assertEqual(key, "7685259506536394986")
        self.assertTrue(is_douyin_host("https://www.douyin.com/video/1"))
        self.assertTrue(is_douyin_host("https://v.douyin.com/abc"))
        self.assertFalse(is_douyin_host("https://example.com/video/1"))

    def test_pick_play_url_prefers_bitrate(self):
        aweme = {
            "video": {
                "bit_rate": [{"play_addr": {"url_list": ["https://cdn/high.mp4"]}}],
                "play_addr": {"url_list": ["https://cdn/low.mp4"]},
            }
        }
        self.assertEqual(pick_play_url(aweme), "https://cdn/high.mp4")

    def test_normalize_skips_images(self):
        aweme = {
            "aweme_id": "1",
            "images": [{"url_list": ["https://cdn/a.jpg"]}],
            "video": {"play_addr": {"url_list": ["https://cdn/a.mp4"]}},
        }
        self.assertIsNone(normalize_aweme(aweme))

    def test_normalize_video(self):
        aweme = {
            "aweme_id": "99",
            "desc": "xin chào",
            "author": {"nickname": "user"},
            "video": {"play_addr": {"url_list": ["https://cdn/a.mp4"]}},
        }
        item = normalize_aweme(aweme)
        self.assertIsNotNone(item)
        self.assertEqual(item.aweme_id, "99")
        self.assertEqual(item.play_url, "https://cdn/a.mp4")


if __name__ == "__main__":
    unittest.main()
