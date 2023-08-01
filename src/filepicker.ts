
import * as vscode from 'vscode';
import * as path from "path";
import Fuse from 'fuse.js';
import * as constants from './constants';


function openNewFile(filepath: string): void {
    vscode.workspace
        .openTextDocument(vscode.Uri.file(filepath).with({ scheme: "untitled" }))
        .then((doc) => vscode.window.showTextDocument(doc, vscode.ViewColumn.Active));
}

function openFile(filepath: vscode.Uri): void {
    vscode.workspace
        .openTextDocument(filepath)
        .then((doc) => vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active, preview: false }));
}

function addWorkspaceFolder(filepath: string) {
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: vscode.Uri.file(filepath) });
}

function openFolder(filepath: string): void {
    vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : null, { uri: vscode.Uri.file(filepath) });
}

function openInNewWindow(filepath: string): void {
    vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(filepath), true);
}

export class FilePicker {
    quickPick: vscode.QuickPick<FileItem>;
    currentMode: FilePickerMode;

    private fileMode: FilePickerFileMode;
    private actionMode: FilePickerFileMode;

    constructor() {
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.title = "Filepicker";

        this.fileMode = new FilePickerFileMode();
        this.actionMode = new FilePickerActionMode();

        this.quickPick.onDidChangeValue((e) => {
            this.activateFileMode();
            this.currentMode.onUpdate(this);
        });
        this.quickPick.onDidAccept(() => this.currentMode.onAccept(this));
    }

    public show(): void {
        this.activateFileMode();
        this.quickPick.value = "";
        vscode.commands.executeCommand('setContext', constants.CONTEXT_FILEPICKER_ISVISIBLE, true);
        this.quickPick.show();

        if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
            this.goto(path.dirname(vscode.window.activeTextEditor.document.uri.fsPath) + path.sep);
        } else {
            this.goto(path.resolve("") + path.sep);
        }
    }

    public getCurrentInput(): [string, string] {
        let filepath = vscode.Uri.file(this.quickPick.value).path;

        let currentDir: string;
        let currentFilter: string;

        if (filepath.endsWith(path.sep)) {
            currentDir = filepath;
            currentFilter = "";
        } else {
            currentDir = path.dirname(filepath);
            currentFilter = path.basename(filepath).toLowerCase();
        }

        return [currentDir, currentFilter];
    }

    public getCurrentValue(): string {
        return this.quickPick.value;
    }

    public hide(): void {
        this.quickPick.hide();

    }

    public onHide(): void {
        vscode.commands.executeCommand('setContext', constants.CONTEXT_FILEPICKER_ISVISIBLE, false);
    }

    public goto(filepath: string): void {
        this.quickPick.value = filepath;
    }

    public activateActionMode(): void {
        if (this.currentMode !== this.actionMode) {
            this.currentMode = this.actionMode;
            this.currentMode.onUpdate(this);
        }
    }

    public activateFileMode(): void {
        if (this.currentMode !== this.fileMode) {
            this.currentMode = this.fileMode;
            this.currentMode.onUpdate(this);
        }
    }

    public toggleMode(): void {
        if (this.currentMode === this.fileMode) {
            this.activateActionMode();
        } else {
            this.activateFileMode();
        }
    }

    public goUpOneLevel(): void {
        let [currentDir, currentFilter] = this.getCurrentInput();
        if (currentFilter.length === 0) {
            this.goto(path.dirname(currentDir) + path.sep);
        } else {
            this.goto(currentDir + path.sep);
        }
    }

    public setValueFromSelectedItem() {
        if (this.quickPick.activeItems.length === 0) {
            return;
        }

        let item = this.quickPick.activeItems[0];
        this.goto(item.uri.fsPath);
    }
}

interface FilePickerMode {
    onUpdate(filePicker: FilePicker): void;
    onAccept(filePicker: FilePicker): void;
}

class FilePickerFileMode implements FilePickerMode {
    onUpdate(filePicker: FilePicker): void {
        filePicker.quickPick.busy = true;
        let newValue = filePicker.quickPick.value;

        if (newValue.length === 0) {
            return;
        }

        const [dirToList, currentFilter] = filePicker.getCurrentInput();

        vscode.workspace.fs.stat(vscode.Uri.file(dirToList))
            .then((filestat) => {
                if (filestat.type & vscode.FileType.Directory) {

                    vscode.workspace.fs.readDirectory(vscode.Uri.file(dirToList)).then((files: [string, vscode.FileType][]) => {

                        let items = files.map((value: [string, vscode.FileType]) => {
                            let [name, type] = value;

                            return new FileItem(vscode.Uri.file(path.join(dirToList, name)), type);
                        });

                        if (currentFilter.length === 0) {
                            // When no filter is given, directories are listed before files.
                            items.sort((a, b) => {
                                if ((a.filetype & vscode.FileType.Directory) === (b.filetype & vscode.FileType.Directory)) {
                                    return (a.basename.toLowerCase() < b.basename.toLowerCase()) ? -1 : 1;
                                }

                                return (a.filetype & vscode.FileType.Directory) ? -1 : 1;
                            });
                            filePicker.quickPick.items = items;
                            filePicker.quickPick.busy = false;
                        } else {
                            let config = vscode.workspace.getConfiguration("ev");

                            const options = {
                                includeScore: true,
                                shouldSort: true,
                                isCaseSensitive: false,
                                keys: ['basename']
                                //includeMatches: true
                            };

                            let threshold = config.get(constants.CONFIG_FILEPICKER_MATCHING_THRESHOLD);
                            if (typeof (threshold) === 'number') {
                                options["threshold"] = threshold;
                            }

                            const fuse: Fuse<FileItem> = new Fuse(items, options);
                            let result = fuse.search(currentFilter);
                            items = result.map(res => res.item);

                            // TODO: highlight matches
                            // console.log(result);
                            if (items.length > 0) {
                                filePicker.quickPick.items = items;
                            } else {
                                filePicker.activateActionMode();
                            }
                            filePicker.quickPick.busy = false;
                        }


                    }, (error) => {
                        filePicker.quickPick.items = [];
                        filePicker.quickPick.busy = false;
                        console.error(error);
                    });
                } else {
                    filePicker.quickPick.items = [];
                    filePicker.quickPick.busy = false;
                    // file is not a directory.
                }
            }, (error) => {
                filePicker.quickPick.items = [];
                filePicker.quickPick.busy = false;
                // directory does not exist.
            });
    }

    onAccept(filePicker: FilePicker): void {
        if (filePicker.quickPick.activeItems.length > 0) {
            let item = filePicker.quickPick.activeItems[0];
            if (item.filetype & vscode.FileType.Directory) {
                filePicker.goto(item.uri.fsPath + path.sep);
            } else {
                filePicker.hide();
                openFile(item.uri);

            }
        }
    }
}

class FilePickerActionMode implements FilePickerMode {
    createItems: ActionItem[];
    openItems: ActionItem[];

    constructor() {
        this.createItems = [
            new ActionItem("New file", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                openNewFile(value);
            })
        ];
        this.openItems = [
            new ActionItem("Add folder to workspace", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                addWorkspaceFolder(value);
            }),
            new ActionItem("Open folder", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                openFolder(value);
            }),
            new ActionItem("Open in new window", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                openInNewWindow(value);
            })
        ];
    }

    onUpdate(filePicker: FilePicker): void {
        filePicker.quickPick.busy = true;
        let currentValue = filePicker.getCurrentValue();
        let items = [];
        vscode.workspace.fs.stat(vscode.Uri.file(currentValue)).then(stat => {
            items = this.openItems;
        }, error => {
            items = this.createItems;
        }).then(() => {
            filePicker.quickPick.items = items;
            filePicker.quickPick.busy = false;
        });


    }

    onAccept(filePicker: FilePicker): void {
        if (filePicker.quickPick.activeItems.length > 0) {
            let item = filePicker.quickPick.activeItems[0];

            if (item instanceof ActionItem) {
                item.run(filePicker);
            } else {
                console.error("Unexpected error");
            }
        }
    }
}

class ActionItem implements vscode.QuickPickItem {
    alwaysShow = true;
    callback: (filePicker: FilePicker) => void;
    label: string;

    constructor(label: string, callback: (filePicker: FilePicker) => void) {
        this.label = label;
        this.callback = callback;
    }

    public run(filePicker: FilePicker) {
        this.callback(filePicker);
    }
}

export class FileItem implements vscode.QuickPickItem {
    alwaysShow = true;
    uri: vscode.Uri;
    filetype: vscode.FileType;
    basename: string;
    label: string;

    constructor(uri: vscode.Uri, filetype: vscode.FileType) {
        this.uri = uri;
        this.filetype = filetype;
        this.basename = path.basename(this.uri.fsPath);

        switch (filetype) {
            case vscode.FileType.Directory:
                this.label = `$(folder) ${this.basename}`;
                break;
            case vscode.FileType.Directory | vscode.FileType.SymbolicLink:
                this.label = `$(file-symlink-directory) ${this.basename}`;
                break;
            case vscode.FileType.File | vscode.FileType.SymbolicLink:
                this.label = `$(file-symlink-file) ${this.basename}`;
            default:
                this.label = `$(file) ${this.basename}`;
                break;
        }
    }

}
