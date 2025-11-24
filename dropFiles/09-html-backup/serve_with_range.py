#!/usr/bin/env python3
"""
HTTP server with Range request support for video streaming.
This allows proper video seeking/scrubbing in the browser.

Usage:
    python serve_with_range.py [port]
    Default port: 8000
"""

import http.server
import socketserver
import os
import sys
from functools import partial
from urllib.parse import unquote


class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with support for Range requests (needed for video seeking)"""

    def do_GET(self):
        """Serve a GET request with Range support."""
        path = self.translate_path(self.path)

        if os.path.isdir(path):
            # For directories, use default behavior
            return super().do_GET()

        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return

        try:
            fs = os.fstat(f.fileno())
            file_len = fs[6]

            # Check if Range header is present
            range_header = self.headers.get('Range')

            if range_header:
                # Parse Range header
                # Format: "bytes=start-end" or "bytes=start-"
                try:
                    range_match = range_header.replace('bytes=', '').split('-')
                    start = int(range_match[0]) if range_match[0] else 0
                    end = int(range_match[1]) if range_match[1] else file_len - 1

                    # Ensure valid range
                    if start >= file_len:
                        self.send_error(416, "Requested Range Not Satisfiable")
                        f.close()
                        return

                    end = min(end, file_len - 1)
                    length = end - start + 1

                    # Send 206 Partial Content response
                    self.send_response(206)
                    self.send_header("Content-type", self.guess_type(path))
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_len}")
                    self.send_header("Content-Length", str(length))
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                    self.send_header("Pragma", "no-cache")
                    self.send_header("Expires", "0")
                    self.end_headers()

                    # Seek to start position and send the requested range
                    f.seek(start)
                    bytes_to_send = length
                    while bytes_to_send > 0:
                        chunk_size = min(bytes_to_send, 1024 * 1024)  # 1MB chunks
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                        except (BrokenPipeError, ConnectionResetError):
                            # Client disconnected - this is normal for video seeking
                            break
                        bytes_to_send -= len(chunk)

                except (ValueError, IndexError) as e:
                    self.send_error(400, f"Bad Range header: {e}")
                    f.close()
                    return
            else:
                # No Range header - send entire file
                self.send_response(200)
                self.send_header("Content-type", self.guess_type(path))
                self.send_header("Content-Length", str(file_len))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                self.end_headers()

                try:
                    self.copyfile(f, self.wfile)
                except (BrokenPipeError, ConnectionResetError):
                    # Client disconnected - this is normal
                    pass
        finally:
            f.close()

    def guess_type(self, path):
        """Guess the MIME type with better video support."""
        base, ext = os.path.splitext(path)
        ext = ext.lower()

        # Video MIME types
        video_types = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.m4v': 'video/x-m4v',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.ogv': 'video/ogg',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
        }

        if ext in video_types:
            return video_types[ext]

        # Fall back to default
        return super().guess_type(path)

    def log_message(self, format, *args):
        """Custom logging to show Range requests and video files."""
        # Log video file requests and show if Range header is present
        if any(ext in self.path.lower() for ext in ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv']):
            range_info = f" [Range: {self.headers.get('Range')}]" if 'Range' in self.headers else " [Full file]"
            print(f"🎥 Video request: {self.path}{range_info}")
        elif 'Range' not in self.headers:
            super().log_message(format, *args)


def run_server(port=8000):
    """Run the HTTP server with Range support."""
    handler = RangeRequestHandler

    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"╔══════════════════════════════════════════════════════════════╗")
        print(f"║  HTTP Server with Range Support (for video seeking)         ║")
        print(f"╠══════════════════════════════════════════════════════════════╣")
        print(f"║  Serving at: http://localhost:{port}/                        ║")
        print(f"║  Directory:  {os.getcwd():<44} ║")
        print(f"╚══════════════════════════════════════════════════════════════╝")
        print(f"\n✓ Range requests enabled - video seeking will work properly")
        print(f"✓ Serving .mp4, .mov, and other video formats")
        print(f"\nPress Ctrl+C to stop the server\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✓ Server stopped")
            sys.exit(0)


if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}")
            print(f"Usage: {sys.argv[0]} [port]")
            sys.exit(1)

    run_server(port)
