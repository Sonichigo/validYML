## 0.1.0

### Added
- **MCP config validation** — `.mcp.json`, `mcp.json`, `claude_desktop_config.json`, and any `*.mcp.json` file:
  - Transport shape: server needs exactly one of `command` (stdio) or `url` (remote)
  - Deprecated `sse` transport (dual-endpoint HTTP+SSE, removed in the 2025-03-26 MCP spec) — migrate to Streamable HTTP
  - Unknown transport types
  - Hardcoded secrets in `env` (GitHub, OpenAI/Anthropic, AWS, Slack tokens, PEM keys); `${VAR}` references exempt
  - Unpinned `npx`/`uvx`/`pipx` packages (supply-chain drift)
  - Remote servers over plain `http://`
- Secret detection for Docker Compose `environment` (both map and list forms)
- `privileged` checks for Kubernetes containers and Compose services (error)
- Kubernetes `metadata.name` requirement, `initContainers` coverage, missing `readinessProbe` hint for Deployments/StatefulSets
- Digest-pinned images (`@sha256:`) recognized as pinned
- Multi-document YAML support (`---`-separated Kubernetes files)

### Fixed
- Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, and CronJobs are now actually validated — container checks previously only looked at `spec.containers`, so all templated workloads were silently skipped
- Compose environment-variable validation never ran due to an out-of-scope variable reference
- Compose files are now detected by shape (`services:` mapping), covering the modern default filenames `compose.yaml`/`compose.yml`
- Named volumes (e.g. `pgdata:/var/lib/postgresql/data`) are no longer flagged as host mounts; only genuine host bind mounts are reported, with a dedicated warning for Docker-socket mounts
- Top-level Compose `version` field is now reported as obsolete (Compose Specification) instead of being demanded
- Missing `activationEvents` meant auto-validation never fired until a command was run manually

### Changed
- Validation core extracted into pure modules (`validator.ts`, `mcpValidator.ts`, `common.ts`) with no `vscode` dependency, enabling plain-Node testing

# Change Log

All notable changes to the "validyml" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release