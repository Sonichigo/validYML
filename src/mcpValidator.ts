// src/mcpValidator.ts
// Validation for MCP (Model Context Protocol) client configuration files:
// .mcp.json / mcp.json / claude_desktop_config.json — any document with an
// `mcpServers` mapping. JSON is a subset of YAML, so the same parsed
// yaml.Document flows through here with position info intact.
import * as yaml from 'yaml';
import {
    createIssue,
    looksLikeInlineSecret,
    ValidationIssue
} from './common';

const KNOWN_TRANSPORTS = new Set([
    'stdio',
    'http',
    'streamable-http',
    'streamable_http'
]);

// Commands that download-and-run a package at launch time.
const EPHEMERAL_RUNNERS = new Set(['npx', 'uvx', 'pipx', 'bunx', 'dlx']);

export function isMcpConfig(config: Record<string, unknown>): boolean {
    return (
        typeof config === 'object' &&
        config !== null &&
        ('mcpServers' in config || 'mcp_servers' in config)
    );
}

export function validateMcpConfig(
    doc: yaml.Document.Parsed,
    config: Record<string, unknown>,
    issues: ValidationIssue[]
): void {
    const serversKey = 'mcpServers' in config ? 'mcpServers' : 'mcp_servers';
    const servers = config[serversKey];

    if (
        typeof servers !== 'object' ||
        servers === null ||
        Array.isArray(servers) ||
        Object.keys(servers).length === 0
    ) {
        issues.push(
            createIssue(
                doc,
                [serversKey],
                `'${serversKey}' must be a non-empty mapping of server name to config`,
                'error'
            )
        );
        return;
    }

    for (const [name, entry] of Object.entries(servers)) {
        const basePath = [serversKey, name];

        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            issues.push(
                createIssue(doc, basePath, `Server '${name}' must be a mapping`, 'error')
            );
            continue;
        }

        const server = entry as Record<string, unknown>;
        const hasCommand = typeof server.command === 'string' && server.command.length > 0;
        const hasUrl = typeof server.url === 'string' && server.url.length > 0;
        const transport = server.type ?? server.transport;

        // Exactly one launch mechanism: stdio (command) or remote (url).
        if (!hasCommand && !hasUrl) {
            issues.push(
                createIssue(
                    doc,
                    basePath,
                    `Server '${name}' needs either 'command' (stdio) or 'url' (remote) — it has neither`,
                    'error'
                )
            );
        } else if (hasCommand && hasUrl) {
            issues.push(
                createIssue(
                    doc,
                    basePath,
                    `Server '${name}' declares both 'command' and 'url' — pick one transport`,
                    'error'
                )
            );
        }

        // Deprecated dual-endpoint HTTP+SSE transport.
        if (transport === 'sse') {
            issues.push(
                createIssue(
                    doc,
                    [...basePath, 'type' in server ? 'type' : 'transport'],
                    `Server '${name}' uses the 'sse' transport. The dual-endpoint HTTP+SSE architecture was deprecated in the 2025-03-26 MCP spec — migrate to Streamable HTTP ('http')`,
                    'warning'
                )
            );
        } else if (transport !== undefined && typeof transport === 'string' && !KNOWN_TRANSPORTS.has(transport)) {
            issues.push(
                createIssue(
                    doc,
                    [...basePath, 'type' in server ? 'type' : 'transport'],
                    `Server '${name}' has unknown transport '${transport}'`,
                    'error'
                )
            );
        }

        // Hardcoded secrets in env.
        if (typeof server.env === 'object' && server.env !== null && !Array.isArray(server.env)) {
            for (const [envKey, envValue] of Object.entries(server.env as Record<string, unknown>)) {
                if (looksLikeInlineSecret(envValue)) {
                    issues.push(
                        createIssue(
                            doc,
                            [...basePath, 'env', envKey],
                            `'${envKey}' looks like a hardcoded secret — reference an environment variable (e.g. \${${envKey}}) instead`,
                            'error'
                        )
                    );
                }
            }
        }

        // Unpinned package execution — the agent runs whatever is latest at launch time.
        if (hasCommand && EPHEMERAL_RUNNERS.has(server.command as string)) {
            const args = Array.isArray(server.args) ? server.args : [];
            const pkg = args.find(
                (a): a is string => typeof a === 'string' && !a.startsWith('-')
            );
            // Scoped packages (@org/pkg) contain a leading '@' that is not a
            // version separator — strip it before checking for a pin.
            if (pkg !== undefined && !pkg.slice(1).includes('@')) {
                issues.push(
                    createIssue(
                        doc,
                        [...basePath, 'args'],
                        `Package '${pkg}' is not version-pinned — pin it (e.g. '${pkg}@1.2.3') so the agent runs a known version`,
                        'warning'
                    )
                );
            }
        }

        // Remote server over plain HTTP.
        if (hasUrl && (server.url as string).startsWith('http://')) {
            issues.push(
                createIssue(
                    doc,
                    [...basePath, 'url'],
                    `Server '${name}' is reached over plain http:// — tokens and tool results travel unencrypted; use https://`,
                    'warning'
                )
            );
        }
    }
}
