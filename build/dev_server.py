# -*- coding: utf-8 -*-
"""Local dev server for Mílù.

Plain `python3 -m http.server` sends no cache headers, so browsers apply
heuristic caching and keep serving stale JavaScript after every edit — which
makes it look as though a fix didn't work. This sends no-store on everything.

Run:  python3 build/dev_server.py [port]
"""
import os
import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Only surface problems; a request log per asset is just noise.
        status = args[1] if len(args) > 1 else ""
        if str(status).startswith(("4", "5")):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    handler = partial(NoCacheHandler, directory=ROOT)
    print(f"Mílù dev server → http://localhost:{port}  (serving {ROOT}, caching disabled)")
    try:
        HTTPServer(("", port), handler).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
