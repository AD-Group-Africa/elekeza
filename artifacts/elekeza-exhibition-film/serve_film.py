"""
serve_film.py -- watch the exhibition film locally, with proper seeking.

The stdlib's `http.server` does not answer HTTP Range requests, so browsers
cannot scrub an MP4 served that way. This adds Range support (bytes=N-M) so the
player can seek, and binds to loopback only.

    python serve_film.py                 # http://127.0.0.1:8117/film-viewer.html
    python serve_film.py --port 8200

Nothing here is part of the film itself; it is only a review surface.
"""

import argparse
import functools
import http.server
import os
import socket
import socketserver
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler + single-range GET support for media."""

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        if not rng or not rng.startswith("bytes=") or "," in rng:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        try:
            size = os.fstat(f.fileno()).st_size
            spec = rng[len("bytes="):].strip()
            first, _, last = spec.partition("-")
            if first == "":                      # suffix range: bytes=-N
                length = int(last)
                start = max(0, size - length)
                end = size - 1
            else:
                start = int(first)
                end = int(last) if last else size - 1
                end = min(end, size - 1)
            if start > end or start >= size:
                self.send_error(416, "Requested Range Not Satisfiable",
                                f"valid range is bytes=0-{size - 1}")
                f.close()
                return None
        except ValueError:
            f.close()
            return super().send_head()

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_range_left", None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(64 * 1024, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8117)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args(argv)

    handler = functools.partial(RangeHandler, directory=HERE)
    with Server((args.host, args.port), handler) as httpd:
        url = f"http://{args.host}:{args.port}/film-viewer.html"
        print(f"serving {HERE}")
        print(f"  {url}   (ctrl-c to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
