import * as vscode from 'vscode';
import { FilePicker } from './filepicker';
import * as constants from './constants';
import { UndoTree } from './undotree';
import { config, updateConfig } from "./config";
import * as util from "./util";

export function activate(context: vscode.ExtensionContext) {

    // vscode.commands.getCommands().then(cmds => console.log(cmds));

    function registerCommand(commandId: string, run: (...args: any[]) => any): void {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
    }

    registerCommand('ev.test', (args) => {
        // let docs = vscode.workspace.textDocuments;
        // console.log(docs);
        // let names = docs.map(doc => doc.fileName);
        // vscode.window.showQuickPick(names).then(name => {
        //     let idx = names.indexOf(name);
        //     let doc = docs[idx];
        //     vscode.window.showTextDocument(doc);
        // });
    });

    vscode.workspace.onDidChangeConfiguration(e => {
        if(e.affectsConfiguration("ev")) {
            updateConfig();
        }
    });

    updateConfig();
    initCursor(context);
    initFilepicker(context);
    // initUndoTree(context);
}

export function deactivate() { }


function initCursor(context: vscode.ExtensionContext) {
    function registerCommand(commandId: string, run: (...args: any[]) => any): void {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
    }

    let markIsSet: boolean = false;

    vscode.commands.executeCommand('setContext', constants.CONTEXT_MARK_ISSET, markIsSet);
    vscode.commands.executeCommand('setContext', constants.CONTEXT_CURSOR_AT_BEGINNING_OF_LINE, false);

    registerCommand(constants.COMMAND_MARK_SET, () => {
        markIsSet = true;
        vscode.commands.executeCommand('setContext', constants.CONTEXT_MARK_ISSET, markIsSet);
        vscode.commands.executeCommand("cancelSelection");
    });

    registerCommand(constants.COMMAND_MARK_CANCEL, () => {
        markIsSet = false;
        vscode.commands.executeCommand('setContext', constants.CONTEXT_MARK_ISSET, markIsSet);
        vscode.commands.executeCommand("cancelSelection");
    });

    registerCommand(constants.COMMAND_CURSOR_MOVE, (args) => {

        let wordList = ["WordStart", "WordEnd"];

        if (wordList.indexOf(args.by) !== -1) {
            let commandName = "cursor" + args.by + util.capitalizeFirstLetter(args.to) + (markIsSet ? "Select" : "");
            vscode.commands.executeCommand(commandName);
        } else {
            args["select"] = markIsSet;
            vscode.commands.executeCommand("cursorMove", args);
        }
    });

    registerCommand(constants.COMMAND_SCROLL, (args) => {
        args["select"] = markIsSet;
        vscode.commands.executeCommand("editorScroll", args);
    });

    registerCommand(constants.COMMAND_SCROLL_TO_CURSOR, (args) => {
        // TODO:
        // if at top -> goto bottom
        // if at middle -> goto top
        // else -> goto middle

        if (!vscode.window.activeTextEditor) {
            return;
        }

        if (!vscode.window.activeTextEditor.selection) {
            return;
        }

        let currentLine = vscode.window.activeTextEditor.selection.active.line;

        let lineToReveal = currentLine;

        vscode.window.activeTextEditor.revealRange(
            new vscode.Range(
                new vscode.Position(lineToReveal, 0),
                new vscode.Position(lineToReveal, 0)
            ),
            vscode.TextEditorRevealType.InCenter
        );
    });


    let editorChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
        vscode.commands.executeCommand(constants.COMMAND_MARK_CANCEL);
    });

    let activeTextEditorListener = vscode.window.onDidChangeActiveTextEditor((e) => {
        vscode.commands.executeCommand(constants.COMMAND_MARK_CANCEL);
    });

    let selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((e) => {
        vscode.commands.executeCommand(
            'setContext',
            constants.CONTEXT_CURSOR_AT_BEGINNING_OF_LINE,
            e.selections.length > 0 && e.selections[0].active.character === 0
        );
    });

    context.subscriptions.push(editorChangeListener);
    context.subscriptions.push(activeTextEditorListener);
    context.subscriptions.push(selectionChangeListener);
}

function initFilepicker(context: vscode.ExtensionContext) {
    function registerCommand(commandId: string, run: (...args: any[]) => any): void {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
    }

    let filepicker = new FilePicker();

    registerCommand(constants.COMMAND_FILEPICKER_OPEN, (args) => {
        filepicker.show();
    });

    registerCommand(constants.COMMAND_FILEPICKER_TOGGLE_MODE, (args) => {
        filepicker.toggleMode();
    });

    registerCommand(constants.COMMAND_FILEPICKER_GO_UP, (args) => {
        filepicker.goUpOneLevel();
    });

    registerCommand(constants.COMMAND_FILEPICKER_SET_VALUE_FROM_SELECTED, (args) => {
        filepicker.setValueFromSelectedItem();
    });
}

function initUndoTree(context: vscode.ExtensionContext) {
    function registerCommand(commandId: string, run: (...args: any[]) => any): void {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
    }

    let editorUndoTreeMap = new Map<string, UndoTree>();

    registerCommand("ev.undo", (args) => {
        let uri = vscode.window.activeTextEditor.document.uri.toString();
        
        if(!editorUndoTreeMap.has(uri)) {
            editorUndoTreeMap.set(uri, new UndoTree(uri));
        }

        let undotree = editorUndoTreeMap.get(uri);
        undotree.undo();
    });

    registerCommand("ev.redo", (args) => {
        let uri = vscode.window.activeTextEditor.document.uri.toString();
        
        if(!editorUndoTreeMap.has(uri)) {
            editorUndoTreeMap.set(uri, new UndoTree(uri));
        }

        let undotree = editorUndoTreeMap.get(uri);
        undotree.redo();
    });

    let editorChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if(e.contentChanges.length === 0) {
            return;
        }

        let uri = e.document.uri.toString();
        
        if(!editorUndoTreeMap.has(uri)) {
            editorUndoTreeMap.set(uri, new UndoTree(uri));
        }

        let undotree = editorUndoTreeMap.get(uri);
        e.contentChanges.forEach(change => undotree.pushEdit(change));
    });

    // for handling uri updates
    // vscode.workspace.onDidSaveTextDocument

    context.subscriptions.push(editorChangeListener);
}

