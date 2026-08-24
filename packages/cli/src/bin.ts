#!/usr/bin/env node
import cacModule from 'cac';
import { bootstrap } from './context.js';
import { setJsonMode, ok, fail } from './output.js';
import { runDoctor } from './commands/doctor.js';
import { listEngines } from './commands/list-engines.js';
import { searchTemplates, inspectTemplate } from './commands/templates.js';
import {
  projectCreate,
  projectList,
  projectShow,
  projectDelete,
  projectAddAsset,
  projectRemoveAsset,
  projectSetTemplate,
  projectSetVar,
  projectSetVars,
  projectPreview,
  projectRender,
} from './commands/project.js';
import { startStudioServer } from './studio-server.js';
import {
  projectApply,
  projectAttachAudio,
  projectDesignContext,
  projectGetDesignPlan,
  projectSetGraph,
  projectWriteDesignPlan,
  projectWriteFrame,
  projectWriteHtml,
  subtitleRender,
} from './commands/external-project.js';
import { startMcpServer } from './mcp-server.js';

// cac is a CJS default export; ESM interop sometimes wraps it in `.default`
// biome-ignore lint/suspicious/noExplicitAny: cac's types don't expose this shape
const cacFn: (name: string) => any =
  typeof cacModule === 'function' ? (cacModule as any) : (cacModule as any).default;
const cli = cacFn('html-video');

cli.option('--json', 'JSON output (default: on)', { default: true });
cli.option('--no-color', 'disable ANSI colors');
cli.option('--cwd <path>', 'project root');

cli.command('doctor', 'Diagnose environment').action(async (opts: any) => {
  setJsonMode(!!opts.json);
  const ctx = await bootstrap({ cwd: opts.cwd });
  await runDoctor(ctx);
});

cli.command('list-engines', 'List installed engine adapters').action(async (opts: any) => {
  setJsonMode(!!opts.json);
  const ctx = await bootstrap({ cwd: opts.cwd });
  await listEngines(ctx);
});

cli
  .command('search-templates', 'Search templates by intent')
  .option('--intent <text>', 'Free-text user intent')
  .option('--aspect <ratio>', '16:9 / 9:16 / 1:1')
  .option('--license-allow <list>', 'Comma-separated SPDX ids')
  .option('--top <n>', 'Top N matches', { default: 5 })
  .action(async (opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await searchTemplates(ctx, {
      intent: opts.intent,
      aspect: opts.aspect,
      licenseAllow: opts.licenseAllow,
      top: Number(opts.top),
    });
  });

cli
  .command('inspect-template <id>', 'Show full metadata for a template')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await inspectTemplate(ctx, id);
  });

// ====== project-* commands (RFC-05) ======

cli
  .command('project-create', 'Create a new project')
  .option('--name <text>', 'Project name (required)')
  .option('--intent <text>', 'One-sentence description')
  .option('--aspect <ratio>', '16:9 / 9:16 / 1:1')
  .option('--commercial', 'Mark as commercial-use')
  .action(async (opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectCreate(ctx, {
      name: opts.name,
      intent: opts.intent,
      aspect: opts.aspect,
      commercial: !!opts.commercial,
    });
  });

cli.command('project-list', 'List all projects').action(async (opts: any) => {
  setJsonMode(!!opts.json);
  const ctx = await bootstrap({ cwd: opts.cwd });
  await projectList(ctx);
});

cli
  .command('project-show <id>', 'Show project details')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectShow(ctx, id);
  });

cli
  .command('project-delete <id>', 'Delete a project')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectDelete(ctx, id);
  });

cli
  .command('project-add-asset <id>', 'Add an asset to a project')
  .option('--file <path>', 'Path to a file (image / video / audio / data)')
  .option('--inline-text <text>', 'Inline text content')
  .option('--inline-data-file <path>', 'Path to JSON / CSV file to embed as data asset')
  .option('--caption <text>', 'Optional caption')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectAddAsset(ctx, id, {
      file: opts.file,
      inlineText: opts.inlineText,
      inlineDataFile: opts.inlineDataFile,
      caption: opts.caption,
    });
  });

cli
  .command('project-remove-asset <id>', 'Remove an asset from a project')
  .option('--asset <assetId>', 'Asset id to remove (required)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.asset) fail('invalid-input', '--asset required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectRemoveAsset(ctx, id, opts.asset);
  });

cli
  .command('project-set-template <id>', 'Pick a template for the project')
  .option('--template <templateId>', 'Template id (required)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.template) fail('invalid-input', '--template required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectSetTemplate(ctx, id, opts.template);
  });

cli
  .command('project-set-var <id>', 'Set a single variable')
  .option('--key <name>', 'Variable name')
  .option('--value <json>', 'Value (parsed as JSON if possible, else string)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.key) fail('invalid-input', '--key required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectSetVar(ctx, id, opts.key, opts.value);
  });

cli
  .command('project-set-vars <id>', 'Replace all variables from a JSON file')
  .option('--vars-file <path>', 'Path to JSON file (required)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.varsFile) fail('invalid-input', '--vars-file required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectSetVars(ctx, id, opts.varsFile);
  });

cli
  .command('project-preview <id>', 'Render an HTML preview of the project')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectPreview(ctx, id);
  });

cli
  .command('project-render <id>', 'Export the project to MP4')
  .option('--output <path>', 'Output MP4 path')
  .option('--stream-progress', 'Emit progress as NDJSON')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectRender(ctx, id, {
      output: opts.output,
      streamProgress: !!opts.streamProgress,
    });
  });

// ====== External AI ingestion (provider/model agnostic) ======

cli
  .command('project-design-context <id>', 'Read optional style packs, component guidance, and recent design history')
  .option('--recent <n>', 'Maximum recent design summaries', { default: 8 })
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectDesignContext(ctx, id, Number(opts.recent));
  });

cli
  .command('project-write-design-plan <id>', 'Validate and save a project design-plan.json')
  .option('--plan-file <path>', 'Design plan JSON file (required)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.planFile) fail('invalid-input', '--plan-file required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectWriteDesignPlan(ctx, id, opts.planFile);
  });

cli
  .command('project-get-design-plan <id>', 'Read a project design-plan.json')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectGetDesignPlan(ctx, id);
  });

cli
  .command('project-write-html <id>', 'Replace a project with externally generated single-frame HTML')
  .option('--html-file <path>', 'Complete self-contained HTML file (required)')
  .option('--duration <seconds>', 'Frame duration', { default: 5 })
  .option('--node-id <id>', 'ContentGraph node id', { default: 'main' })
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.htmlFile) fail('invalid-input', '--html-file required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectWriteHtml(ctx, id, {
      htmlFile: opts.htmlFile,
      duration: Number(opts.duration),
      nodeId: opts.nodeId,
    });
  });

cli
  .command('project-set-graph <id>', 'Write an externally generated ContentGraph')
  .option('--graph-file <path>', 'ContentGraph JSON file (required)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.graphFile) fail('invalid-input', '--graph-file required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectSetGraph(ctx, id, opts.graphFile);
  });

cli
  .command('project-write-frame <id>', 'Write HTML for one ContentGraph node')
  .option('--node <nodeId>', 'ContentGraph node id (required)')
  .option('--html-file <path>', 'Complete self-contained frame HTML (required)')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.node) fail('invalid-input', '--node required');
    if (!opts.htmlFile) fail('invalid-input', '--html-file required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectWriteFrame(ctx, id, { nodeId: opts.node, htmlFile: opts.htmlFile });
  });

cli
  .command('project-apply <directory>', 'Create or update a project from an external-AI video package')
  .option('--project <id>', 'Update an existing project instead of creating one')
  .action(async (directory: string, opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectApply(ctx, directory, {
      ...(opts.project !== undefined && { projectId: opts.project }),
    });
  });

cli
  .command('project-attach-audio <id>', 'Attach local narration or music audio to an external-AI project')
  .option('--audio-file <path>', 'Audio file (required)')
  .option('--role <role>', 'narration or music', { default: 'narration' })
  .option('--volume-db <number>', 'Mix volume in dB')
  .action(async (id: string, opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.audioFile) fail('invalid-input', '--audio-file required');
    if (opts.role !== 'narration' && opts.role !== 'music') fail('invalid-input', '--role must be narration or music');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await projectAttachAudio(ctx, id, {
      audioFile: opts.audioFile,
      role: opts.role,
      ...(opts.volumeDb !== undefined && { volumeDb: Number(opts.volumeDb) }),
    });
  });

cli
  .command('mcp', 'Run the model-independent html-video MCP server over stdio')
  .action(async (opts: any) => {
    // stdout is reserved exclusively for MCP JSON-RPC messages.
    const ctx = await bootstrap({ cwd: opts.cwd });
    await startMcpServer(ctx);
  });

cli
  .command('subtitle-render', 'Render an SRT + MP3 video without invoking an internal AI')
  .option('--srt <path>', 'Subtitle file (required)')
  .option('--audio <path>', 'MP3 audio file (required)')
  .option('--output-dir <path>', 'Output directory (required)')
  .option('--name <text>', 'Output basename')
  .option('--style <id>', 'Visual style template', { default: 'frame-swiss-grid' })
  .action(async (opts: any) => {
    setJsonMode(!!opts.json);
    if (!opts.srt) fail('invalid-input', '--srt required');
    if (!opts.audio) fail('invalid-input', '--audio required');
    if (!opts.outputDir) fail('invalid-input', '--output-dir required');
    const ctx = await bootstrap({ cwd: opts.cwd });
    await subtitleRender(ctx, {
      srt: opts.srt,
      audio: opts.audio,
      outputDir: opts.outputDir,
      ...(opts.name && { baseName: opts.name }),
      style: opts.style,
    });
  });

// ====== Studio (HTML Anything-style three-pane UI) ======

cli
  .command('studio', 'Launch the project studio in the browser')
  .option('--port <n>', 'Port (default 3071)', { default: 3071 })
  .action(async (opts: any) => {
    setJsonMode(!!opts.json);
    const ctx = await bootstrap({ cwd: opts.cwd });
    const handle = await startStudioServer(ctx, Number(opts.port));
    ok({
      url: handle.url,
      port: handle.port,
      pid: process.pid,
      project_count: (await ctx.orchestrator.list()).length,
      template_count: ctx.templates.list().length,
      note: 'Studio running. Press Ctrl+C to stop.',
    });
    process.on('SIGINT', () => {
      handle.close();
      process.exit(0);
    });
  });

cli.help();
cli.version('0.1.0');
cli.parse();
