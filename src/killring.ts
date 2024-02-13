import * as vscode from 'vscode';
import clipboard from 'clipboardy';

class KillRing {

    killring: string[] = [];
    cycleIndex: number = -1;

    constructor(context: vscode.ExtensionContext) {

    }

    public updateFromSystemClipboard() {
        
    }

    public copy() {

    }

    public kill() {
        //this.killring.push();
    }

    public yank() {
        //vscode.window.activeTextEditor
    }

    public cycle() {

    }

    public cancelCycle() {
        
    }
}