# MAZUMS Ultra Cinematic Landing Page

This rebuild follows the same core interaction model as the Golestan Tea reference: a tall sticky cinematic hero with a **paused video scrubbed by scroll position**.

## Critical difference from the previous build

The supplied 30fps campus video is re-encoded to **15fps with every encoded frame as a keyframe**. That means the experience exposes approximately every two original video frames to scroll, giving precise reversible seeking instead of rough MP4 jumps.

### Scrub video facts

- Source: 30fps uploaded MP4
- Scrub output: 15fps
- Frames: 231
- Every encoded frame: I-frame / keyframe
- Desktop: 720×1280 H.264 all-I
- Mobile: 540×960 H.264 all-I
- `video.currentTime` is snapped to exact 1/15s frame boundaries from scroll progress

## Structure

1. 520–650vh sticky cinematic scroll film
2. Real MazUMS campus chapter
3. Medical learning chapter
4. Operating-room / clinical chapter
5. Real graduation chapter
6. Minimal cinematic finale

## Run locally

```bash
python -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/
```

A Windows launcher is included as `start-demo-windows.bat`.

## Vercel

This is a static project. Upload the folder or connect the GitHub repository to Vercel with **Framework Preset: Other** and no build command.

## QA URLs

For visual testing, the page accepts:

- `?qa=hero`
- `?qa=hero2`
- `?qa=hero3`
- `?qa=hero4`
- `?qa=campus`
- `?qa=learning`
- `?qa=clinical`
- `?qa=graduation`

These are only helpers to jump to representative scroll positions; they do not change production behavior.

## Reference architecture

The opening intentionally follows the interaction philosophy of the supplied Golestan Tea reference: a multi-viewport sticky film whose paused-video time is controlled by scroll. Unlike the previous attempts, this version does not use a loose image-sequence approximation for the core hero; it seeks a specially encoded all-keyframe MP4 at exact 1/15-second boundaries.
