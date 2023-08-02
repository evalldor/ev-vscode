import * as vscode from "vscode";
import * as constants from "./constants";

export function openNewFile(filepath: string): void {
    vscode.workspace
        .openTextDocument(vscode.Uri.file(filepath).with({ scheme: "untitled" }))
        .then((doc) => vscode.window.showTextDocument(doc, vscode.ViewColumn.Active));
}

export function openFile(filepath: string): void {
    vscode.workspace
        .openTextDocument(vscode.Uri.file(filepath))
        .then((doc) => vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active, preview: false }));
}

export function addWorkspaceFolder(filepath: string) {
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: vscode.Uri.file(filepath) });
}

export function openFolder(filepath: string): void {
    vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : null, { uri: vscode.Uri.file(filepath) });
}

export function openInNewWindow(filepath: string): void {
    vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(filepath), true);
}

export function setFilepickerIsVisible(isVisible: boolean): void {
    vscode.commands.executeCommand('setContext', constants.CONTEXT_FILEPICKER_ISVISIBLE, isVisible);
}