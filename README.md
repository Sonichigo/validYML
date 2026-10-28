# ValidYML VSCode Extension

## Overview
ValidYML is a VS Code extension that validates Kubernetes manifests, Docker Compose files, and MCP (Model Context Protocol) client configs as you edit them, and can clean up Kubernetes YAML in one command.

## Features

### 1. Kubernetes Validation
- Required fields: `kind`, `apiVersion`, `metadata.name`
- Containers and init containers in Pods and in templated workloads (Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob)
- Multi-document files (`---`-separated)
- Checks:
  - Untagged or `:latest` images (digest-pinned `@sha256:` images are accepted)
  - Missing `resources.limits`
  - `privileged` containers (error)
  - Missing `readinessProbe` on Deployments and StatefulSets

### 2. Docker Compose Validation
- Detected by filename or by shape (a top-level `services:` mapping), including `compose.yaml` / `compose.yml`
- Checks:
  - Services need `image` or `build`
  - Untagged or `:latest` images
  - `privileged` services (error)
  - Hardcoded secrets in `environment` (map and list forms) and malformed variable substitution
  - Docker socket mounts and host bind mounts (named volumes are not flagged)
  - Obsolete top-level `version` field
  - External networks that also set a driver

### 3. MCP Config Validation
- Validates `.mcp.json`, `mcp.json`, `claude_desktop_config.json`, and any `*.mcp.json`
- Checks:
  - Transport shape: exactly one of `command` (stdio) or `url` (remote)
  - Deprecated `sse` transport (use Streamable HTTP) and unknown transport types
  - Hardcoded secrets in `env` (`${VAR}` references are fine)
  - Unpinned `npx` / `uvx` / `pipx` packages
  - Remote servers over plain `http://`

### 4. Kubernetes YAML Cleaning
- Removes null and empty values
- Removes common defaults: `namespace: default`, `protocol: TCP` on Service ports, `imagePullPolicy: IfNotPresent`, and default termination message settings
- Reformats consistently

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "ValidYML"
4. Click Install

Or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Sonichigo.validyml).

## Usage

### Commands
Access these commands through the Command Palette (Ctrl+Shift+P):
- `ValidYML: Validate Current File` - Manually trigger validation
- `ValidYML: Clean Current File` - Clean and format the current Kubernetes YAML file

Results appear in the Problems panel and as inline diagnostics.

### Settings
- `validyml.enableAutoValidation` (default `true`): validate files as they are opened or edited. Reload the window after changing it.

## Examples

### Validation Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  containers:
  - name: web
    image: nginx:latest
```

Validation will show:
- Warning: Container 'web' uses an untagged or ':latest' image
- Warning: Container 'web' has no resources.limits

### Cleaning Example
Before:
```yaml
apiVersion: v1
kind: Service
metadata:
  namespace: default
spec:
  ports:
  - port: 80
    protocol: TCP
  selector:
    app: null
```

After:
```yaml
apiVersion: v1
kind: Service
spec:
  ports:
  - port: 80
```

## Requirements
- Visual Studio Code 1.96.0 or higher

## Known Issues
- Cleaning is Kubernetes-oriented; don't run it on Compose or MCP files
- Some advanced Kubernetes CRDs are only checked for the basic required fields

## Release Notes
See [CHANGELOG.md](CHANGELOG.md).

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
This project is licensed under the Apache-2.0 License - see the LICENSE file for details.

## Support
For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments
- Based on the ValidYML project
- Uses YAML parsing from yaml.js
- Inspired by Kubernetes best practices

## Authors
Animesh Pathak - [Sonichigo](https://github.com/sonichigo)

## Project Status
Active development - Contributions welcome!