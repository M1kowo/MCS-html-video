# Client connections

The MCP server is a local stdio process:

```text
node <repository>/packages/cli/dist/bin.js mcp
```

For Codex and ChatGPT Desktop, add a project-scoped `.codex/config.toml`:

```toml
[mcp_servers.html-video]
command = "node"
args = ["<repository>/packages/cli/dist/bin.js", "mcp"]
cwd = "<repository>"
tool_timeout_sec = 1800
```

ChatGPT Desktop can also add this through Settings → MCP servers → Add server → STDIO. Codex CLI and supported Codex clients can share that host configuration.

Other local MCP clients typically accept the equivalent JSON:

```json
{
  "html-video": {
    "command": "node",
    "args": ["<repository>/packages/cli/dist/bin.js", "mcp"],
    "cwd": "<repository>"
  }
}
```

Cloud-only ChatGPT web sessions cannot launch a process or read arbitrary local files. They require a plugin-backed remote MCP plus a deliberate file-transfer path.
