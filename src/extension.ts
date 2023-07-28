import * as vscode from 'vscode';

function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function activate(context: vscode.ExtensionContext) {

    function registerCommand(commandId: string, run: (...args: any[]) => void): void {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
    }

    // registerCommand('ev.test', (args) => {
    //     let docs = vscode.workspace.textDocuments;
    //     console.log(docs);
    //     let names = docs.map(doc => doc.fileName);
    //     vscode.window.showQuickPick(names).then(name => {
    //         let idx = names.indexOf(name);
    //         let doc = docs[idx];
    //         vscode.window.showTextDocument(doc);
    //     });
    // });

    // vscode.commands.getCommands().then(cmds => console.log(cmds));

    let markIsSet: boolean = false;

    vscode.commands.executeCommand('setContext', 'ev.markIsSet', markIsSet);
    vscode.commands.executeCommand('setContext', 'ev.atBeginningOfLine', false);

    registerCommand('ev.setMark', () => {
        markIsSet = true;
        vscode.commands.executeCommand('setContext', 'ev.markIsSet', markIsSet);
        vscode.commands.executeCommand("cancelSelection");
    });

    registerCommand('ev.cancelMark', () => {
        markIsSet = false;
        vscode.commands.executeCommand('setContext', 'ev.markIsSet', markIsSet);
        vscode.commands.executeCommand("cancelSelection");
    });

    registerCommand('ev.cursorMove', (args) => {

        let wordList = ["WordStart", "WordEnd"];

        if (wordList.indexOf(args.by) !== -1) {
            let commandName = "cursor" + args.by + capitalizeFirstLetter(args.to) + (markIsSet ? "Select" : "");
            vscode.commands.executeCommand(commandName);
        } else {
            args["select"] = markIsSet;
            vscode.commands.executeCommand("cursorMove", args);
        }
    });



    registerCommand('ev.scroll', (args) => {
        args["select"] = markIsSet;
        vscode.commands.executeCommand("editorScroll", args);
    });


    // registerCommand('ev.repositionView', (args) => {

    // });

    let editorChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
        vscode.commands.executeCommand("ev.cancelMark");
    });

    let activeTextEditorListener = vscode.window.onDidChangeActiveTextEditor((e) => {
        vscode.commands.executeCommand("ev.cancelMark");
    });

    let selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((e) => {
        vscode.commands.executeCommand(
            'setContext',
            'ev.atBeginningOfLine',
            e.selections.length > 0 && e.selections[0].active.character === 0
        );
    });

    context.subscriptions.push(editorChangeListener);
    context.subscriptions.push(activeTextEditorListener);
    context.subscriptions.push(selectionChangeListener);
}

export function deactivate() { }
