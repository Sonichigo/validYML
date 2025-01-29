import * as vscode from 'vscode';
import { validateFile } from './validator';
import { cleanK8sFile } from './cleaner';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('ValidYML extension is now active');

    // Create a diagnostic collection for each supported language
    diagnosticCollection = vscode.languages.createDiagnosticCollection('Validyml');
    context.subscriptions.push(diagnosticCollection);

    // Register commands
    let validateCommand = vscode.commands.registerCommand('validyml.validateFile', validateCurrentFile);
    let cleanCommand = vscode.commands.registerCommand('validyml.cleanFile', cleanCurrentFile);
    
    context.subscriptions.push(validateCommand);
    context.subscriptions.push(cleanCommand);

    // Register event handlers
    if (vscode.workspace.getConfiguration('validyml').get('enableAutoValidation')) {
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (isSupportedFile(event.document)) {
                    validateDocument(event.document);
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                if (isSupportedFile(document)) {
                    validateDocument(document);
                }
            })
        );
    }
}

function isSupportedFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'yaml' || document.languageId === 'dockercompose';
}

function isValidatableFile(document: vscode.TextDocument): boolean {
    const fileName = document.fileName.toLowerCase();
    return document.languageId === 'yaml' && (
        fileName.includes('kubernetes') ||
        fileName.includes('k8s') ||
        fileName.endsWith('.yml') ||
        fileName.endsWith('.yaml') ||
        fileName.includes('docker-compose')
    );
}

async function validateCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (editor && isValidatableFile(editor.document)) {
        await validateDocument(editor.document);
        vscode.window.showInformationMessage('ValidYML: File validation complete');
    }
}

async function validateDocument(document: vscode.TextDocument) {
    try {
        const issues = await validateFile(document);
        
        const diagnostics: vscode.Diagnostic[] = issues.map(issue => {
            const range = new vscode.Range(
                document.positionAt(issue.position.start),
                document.positionAt(issue.position.end)
            );
            
            const diagnostic = new vscode.Diagnostic(
                range,
                issue.message,
                convertSeverity(issue.severity)
            );
            
            diagnostic.source = 'validyml';
            return diagnostic;
        });

        diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
        console.error('Error validating document:', error);
    }
}

async function cleanCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        try {
            const document = editor.document;
            const text = document.getText();
            const cleaned = await cleanK8sFile(text);
            
            editor.edit(editBuilder => {
                const range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                editBuilder.replace(range, cleaned);
            });
            
            vscode.window.showInformationMessage('ValidYML: File cleaned successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`ValidYML: Error cleaning file - ${error}`);
        }
    }
}

function convertSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity.toLowerCase()) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Hint;
    }
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.clear();
        diagnosticCollection.dispose();
    }
}