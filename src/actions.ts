import * as vscode from "vscode";
import * as constants from "./constants";
import * as util from "./util";

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

export function removeWorkspaceFolder(fsPath: string) {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {

        let index = -1;
        for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {
            if (util.isPathsEqual(vscode.workspace.workspaceFolders[i].uri.fsPath, fsPath)) {
                index = i;
            }
        }

        if (index > -1) {
            vscode.workspace.updateWorkspaceFolders(index, 1);
        }
    }
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