# Change Log

All notable changes to the "validyml" extension are documented in this file.

## [0.1.1] - 2026-10-28

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
- Missing `activationEvents` and an undeclared `validyml.enableAutoValidation` setting (read as undefined) meant auto-validation never fired until a command was run manually; the setting is now contributed with a default of `true`

### Changed
- Validation core extracted into pure modules (`validator.ts`, `mcpValidator.ts`, `common.ts`) with no `vscode` dependency, enabling plain-Node testing

## [0.1.0] - 2025-04-15

### Added
- Docker Compose network validation: warns when a network is `external` but also sets a `driver`
- Docker Compose environment variable validation: errors on malformed `${...}` substitution

## [0.0.3] - 2025-01-29

### Added
- Marketplace keywords and tags to improve discoverability

## [0.0.2] - 2025-01-29

### Added
- Docker Compose support: `dockercompose` language with syntax highlighting for `docker-compose*.yml` / `compose.yml`
- Docker Compose validation for services, images, resource limits, and host volume mounts
- YAML syntax highlighting grammar and language configuration

### Changed
- Validation and extension activation reworked to handle YAML and Docker Compose files

## [0.0.1] - 2025-01-27

### Added
- Initial release
- Kubernetes YAML validation: required fields, `:latest` image tags, and missing resource limits
- Command Palette commands: `ValidYML: Validate Current File` and `ValidYML: Clean Current File`
- Clean command removes null/empty values and common Kubernetes defaults
- Packaging and publish workflows
