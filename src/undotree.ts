import * as vscode from "vscode";

class UndoNode {
    edits = [];
    parent: UndoNode = null;
    children: UndoNode[] = [];

    constructor(parent: UndoNode | null) {
        this.parent = parent;
    }

    public addEdit(edit: any) {
        this.edits.push(edit);
    }

    public addChild(node: UndoNode) {
        this.children.push(node);
    }

    public undo(): UndoNode {
        return this;
    }

    public redo(): UndoNode {
        return this;
    }
}

const TIME_THRESHOLD = 300;
export class UndoTree {

    head: UndoNode;
    lastPushTimestamp: number;

    constructor(filepath: string) {
        this.head = null;
        this.lastPushTimestamp = 0;
    }

    public updateFilePath(filepath: string) {

    }

    public pushEdit(edit: vscode.TextDocumentContentChangeEvent) {
        if (!this.head) {
            this.head = new UndoNode(null);
        } else {

            let timeDiff = Date.now() - this.lastPushTimestamp;

            if (timeDiff > TIME_THRESHOLD || edit.text.match("/^[\s\n]+$/")) {
                let newHead = new UndoNode(this.head);
                this.head.children.unshift(newHead);
                this.head = newHead;
            }
        }
        
        this.lastPushTimestamp = Date.now();
        this.head.addEdit(edit);
        console.log(this.lastPushTimestamp, edit);
    }

    public undo() {
        if(this.head) {
            this.head = this.head.undo();
        }
    }

    public redo() {
        if(this.head) {
            this.head = this.head.redo();
        }
    }

}