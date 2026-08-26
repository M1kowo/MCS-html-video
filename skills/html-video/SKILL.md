---
name: html-video
description: Use the local html-video workbench to create or edit MP4 videos from subtitles, audio, source material, assets, storyboards, or generated HTML. Trigger when a user asks GPT, Codex, Claude, Cursor, or another agent to call/use html-video or a local video workbench.
---

# html-video

Drive the user's local renderer; do not select or invoke a model inside html-video. The current AI is responsible for understanding the request, choosing a visual approach, and generating any required ContentGraph or HTML.

## Choose the shortest suitable path

Prefer available `html-video` MCP tools. If they are not connected, run the equivalent `html-video` CLI commands from this repository.

- Custom multi-frame video: `create_project` → `get_design_context` → `write_design_plan` → `write_storyboard` → `write_frame_html` for every node → `attach_audio` when supplied → `check_visual_variety` → `render_project`.
- Single HTML animation: `create_project` → `get_design_context` → `write_design_plan` → `write_html` → optional `attach_audio` → `check_visual_variety` → `render_project`.
- A prepared directory: call `apply_video_package`, then `render_project`.

`render_subtitle_video` / `subtitle-render` is a legacy compatibility path for local diagnostics, not a user-facing final-video workflow. Never use it to fulfill a generation request: its single caption-shell composition is intentionally not exposed through MCP because it produces visually repetitive results.

When using the CLI, the matching commands include `project-create`, `project-design-context`, `project-write-design-plan`, `project-get-design-plan`, `project-set-graph`, `project-write-frame`, `project-write-html`, `project-attach-audio`, `project-apply`, and `project-render`. `subtitle-render --diagnostic` is reserved for intentional renderer smoke tests and must never be used for a final video.

## Establish the design before HTML

After project creation, always read `get_design_context`. It returns optional style packs, a component catalog, recent design summaries, and features that have appeared repeatedly. Use that evidence to write a project-level `design-plan.json` with `write_design_plan`.

- `fresh` mode is for novelty. If the similarity report warns about a recent project, vary the palette, font pairing, layout geometry, motion rhythm, transitions, component combination, or motifs before authoring HTML.
- `series` mode preserves a recognizable identity. Keep brand colors and typography when useful, but vary shot layout or motion rhythm between episodes.
- Style packs are design directions, not templates. Select one, mix several with a `stylePackId` array, or omit `stylePackId` and define a completely custom visual identity.
- Catalog components are suggestions and reusable capabilities, not required slots. Choose only what the narrative needs and do not reuse a standard layout by default.
- Similarity reports are advisory. Never treat them as permission to block a user-requested generation.

The external AI still freely authors every HTML document. The plan records intent and makes creative decisions inspectable; it does not impose a fixed DOM structure.

## Visual variety gate

Do not generate a long video by changing only the text inside one centered card, lower third, or repeated layout. Before final MCP rendering, videos 12 seconds or longer must satisfy all of these:

- At least 3 semantic visual beats. Use multiple graph frames, repeated `data-hv-scene`/`.scene` containers, or declare the accurate count with `data-hv-visual-beats` on a Canvas/WebGL composition root.
- At least 2 layout families and 2 motion families/rhythms in `design-plan.json`.
- At least 3 narrative component types and at least one transition family.
- Each beat must translate meaning into a composition such as a comparison, timeline, diagram, quote, product view, spatial metaphor, or image-led scene. Subtitle text may support the scene but must not be the only changing visual.
- Keep one visual identity across the video. Variety means meaningful changes in geometry, scale, information form, and pacing—not random decoration or a different style on every cut.

Call `check_visual_variety` before rendering. `render_project` enforces the same gate for MCP calls. If it fails, revise the plan/HTML and check again. Do not bypass the gate with the legacy subtitle CLI.

## Handle the user's common request directly

For a request such as “调用本地工作台 html-video，结合我给你的字幕和音频文件产出视频”:

1. Resolve the SRT and audio to local paths available to the tool.
2. Read the subtitle semantics and group the narration into meaningful visual beats rather than one layout per subtitle cue.
3. Complete the design-plan workflow, generate varied HTML/ContentGraph scenes, attach the supplied audio as narration, and render.
4. Inspect representative frames from every visual beat before delivery.
5. Report the absolute output path. Do not ask the user to choose an AI provider or model.

If an attachment exists only in a cloud chat and has no local path or downloadable content, explain that the local renderer needs the file transferred to the machine. Do not claim that a cloud-only client can access localhost.

## Generation constraints

- Templates are optional. Use one when it helps; generate HTML from scratch when it better fits the request.
- Define palette roles, typography, layout, motion, transitions, components, motifs, anti-patterns, and differentiators in the design plan before generating custom HTML.
- Build each scene's static hero frame first, verify composition and readability, and only then add animation.
- Each frame HTML must be self-contained, offline-safe, and render without a build step. Do not use CDN imports, remote fonts/media, `file://` URLs, or machine-absolute paths. Inline CSS/JavaScript, use system-font fallbacks, and reference copied project assets with relative paths.
- Use deterministic, finite animations. Never use `Math.random`, `Date.now`, or infinite loops.
- Multi-scene work must have transitions. Every scene element needs a deliberate entrance animation.
- Never deliver a long video whose only visual change is replacement text inside the same caption container.
- Do not default to a generic dark gradient, blue-purple neon glow, or centered oversized headline. Use them only when the design plan deliberately calls for them.
- Keep visible text faithful to the supplied source and subtitles.
- Match graph node IDs exactly when calling `write_frame_html`.
- Render only after every graph node has a frame.
- Preserve `design-plan.json`, authored HTML, and the rendered MP4 in every custom project.

For the portable package format, read [references/video-package.md](references/video-package.md).

When the user asks how to connect GPT, Codex, ChatGPT Desktop, or another client, read [references/connections.md](references/connections.md).
