"""Render the demo's stills from its opening state: static.webp, thumb.webp and og.jpg in demo/public/.

Serves the built demo (demo/dist/, from `npm run build`), opens it in a browser in the dark theme,
and screenshots the stage at 2x: 1200 x 675 for static.webp and thumb.webp, and 1200 x 630 for og.jpg.
Then rebuild, so the bundle carries the new stills.

    cd demo && npm run build && cd ..
    uv run --with playwright --with pillow python scripts/stills.py   # uses Microsoft Edge; --channel chrome for Chrome
"""

import argparse
import functools
import http.server
import io
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

DEMO = Path(__file__).resolve().parents[1] / "demo"
SCALE = 2

# Show the stage alone, at the still's size.
CSS = """
[data-demo] .dk-body { grid-template-columns: max-content !important; }
[data-demo] .dk-rail, [data-demo] .dk-header, [data-demo] .dk-bar, [data-demo] .dk-about, [data-demo] .dk-links { display: none !important; }
[data-demo] .dk-stage { width: %dpx; height: %dpx !important; aspect-ratio: auto !important; }
"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def render(browser, url, width, height):
    page = browser.new_page(viewport={"width": width + 200, "height": height + 200}, device_scale_factor=SCALE)
    page.goto(url)
    page.wait_for_selector(".dw-timeline circle")
    page.add_style_tag(content=CSS % (width, height))
    page.wait_for_timeout(500)  # the frame redraws on the resize
    png = page.locator(".dk-stage").screenshot()
    page.close()
    return Image.open(io.BytesIO(png)).convert("RGB").resize((width, height), Image.LANCZOS)


def save(image, name, fmt, limit=None, **options):
    for quality in range(90, 40, -5):
        buffer = io.BytesIO()
        image.save(buffer, fmt, quality=quality, **options)
        if limit is None or buffer.tell() < limit:
            break
    (DEMO / "public" / name).write_bytes(buffer.getvalue())
    print(f"{name}: {image.width}x{image.height}, quality {quality}, {buffer.tell() / 1000:.1f} KB")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--channel", default="msedge", help="the installed browser Playwright drives")
    args = parser.parse_args()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=DEMO / "dist"))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel=args.channel)
            wide = render(browser, url, 1200, 675)
            og = render(browser, url, 1200, 630)
            browser.close()
    finally:
        server.shutdown()

    save(wide, "static.webp", "WEBP", method=6)
    save(wide, "thumb.webp", "WEBP", 80_000, method=6)
    save(og, "og.jpg", "JPEG", 150_000, optimize=True, progressive=True)


if __name__ == "__main__":
    main()
