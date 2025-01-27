// src/validator.ts
import * as yaml from 'yaml';

interface ValidationIssue {
    message: string;
    severity: string;
    position: {
        start: number;
        end: number;
    };
}

interface Container {
    resources?: any;
    image?: string;
}

interface K8sManifest {
    kind?: string;
    apiVersion?: string;
    spec?: {
        containers?: Container[];
        hostNetwork?: boolean;
    };
}

export async function validateK8sFile(content: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    try {
        const documents = yaml.parseAllDocuments(content);
        
        for (const doc of documents) {
            const manifest = doc.toJSON() as K8sManifest;
            
            // Skip empty documents
            if (!manifest) continue;

            // Basic validation checks
            if (!manifest.kind) {
                issues.push({
                    message: 'Missing required field "kind"',
                    severity: 'error',
                    position: getPosition(doc, 'kind')
                });
            }

            if (!manifest.apiVersion) {
                issues.push({
                    message: 'Missing required field "apiVersion"',
                    severity: 'error',
                    position: getPosition(doc, 'apiVersion')
                });
            }

            // Resource validation
            if (manifest.spec?.containers) {
                manifest.spec.containers.forEach((container: Container, index: number) => {
                    if (!container.resources) {
                        issues.push({
                            message: 'Container is missing resource limits/requests',
                            severity: 'warning',
                            position: getContainerPosition(doc, index)
                        });
                    }
                    
                    if (container.image?.includes(':latest')) {
                        issues.push({
                            message: 'Using latest tag is not recommended',
                            severity: 'warning',
                            position: getContainerPosition(doc, index)
                        });
                    }
                });
            }

            // Security checks
            if (manifest.spec?.hostNetwork) {
                issues.push({
                    message: 'Host network access enabled - security risk',
                    severity: 'warning',
                    position: getPosition(doc, 'spec.hostNetwork')
                });
            }
        }
    } catch (error) {
        issues.push({
            message: `YAML parsing error: ${error}`,
            severity: 'error',
            position: { start: 0, end: content.length }
        });
    }

    return issues;
}

function getPosition(doc: yaml.Document.Parsed, path: string): { start: number; end: number } {
    try {
        const node = doc.getIn(path.split('.'));
        if (node && typeof node === 'object' && 'range' in node && Array.isArray(node.range)) {
            return {
                start: node.range[0],
                end: node.range[1]
            };
        }
    } catch (error) {
        console.error(`Error getting position for path ${path}:`, error);
    }
    return { start: 0, end: 0 };
}

function getContainerPosition(doc: yaml.Document.Parsed, index: number): { start: number; end: number } {
    try {
        const containersNode = doc.getIn(['spec', 'containers']);
        if (containersNode && typeof containersNode === 'object' && 'items' in containersNode && Array.isArray(containersNode.items)) {
            const containerNode = containersNode.items[index];
            if (containerNode && 'range' in containerNode && Array.isArray(containerNode.range)) {
                return {
                    start: containerNode.range[0],
                    end: containerNode.range[1]
                };
            }
        }
    } catch (error) {
        console.error(`Error getting container position for index ${index}:`, error);
    }
    return { start: 0, end: 0 };
}