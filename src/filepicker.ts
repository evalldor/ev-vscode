
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

export class FilePicker {
    quickPick: vscode.QuickPick<FileItem>;
    currentMode: FilePickerMode;

    constructor() {
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.title = "Filepicker";
        this.quickPick.onDidChangeValue((e) => {
            this.fileMode();
            this.currentMode.onUpdate(this);
        });
        this.quickPick.onDidAccept(() => this.currentMode.onAccept(this));
    }

    public show(): void {
        this.fileMode();
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
        this.quickPick.value = "";
    }

    public onHide(): void {
        vscode.commands.executeCommand('setContext', constants.CONTEXT_FILEPICKER_ISVISIBLE, false);
    }

    public goto(filepath: string): void {
        this.quickPick.value = filepath;
    }

    public actionMode(): void {
        this.currentMode = new FilePickerActionMode();
        this.currentMode.onUpdate(this);
    }

    public fileMode(): void {
        if (!(this.actionMode instanceof FilePickerFileMode)) {
            this.currentMode = new FilePickerFileMode();
            this.currentMode.onUpdate(this);
        }
    }

    public toggleMode(): void {
        if (this.currentMode instanceof FilePickerFileMode) {
            this.actionMode();
        } else {
            this.fileMode();
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
}

interface FilePickerMode {
    onUpdate(filePicker: FilePicker): void;
    onAccept(filePicker: FilePicker): void;
}

class FilePickerFileMode implements FilePickerMode {
    onUpdate(filePicker: FilePicker): void {
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

                            return new FileItem({ uri: vscode.Uri.file(path.join(dirToList, name)), type: type });
                        });

                        if (currentFilter.length === 0) {
                            // When no filter is given, directories are listed before files.
                            items.sort((a, b) => {
                                if ((a.filetype & vscode.FileType.Directory) === (b.filetype & vscode.FileType.Directory)) {
                                    return (a.basename.toLowerCase() < b.basename.toLowerCase()) ? -1 : 1;
                                }

                                return (a.filetype & vscode.FileType.Directory) ? -1 : 1;
                            });
                        } else {
                            const options = {
                                includeScore: false,
                                isCaseSensitive: false,
                                keys: ['basename'],
                                //includeMatches: true
                            };

                            const fuse: Fuse<FileItem> = new Fuse(items, options);
                            let result = fuse.search(currentFilter);
                            items = result.map(res => res.item);

                            // TODO: highlight matches
                            //console.log(result); 
                        }

                        filePicker.quickPick.items = items;

                    }, (error) => {
                        filePicker.quickPick.items = [];
                        console.error(error);
                    });
                } else {
                    filePicker.quickPick.items = [];
                    // file is not a directory.
                }
            }, (error) => {
                filePicker.quickPick.items = [];
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
    items: FileItem[];

    constructor() {
        this.items = [];
        this.items.push(new FileItem({ action: FileAction.createFile }));
        this.items.push(new FileItem({ action: FileAction.addFolderToWorkspace }));
        this.items.push(new FileItem({ action: FileAction.openFolder }));
    }

    onUpdate(filePicker: FilePicker): void {
        filePicker.quickPick.items = this.items;
    }

    onAccept(filePicker: FilePicker): void {
        if (filePicker.quickPick.activeItems.length > 0) {
            let item = filePicker.quickPick.activeItems[0];
            let value = filePicker.getCurrentValue();

            switch (item.action) {
                case FileAction.createFile:
                    filePicker.hide();
                    openNewFile(value);
                    break;
                case FileAction.addFolderToWorkspace:
                    filePicker.hide();
                    addWorkspaceFolder(value);
                    break;
                case FileAction.openFolder:
                    filePicker.hide();
                    openFolder(value);
                    break;
            }
        }
    }
}

export class FileItem implements vscode.QuickPickItem {
    alwaysShow = true;
    uri?: vscode.Uri;
    filetype?: vscode.FileType;
    basename?: string;
    action?: FileAction;

    constructor(params: { uri?: vscode.Uri, type?: vscode.FileType, action?: FileAction }) {
        if (params.uri) {
            this.uri = params.uri;
            this.filetype = params.type;
            this.basename = path.basename(this.uri.fsPath);
        } else {
            this.action = params.action;
        }
    }

    get label(): string {
        let label: string;

        if (this.action) {
            switch (this.action) {
                case FileAction.createFile:
                    label = "New file";
                    break;

                case FileAction.addFolderToWorkspace:
                    label = "Add folder to workspace";
                    break;

                case FileAction.openFolder:
                    label = "Open folder";
                    break;
            }
        } else {
            switch (this.filetype) {
                case vscode.FileType.Directory:
                    label = `$(folder) ${this.basename}`;
                    break;
                case vscode.FileType.Directory | vscode.FileType.SymbolicLink:
                    label = `$(file-symlink-directory) ${this.basename}`;
                    break;
                case vscode.FileType.File | vscode.FileType.SymbolicLink:
                    label = `$(file-symlink-file) ${this.basename}`;
                default:
                    label = `$(file) ${this.basename}`;
                    break;
            }

        }

        return label;
    }
}

enum FileAction {
    createFile = 1,
    addFolderToWorkspace = 2,
    openFolder = 3,
}