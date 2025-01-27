// src/extension.ts
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { validateK8sFile } from './validator';
import { cleanK8sFile } from './cleaner';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('ValidYML extension is now active');

    // Create diagnostic collection for problems
    diagnosticCollection = vscode.languages.createDiagnosticCollection('validyml');
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
                if (event.document.languageId === 'yaml') {
                    validateDocument(event.document);
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(document => {
                if (document.languageId === 'yaml') {
                    validateDocument(document);
                }
            })
        );
    }
}

async function validateCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await validateDocument(editor.document);
        vscode.window.showInformationMessage('ValidYML: File validation complete');
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

async function validateDocument(document: vscode.TextDocument) {
    try {
        const text = document.getText();
        const issues = await validateK8sFile(text);
        
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
            
            diagnostic.source = 'ValidKube';
            return diagnostic;
        });

        diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
        console.error('Error validating document:', error);
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