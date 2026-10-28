import * as yaml from 'yaml';

// Cleanup only makes sense for Kubernetes manifests: it removes defaults and
// empty values that are meaningful in Compose files or .mcp.json.
export function isKubernetesManifest(content: string): boolean {
    let documents: yaml.Document.Parsed[];
    try {
        documents = yaml.parseAllDocuments(content);
    } catch {
        return false;
    }

    let sawManifest = false;
    for (const doc of documents) {
        if (doc.errors.length > 0) {
            return false;
        }
        const parsed = doc.toJSON();
        if (parsed === null || parsed === undefined) {
            continue;
        }
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            return false;
        }
        const manifest = parsed as Record<string, unknown>;
        if (typeof manifest.apiVersion !== 'string' || typeof manifest.kind !== 'string') {
            return false;
        }
        sawManifest = true;
    }
    return sawManifest;
}

export async function cleanK8sFile(content: string): Promise<string> {
    try {
        const documents = yaml.parseAllDocuments(content);
        const cleanedDocs = documents.map(doc => {
            const manifest = doc.toJSON();
            if (!manifest) return '';

            // Remove empty/null values
            const cleaned = removeEmptyValues(manifest);
            
            // Remove default values
            removeDefaultValues(cleaned);
            
            // Convert back to YAML
            return yaml.stringify(cleaned, {
                indent: 2,
                lineWidth: 0
            });
        });

        return cleanedDocs.join('\n---\n');
    } catch (error) {
        throw new Error(`Error cleaning YAML: ${error}`);
    }
}

function removeEmptyValues(obj: any): any {
    if (Array.isArray(obj)) {
        return obj
            .map(item => removeEmptyValues(item))
            .filter(item => item !== null && item !== undefined);
    }
    
    if (typeof obj === 'object' && obj !== null) {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && value !== undefined) {
                const cleanedValue = removeEmptyValues(value);
                if (cleanedValue !== null && cleanedValue !== undefined) {
                    cleaned[key] = cleanedValue;
                }
            }
        }
        return Object.keys(cleaned).length ? cleaned : undefined;
    }
    
    return obj;
}

function removeDefaultValues(manifest: any): void {
    // Remove default namespace if it's "default"
    if (manifest.metadata?.namespace === 'default') {
        delete manifest.metadata.namespace;
    }

    // Remove default service ports
    if (manifest.kind === 'Service' && manifest.spec?.ports) {
        manifest.spec.ports = manifest.spec.ports.map((port: any) => {
            if (port.protocol === 'TCP') delete port.protocol;
            return port;
        });
    }

    // Remove default container settings
    if (manifest.spec?.containers) {
        manifest.spec.containers.forEach((container: any) => {
            if (container.imagePullPolicy === 'IfNotPresent') {
                delete container.imagePullPolicy;
            }
            if (container.terminationMessagePath === '/dev/termination-log') {
                delete container.terminationMessagePath;
            }
            if (container.terminationMessagePolicy === 'File') {
                delete container.terminationMessagePolicy;
            }
        });
    }
}