/** Minimal stdio MCP server for external AI clients.
 *
 * The implementation intentionally has no model SDK dependency. It speaks the
 * newline-delimited JSON-RPC transport used by local MCP clients and delegates
 * every operation to the same core orchestration layer as the CLI.
 */

import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import type { ContentGraph } from '@html-video/content-graph';
import type { CliContext } from './context.js';
import { getDesignContext, getDesignPlan, hasDesignPlan, writeDesignPlan } from './design-plan.js';
import { assertProjectVisualVariety, assessProjectVisualVariety } from './visual-variety.js';
import {
  applyVideoPackage,
  attachProjectAudio,
  writeContentGraphValue,
  writeFrameHtmlValue,
  writeSingleHtml,
} from './external-project.js';

interface RpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type ToolArguments = Record<string, unknown>;

const TOOLS = [
  tool('create_project', 'Create an empty html-video project. Next call get_design_context, then write_design_plan before authoring HTML.', {
    name: stringProp('Project name'),
    intent: stringProp('What the video should communicate'),
    aspect: stringProp('Aspect ratio such as 16:9, 9:16, or 1:1'),
  }, ['name']),
  tool('list_projects', 'List local html-video projects.', {}),
  tool('get_project', 'Read a project including frames, assets, and render outputs.', {
    projectId: stringProp('Project id'),
  }, ['projectId']),
  tool('search_templates', 'Search installed visual templates. Templates are optional; external HTML may be created from scratch.', {
    intent: stringProp('Free-text visual or content intent'),
    aspect: stringProp('Optional aspect ratio'),
    top: numberProp('Maximum results'),
  }),
  tool('inspect_template', 'Read complete metadata for one template.', {
    templateId: stringProp('Template id'),
  }, ['templateId']),
  tool('get_design_context', 'Get optional style packs, reusable component guidance, recent project design summaries, and features worth varying. Packs are guidance, never fixed HTML templates.', {
    projectId: stringProp('Current project id; its own design is excluded from history'),
    recentLimit: numberProp('Maximum recent design summaries, default 8'),
  }, ['projectId']),
  tool('write_design_plan', 'Validate and save design-plan.json before HTML generation. Returns a non-blocking similarity report; stylePackId may be omitted for a fully custom design or be an array to mix packs.', {
    projectId: stringProp('Project id'),
    designPlan: objectProp('Design plan schemaVersion 1 object'),
  }, ['projectId', 'designPlan']),
  tool('get_design_plan', 'Read the current project design-plan.json.', {
    projectId: stringProp('Project id'),
  }, ['projectId']),
  tool('add_asset', 'Copy a local image, audio, video, or data file into a project.', {
    projectId: stringProp('Project id'),
    file: stringProp('Absolute or workspace-relative local path'),
    caption: stringProp('Optional asset description'),
  }, ['projectId', 'file']),
  tool('write_html', 'Write fully self-contained, offline-safe single-page HTML after write_design_plan. CDN, remote, file://, and machine-absolute dependencies are rejected. Videos 12s or longer must contain at least 3 semantic visual beats/scenes (or data-hv-visual-beats="3+") before final rendering.', {
    projectId: stringProp('Project id'),
    html: stringProp('Complete self-contained HTML document'),
    durationSec: numberProp('Video duration in seconds'),
    nodeId: stringProp('Optional stable node id'),
  }, ['projectId', 'html']),
  tool('write_storyboard', 'Write and validate a multi-frame ContentGraph after write_design_plan. Missing plans produce a compatibility warning only.', {
    projectId: stringProp('Project id'),
    graph: objectProp('ContentGraph schemaVersion 1 object'),
  }, ['projectId', 'graph']),
  tool('write_frame_html', 'Write fully self-contained, offline-safe HTML for one ContentGraph node, following the project design plan. CDN, remote, file://, and machine-absolute dependencies are rejected. Missing plans produce a compatibility warning only.', {
    projectId: stringProp('Project id'),
    nodeId: stringProp('ContentGraph node id'),
    html: stringProp('Complete self-contained frame HTML document'),
  }, ['projectId', 'nodeId', 'html']),
  tool('attach_audio', 'Attach local narration or background music to a project. Export automatically mixes it into the MP4.', {
    projectId: stringProp('Project id'),
    audioPath: stringProp('Local audio path'),
    role: { type: 'string', enum: ['narration', 'music'], description: 'Audio role' },
    volumeDb: numberProp('Optional mix volume in dB'),
  }, ['projectId', 'audioPath']),
  tool('apply_video_package', 'Create or update a project from a manifest.json video-package directory.', {
    directory: stringProp('Local package directory'),
    projectId: stringProp('Optional existing project id'),
  }, ['directory']),
  tool('preview_project', 'Return the current preview/frame HTML path, generating a template preview when needed.', {
    projectId: stringProp('Project id'),
  }, ['projectId']),
  tool('check_visual_variety', 'Check the final-video visual variety gate without rendering. Returns exact failures and revision guidance.', {
    projectId: stringProp('Project id'),
  }, ['projectId']),
  tool('render_project', 'Run the visual-variety quality gate, then render a project to MP4. Long single-layout subtitle-card videos are rejected.', {
    projectId: stringProp('Project id'),
    output: stringProp('Optional output MP4 path'),
  }, ['projectId']),
] as const;

export async function startMcpServer(ctx: CliContext): Promise<void> {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      sendError(null, -32700, 'Parse error');
      continue;
    }
    await handleMessage(ctx, message);
  }
}

async function handleMessage(ctx: CliContext, message: RpcMessage): Promise<void> {
  const { id, method, params } = message;
  if (!method) return;
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (id === undefined) return;

  try {
    if (method === 'initialize') {
      const requested = typeof params?.protocolVersion === 'string'
        ? params.protocolVersion
        : '2025-06-18';
      return sendResult(id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'html-video', version: '0.2.0' },
        instructions: 'Generate video HTML/storyboards externally. Required flow: create_project, get_design_context, write_design_plan, author varied storyboard/HTML, attach audio, and render. Custom HTML must be fully self-contained and offline-safe: inline CSS/JavaScript, use system-font fallbacks, and use only data URLs or relative project assets; CDN, remote, file://, and machine-absolute dependencies are rejected. Videos 12s+ need at least 3 semantic visual beats, 2 layout families, 2 motion families, 3 component types, and transitions. Single-layout subtitle-card videos are prohibited.',
      });
    }
    if (method === 'ping') return sendResult(id, {});
    if (method === 'tools/list') return sendResult(id, { tools: TOOLS });
    if (method === 'tools/call') {
      const name = requiredString(params ?? {}, 'name');
      const args = isRecord(params?.arguments) ? params.arguments : {};
      const result = await callTool(ctx, name, args);
      return sendResult(id, toolResult(result));
    }
    sendError(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (method === 'tools/call') return sendResult(id, toolResult({ error: messageText }, true));
    sendError(id, -32603, messageText);
  }
}

async function callTool(ctx: CliContext, name: string, args: ToolArguments): Promise<unknown> {
  switch (name) {
    case 'create_project': {
      const project = await ctx.orchestrator.create({
        name: requiredString(args, 'name'),
        ...(optionalString(args, 'intent') && { intent: optionalString(args, 'intent') }),
        preferences: {
          ...(optionalString(args, 'aspect') && { aspect: optionalString(args, 'aspect') }),
        },
      });
      return {
        project,
        nextSteps: ['get_design_context', 'write_design_plan'],
        guidance: 'Define a visual identity before HTML. Style packs and templates are optional; packs may be mixed or omitted for a fully custom design.',
      };
    }
    case 'list_projects':
      return { projects: await ctx.orchestrator.list() };
    case 'get_project':
      return { project: await ctx.orchestrator.load(requiredString(args, 'projectId')) };
    case 'search_templates': {
      const matches = ctx.templates.search({
        ...(optionalString(args, 'intent') && { intent: optionalString(args, 'intent') }),
        ...(optionalString(args, 'aspect') && { aspect: optionalString(args, 'aspect') }),
        enginesAvailable: ctx.engines.list().map((engine) => engine.id),
        top: optionalNumber(args, 'top') ?? 5,
      });
      return {
        matches: matches.map(({ template, score, reason }) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          engine: template.engine,
          score,
          reason,
          bestFor: template.best_for,
          poster: template.preview.poster,
        })),
      };
    }
    case 'inspect_template':
      return { template: ctx.templates.get(requiredString(args, 'templateId')) };
    case 'get_design_context':
      return getDesignContext(
        ctx,
        requiredString(args, 'projectId'),
        Math.max(1, Math.min(20, Math.floor(optionalNumber(args, 'recentLimit') ?? 8))),
      );
    case 'write_design_plan': {
      if (!isRecord(args.designPlan)) throw new Error('designPlan must be an object');
      return writeDesignPlan(ctx, requiredString(args, 'projectId'), args.designPlan);
    }
    case 'get_design_plan':
      return getDesignPlan(ctx, requiredString(args, 'projectId'));
    case 'add_asset': {
      const project = await ctx.orchestrator.addFileAsset(
        requiredString(args, 'projectId'),
        resolve(requiredString(args, 'file')),
        optionalString(args, 'caption'),
      );
      return { project, asset: project.assets.at(-1) };
    }
    case 'write_html': {
      const projectId = requiredString(args, 'projectId');
      const result = await writeSingleHtml(ctx, projectId, requiredString(args, 'html'), {
        ...(optionalNumber(args, 'durationSec') !== undefined && { durationSec: optionalNumber(args, 'durationSec') }),
        ...(optionalString(args, 'nodeId') && { nodeId: optionalString(args, 'nodeId') }),
      });
      return {
        project: result.project,
        frame: result.frame,
        visualVariety: await assessProjectVisualVariety(ctx, projectId),
        ...(await designPlanAdvisory(ctx, projectId)),
      };
    }
    case 'write_storyboard': {
      if (!isRecord(args.graph)) throw new Error('graph must be an object');
      const result = await writeContentGraphValue(
        ctx,
        requiredString(args, 'projectId'),
        args.graph as unknown as ContentGraph,
      );
      return { ...result, ...(await designPlanAdvisory(ctx, requiredString(args, 'projectId'))) };
    }
    case 'write_frame_html': {
      const result = await writeFrameHtmlValue(
        ctx,
        requiredString(args, 'projectId'),
        requiredString(args, 'nodeId'),
        requiredString(args, 'html'),
      );
      return { ...result, ...(await designPlanAdvisory(ctx, requiredString(args, 'projectId'))) };
    }
    case 'attach_audio': {
      const role = optionalString(args, 'role');
      if (role && role !== 'narration' && role !== 'music') throw new Error('role must be narration or music');
      const audioRole = role as 'narration' | 'music' | undefined;
      return attachProjectAudio(ctx, requiredString(args, 'projectId'), requiredString(args, 'audioPath'), {
        ...(audioRole && { role: audioRole }),
        ...(optionalNumber(args, 'volumeDb') !== undefined && { volumeDb: optionalNumber(args, 'volumeDb') }),
      });
    }
    case 'apply_video_package': {
      return applyVideoPackage(ctx, requiredString(args, 'directory'), {
        ...(optionalString(args, 'projectId') && { projectId: optionalString(args, 'projectId') }),
      });
    }
    case 'preview_project': {
      const projectId = requiredString(args, 'projectId');
      let project = await ctx.orchestrator.load(projectId);
      if (!project.lastPreviewHtmlPath && project.templateId) {
        project = (await ctx.orchestrator.renderPreviewHtml(projectId)).project;
      }
      const firstFrame = [...(project.frames ?? [])].sort((a, b) => a.order - b.order)[0];
      return {
        projectId,
        htmlPath: firstFrame?.htmlPath ?? project.lastPreviewHtmlPath ?? null,
        studioPreviewUrl: `http://127.0.0.1:3071/preview/${projectId}`,
      };
    }
    case 'check_visual_variety':
      return assessProjectVisualVariety(ctx, requiredString(args, 'projectId'));
    case 'render_project': {
      const projectId = requiredString(args, 'projectId');
      const visualVariety = await assertProjectVisualVariety(ctx, projectId);
      const result = await ctx.orchestrator.exportMp4({
        projectId,
        ...(optionalString(args, 'output') && { outputPath: resolve(optionalString(args, 'output')!) }),
      });
      return { projectId, outputPath: result.outputPath, status: result.project.status, visualVariety };
    }
    case 'render_subtitle_video':
      throw new Error('The single-layout subtitle renderer is disabled for AI MCP calls. Use create_project → get_design_context → write_design_plan → write_html/write_storyboard → attach_audio → render_project.');
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties,
      additionalProperties: false,
      ...(required.length > 0 && { required }),
    },
  };
}

function stringProp(description: string) { return { type: 'string', description }; }
function numberProp(description: string) { return { type: 'number', description }; }
function objectProp(description: string) { return { type: 'object', description, additionalProperties: true }; }

function toolResult(value: unknown, isError = false) {
  const text = JSON.stringify(value, null, 2);
  return {
    content: [{ type: 'text', text }],
    structuredContent: isRecord(value) ? value : { value },
    ...(isError && { isError: true }),
  };
}

function sendResult(id: RpcMessage['id'], result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function sendError(id: RpcMessage['id'], code: number, message: string): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const result = value[key];
  if (typeof result !== 'string' || !result.trim()) throw new Error(`${key} is required`);
  return result;
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const result = value[key];
  return typeof result === 'string' && result.trim() ? result : undefined;
}

function optionalNumber(value: Record<string, unknown>, key: string): number | undefined {
  const result = value[key];
  return typeof result === 'number' && Number.isFinite(result) ? result : undefined;
}

async function designPlanAdvisory(ctx: CliContext, projectId: string) {
  return await hasDesignPlan(ctx, projectId)
    ? {}
    : { designPlanWarning: 'No design-plan.json exists. This legacy-compatible write was accepted; call get_design_context then write_design_plan before further HTML authoring.' };
}
