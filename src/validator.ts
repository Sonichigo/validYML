// src/validator.ts
// Pure validation core — no vscode imports, so it is testable in plain Node.
// The extension adapter passes in (content, fileName) from the TextDocument.
import * as yaml from 'yaml';
import {
    createIssue,
    isUnpinnedImage,
    looksLikeInlineSecret,
    ValidationIssue
} from './common';
import { isMcpConfig, validateMcpConfig } from './mcpValidator';

export type { ValidationIssue } from './common';

// Minimal structural type so the adapter works with vscode.TextDocument
// without importing vscode here.
interface TextDocumentLike {
    getText(): string;
    fileName: string;
}

export async function validateFile(document: TextDocumentLike): Promise<ValidationIssue[]> {
    return validateContent(document.getText(), document.fileName);
}

export function validateContent(content: string, fileName: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const lowerName = fileName.toLowerCase();

    let documents: yaml.Document.Parsed[];
    try {
        // K8s files are routinely multi-document ('---'); JSON is a subset of
        // YAML so MCP config files parse through the same path with ranges.
        documents = yaml.parseAllDocuments(content);
    } catch (error) {
        return [
            {
                message: `Failed to parse file: ${error}`,
                severity: 'error',
                position: { start: 0, end: content.length }
            }
        ];
    }

    let recognizedAny = false;

    for (const doc of documents) {
        if (doc.errors.length > 0) {
            for (const error of doc.errors) {
                issues.push({
                    message: `YAML Error: ${error.message}`,
                    severity: 'error',
                    position: {
                        start: error.pos?.[0] ?? 0,
                        end: error.pos?.[1] ?? content.length
                    }
                });
            }
            recognizedAny = true;
            continue;
        }

        const parsed: unknown = doc.toJSON();
        if (parsed === null || typeof parsed !== 'object') {
            continue;
        }
        const config = parsed as Record<string, unknown>;

        // Detection is shape-first. Filename is only a hint for Compose,
        // covering modern default names (compose.yaml) the old
        // fileName.includes('docker-compose') check missed.
        if (isMcpConfig(config)) {
            validateMcpConfig(doc, config, issues);
            recognizedAny = true;
        } else if (config.apiVersion !== undefined && config.kind !== undefined) {
            validateKubernetes(doc, config, issues);
            recognizedAny = true;
        } else if (isComposeFile(config, lowerName)) {
            validateDockerCompose(doc, config, issues);
            recognizedAny = true;
        }
    }

    if (!recognizedAny && issues.length === 0) {
        issues.push({
            message:
                'File type not recognized. Supported: Kubernetes manifests, Docker Compose files, and MCP server configs.',
            severity: 'info',
            position: { start: 0, end: content.length }
        });
    }

    return issues;
}

function isComposeFile(config: Record<string, unknown>, lowerName: string): boolean {
    const hasServicesMap =
        typeof config.services === 'object' &&
        config.services !== null &&
        !Array.isArray(config.services);
    const composeName =
        lowerName.includes('docker-compose') ||
        /(^|[\\/])compose[^\\/]*\.ya?ml$/.test(lowerName);
    return hasServicesMap || (composeName && 'services' in config);
}

// ---------------------------------------------------------------------------
// Docker Compose
// ---------------------------------------------------------------------------

function validateDockerCompose(
    doc: yaml.Document.Parsed,
    config: Record<string, unknown>,
    issues: ValidationIssue[]
): void {
    // The Compose Specification deprecated the top-level 'version' field —
    // it is informational-only and Compose v2 ignores it.
    if (config.version !== undefined) {
        issues.push(
            createIssue(
                doc,
                ['version'],
                "The top-level 'version' field is obsolete in the Compose Specification and can be removed",
                'info'
            )
        );
    }

    const services = config.services;
    if (
        typeof services !== 'object' ||
        services === null ||
        Object.keys(services).length === 0
    ) {
        issues.push(
            createIssue(doc, ['services'], 'No services defined in Docker Compose file', 'error')
        );
        return;
    }

    if (typeof config.networks === 'object' && config.networks !== null) {
        for (const [networkName, network] of Object.entries(
            config.networks as Record<string, unknown>
        )) {
            const net = network as Record<string, unknown> | null;
            if (net?.external === true && net.driver !== undefined) {
                issues.push(
                    createIssue(
                        doc,
                        ['networks', networkName],
                        `Network '${networkName}' is marked as external but has driver configuration`,
                        'warning'
                    )
                );
            }
        }
    }

    for (const [serviceName, serviceValue] of Object.entries(
        services as Record<string, unknown>
    )) {
        const servicePath = ['services', serviceName];

        if (typeof serviceValue !== 'object' || serviceValue === null) {
            issues.push(
                createIssue(doc, servicePath, `Service '${serviceName}' must be a mapping`, 'error')
            );
            continue;
        }
        const service = serviceValue as Record<string, unknown>;

        // Image/Build validation
        if (service.image === undefined && service.build === undefined) {
            issues.push(
                createIssue(
                    doc,
                    servicePath,
                    `Service '${serviceName}' must specify either image or build`,
                    'error'
                )
            );
        }

        // Untagged or :latest images
        if (isUnpinnedImage(service.image)) {
            issues.push(
                createIssue(
                    doc,
                    [...servicePath, 'image'],
                    `Service '${serviceName}' uses an untagged or ':latest' image — deploys are not reproducible`,
                    'warning'
                )
            );
        }

        // Privileged mode
        if (service.privileged === true) {
            issues.push(
                createIssue(
                    doc,
                    [...servicePath, 'privileged'],
                    `Service '${serviceName}' runs privileged — full host access from this container`,
                    'error'
                )
            );
        }

        // Environment variables: malformed interpolation + hardcoded secrets.
        // (This block previously sat outside the service loop, referencing an
        // undefined 'service' variable — it never ran.)
        const envEntries = normalizeEnvironment(service.environment);
        for (const [key, value] of envEntries) {
            if (typeof value === 'string' && value.includes('${') && !value.includes('}')) {
                issues.push(
                    createIssue(
                        doc,
                        [...servicePath, 'environment'],
                        `Environment variable '${key}' in service '${serviceName}' has malformed variable substitution`,
                        'error'
                    )
                );
            }
            if (looksLikeInlineSecret(value)) {
                issues.push(
                    createIssue(
                        doc,
                        [...servicePath, 'environment'],
                        `'${key}' in service '${serviceName}' looks like a hardcoded secret — use env_file or variable interpolation`,
                        'error'
                    )
                );
            }
        }

        // Volumes: only genuine host bind mounts are flagged. Named volumes
        // ('pgdata:/var/lib/postgresql/data') are the recommended pattern and
        // must not produce warnings.
        if (Array.isArray(service.volumes)) {
            service.volumes.forEach((volume: unknown, idx: number) => {
                const source = volumeSource(volume);
                if (source === undefined) {
                    return;
                }
                if (source.startsWith('/var/run/docker.sock')) {
                    issues.push(
                        createIssue(
                            doc,
                            [...servicePath, 'volumes', idx],
                            `Service '${serviceName}' mounts the Docker socket — the container can control the host Docker daemon`,
                            'warning'
                        )
                    );
                } else if (isHostPath(source)) {
                    issues.push(
                        createIssue(
                            doc,
                            [...servicePath, 'volumes', idx],
                            `Service '${serviceName}' bind-mounts host path '${source}' — review whether the container needs host filesystem access`,
                            'info'
                        )
                    );
                }
            });
        }
    }
}

function normalizeEnvironment(env: unknown): [string, unknown][] {
    if (Array.isArray(env)) {
        // List form: ["KEY=value", ...]
        return env
            .filter((e): e is string => typeof e === 'string' && e.includes('='))
            .map(e => {
                const idx = e.indexOf('=');
                return [e.slice(0, idx), e.slice(idx + 1)] as [string, unknown];
            });
    }
    if (typeof env === 'object' && env !== null) {
        return Object.entries(env as Record<string, unknown>);
    }
    return [];
}

function volumeSource(volume: unknown): string | undefined {
    if (typeof volume === 'string') {
        const idx = volume.indexOf(':');
        return idx > 0 ? volume.slice(0, idx) : undefined;
    }
    if (typeof volume === 'object' && volume !== null) {
        const v = volume as Record<string, unknown>;
        return v.type === 'bind' && typeof v.source === 'string' ? v.source : undefined;
    }
    return undefined;
}

function isHostPath(source: string): boolean {
    return (
        source.startsWith('/') ||
        source.startsWith('./') ||
        source.startsWith('../') ||
        source.startsWith('~')
    );
}

// ---------------------------------------------------------------------------
// Kubernetes
// ---------------------------------------------------------------------------

const WORKLOAD_KINDS_WITH_TEMPLATE = new Set([
    'Deployment',
    'StatefulSet',
    'DaemonSet',
    'ReplicaSet',
    'Job'
]);

const ROLLOUT_KINDS = new Set(['Deployment', 'StatefulSet']);

function validateKubernetes(
    doc: yaml.Document.Parsed,
    manifest: Record<string, unknown>,
    issues: ValidationIssue[]
): void {
    const kind = typeof manifest.kind === 'string' ? manifest.kind : '';

    if (!manifest.kind) {
        issues.push(createIssue(doc, ['kind'], 'Missing required field "kind"', 'error'));
    }
    if (!manifest.apiVersion) {
        issues.push(createIssue(doc, ['apiVersion'], 'Missing required field "apiVersion"', 'error'));
    }
    const metadata = manifest.metadata as Record<string, unknown> | undefined;
    if (kind !== 'List' && !metadata?.name && !metadata?.generateName) {
        issues.push(createIssue(doc, ['metadata', 'name'], 'Missing metadata.name', 'error'));
    }

    // Resolve the pod spec: bare Pods carry containers at spec.*; workload
    // kinds nest them under spec.template.spec.* (the previous version only
    // checked spec.containers, so Deployments were never validated).
    const spec = manifest.spec as Record<string, unknown> | undefined;
    let podSpec: Record<string, unknown> | undefined;
    let podSpecPath: (string | number)[];

    if (kind === 'Pod') {
        podSpec = spec;
        podSpecPath = ['spec'];
    } else if (WORKLOAD_KINDS_WITH_TEMPLATE.has(kind)) {
        const template = spec?.template as Record<string, unknown> | undefined;
        podSpec = template?.spec as Record<string, unknown> | undefined;
        podSpecPath = ['spec', 'template', 'spec'];
    } else if (kind === 'CronJob') {
        const jobTemplate = spec?.jobTemplate as Record<string, unknown> | undefined;
        const jobSpec = jobTemplate?.spec as Record<string, unknown> | undefined;
        const template = jobSpec?.template as Record<string, unknown> | undefined;
        podSpec = template?.spec as Record<string, unknown> | undefined;
        podSpecPath = ['spec', 'jobTemplate', 'spec', 'template', 'spec'];
    } else {
        return; // Services, ConfigMaps, etc. — nothing container-level to check
    }

    if (podSpec === undefined) {
        return;
    }

    for (const containersKey of ['containers', 'initContainers'] as const) {
        const containers = podSpec[containersKey];
        if (!Array.isArray(containers)) {
            continue;
        }
        containers.forEach((containerValue: unknown, idx: number) => {
            const container = containerValue as Record<string, unknown>;
            const containerPath = [...podSpecPath, containersKey, idx];
            const label = `${containersKey === 'initContainers' ? 'Init container' : 'Container'} '${container.name ?? idx}'`;

            if (isUnpinnedImage(container.image)) {
                issues.push(
                    createIssue(
                        doc,
                        [...containerPath, 'image'],
                        `${label} uses an untagged or ':latest' image — deploys are not reproducible`,
                        'warning'
                    )
                );
            }

            const resources = container.resources as Record<string, unknown> | undefined;
            if (!resources?.limits) {
                issues.push(
                    createIssue(
                        doc,
                        containerPath,
                        `${label} has no resources.limits — it can starve the node`,
                        'warning'
                    )
                );
            }

            const securityContext = container.securityContext as
                | Record<string, unknown>
                | undefined;
            if (securityContext?.privileged === true) {
                issues.push(
                    createIssue(
                        doc,
                        [...containerPath, 'securityContext', 'privileged'],
                        `${label} runs privileged — full host access from this container`,
                        'error'
                    )
                );
            }

            if (
                containersKey === 'containers' &&
                ROLLOUT_KINDS.has(kind) &&
                container.readinessProbe === undefined
            ) {
                issues.push(
                    createIssue(
                        doc,
                        containerPath,
                        `${label} has no readinessProbe — rollouts will route traffic to unready pods`,
                        'info'
                    )
                );
            }
        });
    }

    if (podSpec.hostNetwork === true) {
        issues.push(
            createIssue(
                doc,
                [...podSpecPath, 'hostNetwork'],
                'hostNetwork: true — pod shares the node\'s network namespace',
                'warning'
            )
        );
    }
}
