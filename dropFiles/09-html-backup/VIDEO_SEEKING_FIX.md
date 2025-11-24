# Video Seeking Fix for dropfiles.html

## Problem

When serving videos with Python's built-in HTTP server (`python -m http.server`), you'll encounter these issues:

1. **Videos won't seek/scrub** - Can't click on the timeline to jump to different positions
2. **BrokenPipeError** - Server crashes when browser tries to seek:
   ```
   BrokenPipeError: [Errno 32] Broken pipe
   ```
3. **.mov files may not play** at all

## Root Cause

Python's `SimpleHTTPRequestHandler` **doesn't support HTTP Range requests**, which are required for:
- Video seeking (jumping to different timestamps)
- Efficient video streaming
- Browser video controls to work properly

When you click on a video timeline, the browser sends a `Range: bytes=1000-2000` header asking for a specific chunk of the video. The default Python server ignores this and sends the entire file, causing the browser to cancel the request (BrokenPipeError).

## Solution

Use the custom HTTP server with Range request support:

### Step 1: Stop any running server
Press `Ctrl+C` in the terminal running the old server.

### Step 2: Start the new server

```bash
cd /Users/stanleytan/Documents/25-technical/09-html
python serve_with_range.py
```

Or specify a custom port:
```bash
python serve_with_range.py 8080
```

### Step 3: Access your application

Open in browser:
```
http://localhost:8000/dropfiles.html?./
```

## What the Fix Does

The `serve_with_range.py` server:

1. ✅ **Handles Range requests properly**
   - Responds with `206 Partial Content` for range requests
   - Sends only the requested byte range
   - Supports seeking to any position in the video

2. ✅ **Proper MIME types for all video formats**
   - `.mp4` → `video/mp4`
   - `.mov` → `video/quicktime`
   - `.webm`, `.ogg`, `.avi`, `.mkv`, etc.

3. ✅ **Gracefully handles disconnections**
   - Catches `BrokenPipeError` and `ConnectionResetError`
   - These are normal when users seek through videos
   - Server continues running without crashes

4. ✅ **Optimized streaming**
   - Sends video in 1MB chunks
   - Reduces memory usage
   - Faster seeking response

## Code Changes Made to dropfiles.html

The HTML file was also fixed:

1. **Dynamic MIME type detection** - Sets correct `type` attribute based on file extension
2. **Added `preload="metadata"`** - Loads video metadata before playing
3. **Proper Promise handling** - Waits for metadata before calling `play()`
4. **Fixed pause/play timing** - Prevents "AbortError" conflicts

## Verification

After starting `serve_with_range.py`, you should be able to:

- ✅ Load `.mp4` and `.mov` files
- ✅ Click anywhere on the video timeline to jump to that position
- ✅ Scrub back and forth smoothly
- ✅ Use keyboard shortcuts (arrow keys) to navigate
- ✅ No more BrokenPipeError messages in the server console

## Alternative Solutions

If you prefer not to use the Python script, other options include:

1. **Node.js http-server** (has Range support built-in):
   ```bash
   npm install -g http-server
   http-server -p 8000
   ```

2. **Live Server (VS Code extension)** - Has Range support

3. **nginx or Apache** - Full-featured web servers

But `serve_with_range.py` is the simplest solution that requires no additional installations.
