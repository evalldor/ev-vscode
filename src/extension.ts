import * as vscode from 'vscode';
import { FilePicker } from './filepicker';
import * as constants from './constants';

function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function activate(context: vscode.ExtensionContext) {

    // vscode.commands.getCommands().then(cmds => console.log(cmds));

    function registerCommand(commandId: string, run: (...args: any[]) => void): void {
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
            let commandName = "cursor" + args.by + capitalizeFirstLetter(args.to) + (markIsSet ? "Select" : "");
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

export function deactivate() { }
