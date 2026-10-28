// src/common.ts
// Shared types + helpers for all validators. Pure module — no vscode imports,
// so validation logic stays testable in plain Node.
import * as yaml from 'yaml';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
    message: string;
    severity: Severity;
    position: {
        start: number;
        end: number;
    };
}

function hasRange(node: unknown): node is { range: [number, number] } {
    return (
        typeof node === 'object' &&
        node !== null &&
        'range' in node &&
        Array.isArray((node as { range: unknown }).range) &&
        (node as { range: unknown[] }).range.length >= 2
    );
}

export function getNodePosition(
    doc: yaml.Document.Parsed,
    path: (string | number)[]
): { start: number; end: number } {
    try {
        const node = doc.getIn(path, true);
        if (hasRange(node)) {
            return { start: node.range[0], end: node.range[1] };
        }
    } catch {
        // fall through to document-wide range
    }
    return { start: 0, end: doc.toString().length };
}

export function createIssue(
    doc: yaml.Document.Parsed,
    path: (string | number)[],
    message: string,
    severity: Severity
): ValidationIssue {
    return { message, severity, position: getNodePosition(doc, path) };
}

// ---------------------------------------------------------------------------
// Secret detection
// ---------------------------------------------------------------------------

// High-signal token shapes only — generic "long random string" heuristics
// produce too many false positives in editor diagnostics.
const SECRET_PATTERNS = new RegExp(
    [
        'sk-[A-Za-z0-9]{16,}', // OpenAI / Anthropic-style keys
        'gh[pousr]_[A-Za-z0-9]{20,}', // GitHub tokens
        'AKIA[0-9A-Z]{16}', // AWS access key id
        'xox[bap]-[A-Za-z0-9-]{10,}', // Slack tokens
        '-----BEGIN [A-Z ]*PRIVATE KEY-----' // PEM material
    ].join('|')
);

// ${TOKEN}, $TOKEN — references to the environment, not inline secrets.
const ENV_REFERENCE = /^\$\{?[A-Za-z_][A-Za-z0-9_]*(:-[^}]*)?\}?$/;

export function looksLikeInlineSecret(value: unknown): boolean {
    return (
        typeof value === 'string' &&
        !ENV_REFERENCE.test(value.trim()) &&
        SECRET_PATTERNS.test(value)
    );
}

// ---------------------------------------------------------------------------
// Image tag helpers
// ---------------------------------------------------------------------------

// True when the image is pinned to neither a tag nor a digest,
// or is explicitly pinned to :latest. Registry ports (host:5000/img) are
// handled by inspecting only the last path segment.
export function isUnpinnedImage(image: unknown): boolean {
    if (typeof image !== 'string' || image.length === 0) {
        return false;
    }
    if (image.includes('@sha256:')) {
        return false; // digest-pinned
    }
    const lastSegment = image.split('/').pop() ?? image;
    if (!lastSegment.includes(':')) {
        return true; // untagged
    }
    return lastSegment.endsWith(':latest');
}
