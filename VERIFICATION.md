# Verification — MAZUMS Ultra Cinematic

## Reference interaction matched

The reference implementation uses a very tall sticky hero and maps scroll progress to a paused video's `currentTime`. This project uses the same fundamental interaction model, but the supplied 30fps campus clip was re-encoded for stronger seeking behavior.

## Exact scroll-video implementation

- Original supplied video: 30 fps
- Scrub video: 15 fps
- Scrub frames: 231
- Duration: 15.4 s
- Every encoded scrub frame is an I-frame / keyframe
- One scrub frame therefore represents approximately every two frames of the original 30 fps source
- Scroll mapping: `round(progress * 230) / 15` seconds
- Seeking only happens while video is paused
- Mobile receives a 540×960 version; desktop receives 720×1280
- The Windows demo server supports HTTP byte-range requests (`206 Partial Content`) for video seeking

## Browser QA performed

Representative desktop states were rendered and visually inspected for:

- opening hero
- mid/end hero scrub
- campus chapter
- learning chapter
- clinical / operating room chapter
- graduation chapter

Representative mobile states were rendered and visually inspected for:

- portrait hero composition
- graduation composition

The frame/time mapping was checked at multiple scroll points in a browser environment:

- 12% → frame 028 → ~1.867 s
- 52% → frame 120 → 8.000 s
- 88% → frame 202 → ~13.467 s

Mobile source selection and seeking were also checked.

## Static checks

- JavaScript syntax: pass
- Duplicate HTML IDs: none
- Missing local asset references: none
- CSS brace balance: pass
- Desktop scrub video: 231/231 frames are keyframes
- Mobile scrub video: 231/231 frames are keyframes
- `muted`, `playsinline`, `preload="auto"`, poster: present
- No external JavaScript framework dependency

## Design system

- real user-provided campus / surgery / graduation photography
- editorial black / ivory / antique-gold / restrained medical-cyan palette
- sticky cinematic chapter system
- reversible scroll animation
- mobile-first layout and safe-area handling
- reduced-motion support
- procedural Canvas depth, DNA, ECG and reversible graduation confetti
