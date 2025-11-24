# Debugging .mov Playback Issues

## Changes Made

### 1. Enhanced Video Loading Debug Output (dropfiles.html)

The browser console will now show detailed information when loading videos:

```
🎥 Loading video: ./videos/screenrecording.mov
   Extension: mov
   MIME type: video/quicktime
📡 Video load started
✓ Metadata loaded
   Duration: 45.2
   Video dimensions: 1920 x 1080
✓ Video can play
✓ Video can play through
✓ Video playing successfully
```

If there's an error, you'll see:
```
❌ Video error: Event {...}
   Error code: 4
   Error message: MEDIA_ELEMENT_ERROR...
   Network state: 3
   Ready state: 0
```

### 2. Enhanced Server Logging (serve_with_range.py)

The server console will show video requests:
```
🎥 Video request: /videos/screenrecording.mov [Full file]
🎥 Video request: /videos/screenrecording.mov [Range: bytes=0-1048575]
🎥 Video request: /videos/screenrecording.mov [Range: bytes=2500000-3000000]
```

### 3. URL Decoding Fix (dropfiles.html)

- Filenames with spaces and special characters are now properly decoded
- `Screen%20Recording.mov` → `Screen Recording.mov`
- Prevents 404 errors for files with special characters

## How to Debug

### Step 1: Restart the Server

```bash
cd /Users/stanleytan/Documents/25-technical/09-html
python serve_with_range.py
```

### Step 2: Open Browser Console

1. Open Chrome/Safari DevTools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Keep it open while navigating

### Step 3: Load the Gallery

```
http://localhost:8000/dropfiles.html?./
```

### Step 4: Navigate to a .mov File

Use arrow keys or click on a .mov thumbnail and watch the console output.

## Common Error Codes

**Error Code 1: MEDIA_ERR_ABORTED**
- User aborted video loading
- Usually harmless (user navigated away)

**Error Code 2: MEDIA_ERR_NETWORK**
- Network error while loading
- Check server logs for 404 or broken pipe errors
- May indicate filename mismatch

**Error Code 3: MEDIA_ERR_DECODE**
- Browser can't decode the video format
- .mov file may use unsupported codec
- Try: `ffmpeg -i input.mov -c:v libx264 -c:a aac output.mp4`

**Error Code 4: MEDIA_ERR_SRC_NOT_SUPPORTED**
- Source file format not supported
- Wrong MIME type or corrupted file
- Check if MIME type shows as `video/quicktime`

## Codec Check

To check what codec your .mov file uses:

```bash
ffprobe /Users/stanleytan/Documents/25-technical/09-html/videos/screenrecording.mov
```

Look for:
- **Video codec**: Should be H.264 (or HEVC/H.265 for newer browsers)
- **Audio codec**: Should be AAC

### Safari vs Chrome

- **Safari**: Best .mov support (native QuickTime)
- **Chrome**: Supports H.264 .mov but not all QuickTime codecs
- **Firefox**: Limited .mov support

If .mov doesn't play in Chrome, try Safari or convert to .mp4:

```bash
ffmpeg -i screenrecording.mov -c:v libx264 -c:a aac -strict experimental screenrecording.mp4
```

## What to Report

When the .mov file doesn't play, check the console and report:

1. **Error code**: From the console (1-4)
2. **Error message**: Full text
3. **Network state**: 0-3
4. **Ready state**: 0-4
5. **Server logs**: Any errors or 404s
6. **Browser**: Chrome/Safari/Firefox + version
7. **File info**: Output of `ffprobe` on the .mov file

## Expected Console Output (Working)

When everything works correctly, you should see:

### Browser Console:
```
🎥 Loading video: ./videos/screenrecording.mov
   Extension: mov
   MIME type: video/quicktime
    Adding direct file: screenrecording.mov -> screenrecording.mov
📡 Video load started
✓ Metadata loaded
   Duration: 23.5
   Video dimensions: 1280 x 720
✓ Video can play
✓ Video playing successfully
```

### Server Console:
```
🎥 Video request: /videos/screenrecording.mov [Full file]
🎥 Video request: /videos/screenrecording.mov [Range: bytes=0-]
```

If you see this, the video should play and seeking should work!
