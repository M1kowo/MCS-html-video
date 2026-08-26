# Video package format

Use a package when generating several files is simpler than issuing one write call per frame.

```text
video-package/
├── manifest.json
├── design-plan.json
├── content-graph.json
├── frames/
│   ├── intro.html
│   └── outro.html
└── assets/
```

Multi-frame manifest:

```json
{
  "schemaVersion": 1,
  "name": "Product introduction",
  "intent": "Explain the product in two scenes",
  "aspect": "16:9",
  "designPlan": "design-plan.json",
  "contentGraph": "content-graph.json",
  "frames": [
    { "nodeId": "intro", "file": "frames/intro.html" },
    { "nodeId": "outro", "file": "frames/outro.html" }
  ],
  "assets": ["assets/logo.png"]
}
```

`designPlan` is optional for compatibility with older packages. New custom videos should include it. The plan may reference one style pack, mix several with a string array, or omit `stylePackId` for a completely original direction. Style packs guide visual choices and never supply a fixed HTML structure.

Example `design-plan.json`:

```json
{
  "schemaVersion": 1,
  "mode": "fresh",
  "stylePackId": ["swiss-pulse", "deconstructed"],
  "customStyleName": "Editorial Signal Lab",
  "mood": ["precise", "restless"],
  "canvas": "mixed",
  "palette": [
    { "color": "#F4F0E8", "usage": "paper canvas" },
    { "color": "#161616", "usage": "primary ink" },
    { "color": "#E84A27", "usage": "signal accent" }
  ],
  "typography": { "heading": "Archivo Black", "body": "IBM Plex Sans" },
  "layoutFamily": ["offset editorial grid", "edge crop"],
  "motionFamily": ["directional snap", "staggered reveal"],
  "transitionFamily": ["paper wipe"],
  "components": ["title-card", "comparison", "chapter-transition"],
  "motifs": ["registration marks", "torn paper edge"],
  "antiPatterns": ["centered hero", "blue-purple neon gradient"],
  "differentiators": ["warm paper field", "alternating left-edge anchors"]
}
```

Use `mode: "fresh"` to request novelty and repetition warnings. Use `mode: "series"` to preserve a family identity while still varying shot layout or motion rhythm.

`frames` may be omitted when `frames/<node-id>.html` exists for every graph node. A single-frame package uses `"html": "video.html"` instead of `contentGraph` and `frames`.

All referenced paths are relative to the package directory. Frame HTML must be offline-safe: do not reference CDNs, remote fonts/media, `file://` URLs, or machine-absolute paths. Inline CSS/JavaScript and put media in `assets/`. Apply with `apply_video_package` or:

```bash
html-video project-apply ./video-package
```

Import validates and stores the plan at `.html-video/projects/<project-id>/design-plan.json` and returns a non-blocking similarity report.
