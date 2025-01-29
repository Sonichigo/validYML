// src/validator.ts
import * as yaml from 'yaml';
import * as vscode from 'vscode';

interface ValidationIssue {
    message: string;
    severity: string;
    position: {
        start: number;
        end: number;
    };
}

function hasRange(node: any): node is { range: [number, number] } {
    return node && 'range' in node && Array.isArray(node.range) && node.range.length === 2;
}

export async function validateFile(document: vscode.TextDocument): Promise<ValidationIssue[]> {
    try {
        const content = document.getText();
        const fileName = document.fileName.toLowerCase();
        const doc = yaml.parseDocument(content);
        const issues: ValidationIssue[] = [];

        // Basic YAML validation
        if (doc.errors.length > 0) {
            doc.errors.forEach(error => {
                issues.push({
                    message: `YAML Error: ${error.message}`,
                    severity: 'error',
                    position: {
                        start: error.pos?.[0] ?? 0,
                        end: error.pos?.[1] ?? content.length
                    }
                });
            });
            return issues;
        }

        const parsedDoc = doc.toJSON();

        // Docker Compose validation
        if (fileName.includes('docker-compose')) {
            validateDockerCompose(doc, parsedDoc, issues);
        } 
        // Kubernetes validation
        else if (parsedDoc.apiVersion && parsedDoc.kind) {
            validateKubernetes(doc, parsedDoc, issues);
        }
        // Generic YAML validation
        else {
            issues.push({
                message: 'File type not recognized. Supported types: Kubernetes manifests and Docker Compose files.',
                severity: 'info',
                position: { start: 0, end: content.length }
            });
        }

        return issues;
    } catch (error) {
        return [{
            message: `Failed to parse YAML: ${error}`,
            severity: 'error',
            position: { start: 0, end: document.getText().length }
        }];
    }
}

function validateDockerCompose(doc: yaml.Document.Parsed, config: any, issues: ValidationIssue[]) {
    // Version check
    if (!config.version) {
        issues.push(createIssue(doc, ['version'], 'Docker Compose version should be specified', 'warning'));
    }

    // Services validation
    if (!config.services || Object.keys(config.services).length === 0) {
        issues.push(createIssue(doc, ['services'], 'No services defined in Docker Compose file', 'error'));
        return;
    }

    // Validate each service
    Object.entries(config.services).forEach(([serviceName, service]: [string, any]) => {
        const servicePath = ['services', serviceName];

        // Image/Build validation
        if (!service.image && !service.build) {
            issues.push(createIssue(doc, servicePath, `Service '${serviceName}' must specify either image or build`, 'error'));
        }

        // Latest tag check
        if (service.image?.includes(':latest')) {
            issues.push(createIssue(doc, [...servicePath, 'image'], `Service '${serviceName}' uses latest tag which is not recommended`, 'warning'));
        }

        // Resource limits
        if (!service.deploy?.resources?.limits) {
            issues.push(createIssue(doc, servicePath, `Service '${serviceName}' should specify resource limits`, 'warning'));
        }

        // Volume mounts
        if (Array.isArray(service.volumes)) {
            service.volumes.forEach((volume: string, idx: number) => {
                if (typeof volume === 'string' && (volume.startsWith('/') || volume.includes(':'))) {
                    issues.push(createIssue(
                        doc, 
                        [...servicePath, 'volumes', String(idx)], 
                        `Service '${serviceName}' uses host volume mount which may be a security risk`,
                        'warning'
                    ));
                }
            });
        }
    });
}

function validateKubernetes(doc: yaml.Document.Parsed, manifest: any, issues: ValidationIssue[]) {
    // Required fields
    if (!manifest.kind) {
        issues.push(createIssue(doc, ['kind'], 'Missing required field "kind"', 'error'));
    }
    if (!manifest.apiVersion) {
        issues.push(createIssue(doc, ['apiVersion'], 'Missing required field "apiVersion"', 'error'));
    }

    // Container validation
    if (manifest.spec?.containers) {
        manifest.spec.containers.forEach((container: any, idx: number) => {
            const containerPath = ['spec', 'containers', String(idx)];

            if (!container.resources) {
                issues.push(createIssue(doc, containerPath, 'Container is missing resource limits/requests', 'warning'));
            }
            if (container.image?.includes(':latest')) {
                issues.push(createIssue(doc, [...containerPath, 'image'], 'Using latest tag is not recommended', 'warning'));
            }
        });
    }

    // Security checks
    if (manifest.spec?.hostNetwork) {
        issues.push(createIssue(doc, ['spec', 'hostNetwork'], 'Host network access enabled - security risk', 'warning'));
    }
}

function createIssue(doc: yaml.Document.Parsed, path: string[], message: string, severity: string): ValidationIssue {
    const pos = getNodePosition(doc, path);
    return {
        message,
        severity,
        position: pos
    };
}

function getNodePosition(doc: yaml.Document.Parsed, path: string[]): { start: number; end: number } {
    try {
        const node = doc.getIn(path);
        
        if (hasRange(node)) {
            return {
                start: node.range[0],
                end: node.range[1]
            };
        }
    } catch (error) {
        console.error(`Error getting position for path ${path}:`, error);
    }
    
    // Fallback position
    return { start: 0, end: doc.toString().length };
}