import * as vscode from 'vscode';
import * as path from "path";
import Fuse from 'fuse.js';
import { config } from "./config";
import * as actions from "./actions";
import * as util from "./util";
import * as fs from "fs";




function isWorkspacePath(filePath: string): boolean {
    const res = vscode.Uri.parse(filePath);
    return res.scheme.toLowerCase() === "ws";
}

function getFsPathOfWorkspaceFolder(wsFolder: string): string {
    for (const folder of vscode.workspace.workspaceFolders) {
        if (folder.name === wsFolder) {
            return folder.uri.fsPath;
        }
    }

    return null;
}

function getWorkspaceFolderForFsPath(fsPath: string): [string, string] {

    for (const folder of vscode.workspace.workspaceFolders) {
        const relative = path.relative(folder.uri.fsPath, fsPath);
        const isSubPath = (!relative.startsWith('..') && !path.isAbsolute(relative));
        if (isSubPath) {
            return [folder.name, folder.uri.fsPath];
        }
    }

    return [null, null];
}


function splitWorkspacePath(workspacePath: string): [string, string] {
    const res = vscode.Uri.parse(workspacePath);
    const workspaceFolder = res.authority;
    const subPath = res.path;

    return [workspaceFolder, subPath];
}


function workspaceToFsPath(workspacePath) {
    if (!isWorkspacePath(workspacePath)) {
        return workspacePath;
    }

    const [wsFolder, subPath] = splitWorkspacePath(workspacePath);

    const fsPath = getFsPathOfWorkspaceFolder(wsFolder);
    return path.join(fsPath, subPath);
}

function fsToWorkspacePath(fsPath) {
    if (isWorkspacePath(fsPath)) {
        return fsPath;
    }

    let [wsFolder, wsFolderPath] = getWorkspaceFolderForFsPath(fsPath);

    if (!wsFolder) {
        throw Error(`${fsPath} is not in a workspace folder`);
    }

    return `ws://${path.join(wsFolder, path.relative(wsFolderPath, fsPath))}`;
}



class FPath {
    constructor() {

    }

    public upOneLevel(): string {
        return null;
    }

    public isDirectory(): string {
        return null;
    }

    public listDirectory(): string {
        return null;
    }

    public dirname(): string {
        return null;
    }
}


export class FilePicker {
    quickPick: vscode.QuickPick<FileItem>;
    currentMode: FilePickerMode;

    private fileMode: FilePickerFileMode;
    private actionMode: FilePickerActionMode;

    constructor() {
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.title = "Filepicker";

        this.fileMode = new FilePickerFileMode(this);
        this.actionMode = new FilePickerActionMode(this);

        this.quickPick.onDidChangeValue((e) => {
            this.activateFileMode();
            this.currentMode.onUpdate();
        });
        this.quickPick.onDidAccept(() => this.currentMode.onAccept());
    }

    public async show(): Promise<void> {
        this.activateFileMode();
        this.quickPick.value = "";
        actions.setFilepickerIsVisible(true);
        this.quickPick.show();

        // for (const folder of vscode.workspace.workspaceFolders) {
        //     console.log(folder);
        // }

        // console.log(fsToWorkspacePath("/home/lpt3/Dropbox/Projects/ev-vscode/.gitignore"));
        // console.log(fsToWorkspacePath("/home/lpt3/Dropbox/Projects/ev-vscode"));
        // console.log(fsToWorkspacePath("/home/lpt3/Dropbox/Projects/ev-vscode/"));
        // console.log(fsToWorkspacePath("/home/lpt3/Dropbox/Projects/ev-vscode/src/u"));

        // console.log(workspaceToFsPath("ws://ev-vscode/.gitignore"));
        // console.log(workspaceToFsPath("ws://ev-vscode"));
        // console.log(workspaceToFsPath("ws://ev-vscode/"));
        // console.log(workspaceToFsPath("ws://ev-vscode/src/u"));

        // console.log(path.normalize("ws://ev-vscode/src/u"));

        // Add support for workspace paths: ws://<project>/<filepath>
        if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
            this.goto(path.dirname(vscode.window.activeTextEditor.document.uri.fsPath) + path.sep);
        } else if (vscode.window.activeTerminal) {
            let pid = await vscode.window.activeTerminal.processId;

            // This only shows initial env. 
            // let env = fs.readFileSync(path.join(path.sep, "proc", ""+pid, "environ"), {encoding: "utf-8"}).split("\0");
            // env.forEach(str => {
            //     if(str.startsWith("PWD=")) {
            //         console.log(str); 
            //         this.goto(str.substring(4) + path.sep);
            //     }
            // });
            // console.log(env);

            // TODO: Use current working dir / open files to determine if path
            // should be replaced by symlinks
            let cwd = fs.readlinkSync(path.join(path.sep, "proc", "" + pid, "cwd"));
            this.goto(cwd + path.sep);
        } else {

            if (vscode.workspace.workspaceFolders.length > 0) {

            }

            this.goto(path.resolve("") + path.sep);
        }
    }

    public hide(): void {
        this.quickPick.hide();
    }

    public onHide(): void {
        actions.setFilepickerIsVisible(false);
    }

    public getCurrentInput(): [string, string] {
        let filepath = this.quickPick.value;

        if (filepath.length === 0) {
            filepath = path.sep;
        }

        let currentDir: string;
        let currentFilter: string;

        if (filepath.endsWith(path.sep)) {
            currentDir = filepath;
            currentFilter = "";
        } else {
            currentDir = path.dirname(filepath) + path.sep;
            currentFilter = path.basename(filepath).toLowerCase();
        }

        return [currentDir, currentFilter];
    }

    public getCurrentValue(): string {
        let filepath = this.quickPick.value;

        if (filepath.length === 0) {
            return path.sep;
        }

        return workspaceToFsPath(filepath);
    }

    public goto(filepath: string): void {
        console.log(filepath);
        if (!config.filePickerWorkspacePaths) {
            this.quickPick.value = path.normalize(filepath);
            return;
        }


        let [wsFolder, wsFolderPath] = getWorkspaceFolderForFsPath(filepath);

        if (!wsFolder) {
            this.quickPick.value = path.normalize(filepath);
        } else {
            this.quickPick.value = `ws://${path.join(wsFolder, path.relative(wsFolderPath, filepath))}`;
            if (filepath.endsWith(path.sep)) {
                this.quickPick.value += path.sep;
            }
        }
    }


    public activateActionMode(): void {
        if (this.currentMode !== this.actionMode) {
            this.currentMode = this.actionMode;
            this.currentMode.onUpdate();
        }
    }

    public activateFileMode(): void {
        if (this.currentMode !== this.fileMode) {
            this.currentMode = this.fileMode;
            this.currentMode.onUpdate();
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
            this.goto(currentDir);
        }
    }

    public setValueFromSelectedItem(): void {
        if (this.quickPick.activeItems.length === 0) {
            return;
        }

        let item = this.quickPick.activeItems[0];
        this.goto(item.absolutePath);
    }
}

interface FilePickerMode {
    onUpdate(): any;
    onAccept(): any;
}

class FilePickerFileMode implements FilePickerMode {

    filePicker: FilePicker;

    directoryCache = new DirectoryCache(
        (a) => { this.onCacheUpdate(a); },
        () => { this.filePicker.quickPick.busy = true; },
        () => { this.filePicker.quickPick.busy = false; });

    render: (...args: any) => any;
    simpleFilter: ListFilter;
    fuzzyFilter: ListFilter;

    constructor(filePicker: FilePicker) {
        this.filePicker = filePicker;
        // this.render = debounce.call(this, this._render, 50);
        this.render = this._render;
        this.simpleFilter = new DirSortFilter();
        this.fuzzyFilter = new FuseFilter();
    }

    private onCacheUpdate(key: string) {
        const [dirToList, currentFilter] = this.filePicker.getCurrentInput();
        // console.log(`${key} subdir of ${dirToList}?: ${util.isSubdir(dirToList, key)}`);
        if (util.isSubdir(dirToList, key)) {
            this.render();
        }
    }

    private _render() {
        const [dirToList, currentFilter] = this.filePicker.getCurrentInput();

        if (currentFilter.length === 0) {
            // When no filter is given, directories are listed before files.
            let items = this.directoryCache.getFileListForDir(dirToList, 1);
            this.filePicker.quickPick.items = this.simpleFilter.filterAndSort(items, currentFilter);
        } else {

            let items = this.directoryCache.getFileListForDir(dirToList, config.filePickerFolderSearchDepth);
            items = this.fuzzyFilter.filterAndSort(items, currentFilter);

            // TODO: highlight matches
            if (items.length > 0) {
                this.filePicker.quickPick.items = items;
            } else {
                this.filePicker.activateActionMode();
            }

        }
    }

    async onUpdate(): Promise<void> {

        const [dirToList, currentFilter] = this.filePicker.getCurrentInput();

        try {
            var filestat = await vscode.workspace.fs.stat(vscode.Uri.file(dirToList));
            if (filestat.type & vscode.FileType.Directory) {

                if (this.directoryCache.has(dirToList)) {
                    this.render();
                }

                let searchDepth = (currentFilter.length === 0) ? 1 : config.filePickerFolderSearchDepth;
                this.directoryCache.update(dirToList, searchDepth);

            } else {
                // file is not a directory.
                this.filePicker.activateActionMode();
            }
        } catch (e) {
            // directory does not exist.
            this.filePicker.activateActionMode();
        }
    }

    onAccept(): void {
        if (this.filePicker.quickPick.activeItems.length > 0) {
            let item = this.filePicker.quickPick.activeItems[0];
            if (item.filetype & vscode.FileType.Directory) {
                this.filePicker.goto(item.absolutePath + path.sep);
            } else {
                this.filePicker.hide();
                actions.openFile(item.absolutePath);

            }
        }
    }
}

class FilePickerActionMode implements FilePickerMode {
    actionsOnNonExistingFiles: ActionItem[];
    actionsOnExistingFiles: ActionItem[];
    filePicker: FilePicker;

    constructor(filePicker: FilePicker) {
        this.filePicker = filePicker;

        this.actionsOnNonExistingFiles = [
            new ActionItem("$(new-file) New file", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.openNewFile(value);
            })
        ];

        this.actionsOnExistingFiles = [
            new ActionItem("$(new-folder) Add folder to workspace", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.addWorkspaceFolder(value);
            }),
            new ActionItem("$(folder-opened) Open folder", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.openFolder(value);
            }),
            new ActionItem("$(empty-window) Open in new window", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.openInNewWindow(value);
            })
        ];
    }

    onUpdate(): void {
        let currentValue = this.filePicker.getCurrentValue();
        let items = [];
        vscode.workspace.fs.stat(vscode.Uri.file(currentValue)).then(stat => {
            items = this.actionsOnExistingFiles;
        }, error => {
            items = this.actionsOnNonExistingFiles;
        }).then(() => {
            this.filePicker.quickPick.items = items;
        });
    }

    onAccept(): void {
        if (this.filePicker.quickPick.activeItems.length > 0) {
            let item = this.filePicker.quickPick.activeItems[0];

            if (item instanceof ActionItem) {
                item.run(this.filePicker);
            } else {
                console.error("Unexpected error. Should never happend.");
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

class FileItem implements vscode.QuickPickItem {
    alwaysShow = true;
    absolutePath: string;
    filetype: vscode.FileType;
    relativePath: string;
    label: string;

    constructor(uri: string, filetype: vscode.FileType) {
        this.absolutePath = uri;
        this.filetype = filetype;
    }

    public setBaseUri(baseUri: string) {
        this.relativePath = path.relative(baseUri, this.absolutePath);

        switch (this.filetype) {
            case vscode.FileType.Directory:
                this.label = `$(folder) ${this.relativePath}`;
                break;
            case vscode.FileType.Directory | vscode.FileType.SymbolicLink:
                this.label = `$(file-symlink-directory) ${this.relativePath}`;
                break;
            case vscode.FileType.File | vscode.FileType.SymbolicLink:
                this.label = `$(file-symlink-file) ${this.relativePath}`;
            default:
                this.label = `$(file) ${this.relativePath}`;
                break;
        }
    }

    public hash(): string {
        return this.absolutePath + this.filetype;
    }
}

class DirectoryCache {
    cache: Map<string, FileItem[]> = new Map();
    hashes: Map<string, Set<string>> = new Map();
    onUpdateCallback: (dirPath: string) => any;
    onBusyStart: (...args: any[]) => any;
    onBusyEnd: (...args: any[]) => any;
    lastScanTimes: Map<string, number> = new Map();

    constructor(onUpdateCallback: (dirPath: string) => any,
        onBusyStart: (...args: any[]) => any,
        onBusyEnd: (...args: any[]) => any) {

        this.onUpdateCallback = onUpdateCallback;
        this.onBusyStart = onBusyStart;
        this.onBusyEnd = onBusyEnd;
    }

    public set(dirPath: string, items: FileItem[]) {
        let hashSet = new Set<string>(items.map(item => item.hash()));

        if (this.cache.has(dirPath)) {
            let existingHashes = this.hashes.get(dirPath);
            let diff = symmetricDifference(hashSet, existingHashes);
            if (diff.size === 0) {
                return;
            }
        }

        this.cache.set(dirPath, items);
        this.hashes.set(dirPath, hashSet);
        this.onUpdateCallback(dirPath);
    }

    public get(dirPath: string): FileItem[] {
        return this.cache.get(dirPath);
    }

    public has(dirPath: string) {
        return this.cache.has(dirPath);
    }

    public getFileListForDir(dirPath: string, depth = 1) {

        if (depth === 0 || !this.cache.has(dirPath)) {
            return [];
        }

        let items = this.cache.get(dirPath);
        return items.flatMap(item => {
            item.setBaseUri(dirPath);

            if ((item.filetype & vscode.FileType.Directory) && !config.filePickerRecursiveIgnoreFolders.ignores(item.relativePath)) {
                let items = [item, ...this.getFileListForDir(item.absolutePath, depth - 1)];
                items.forEach(item => item.setBaseUri(dirPath));
                return items;
            }

            return [item];
        });
    }

    public async update(dirPath: string, depth = 1) {
        // let start = Date.now();
        await this._update(dirPath, depth);
        // console.log(`Scan directory time was ${Date.now() - start}ms`);
    }

    private scanOpsCounter: number = 0;
    private start() {
        if (this.scanOpsCounter === 0) {
            this.onBusyStart();
        }
        this.scanOpsCounter += 1;
    }

    private end() {
        this.scanOpsCounter -= 1;
        if (this.scanOpsCounter === 0) {
            this.onBusyEnd();
        }
    }

    private async _update(dirPath: string, depth = 1) {
        this.start();
        try {
            // Breadth First directory Search
            if (!this.lastScanTimes.has(dirPath) || (Date.now() - this.lastScanTimes.get(dirPath)) >= config.filePickerDirScanDebounceMilliseconds) {
                this.lastScanTimes.set(dirPath, Date.now());

                let files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
                let items = files.map((value: [string, vscode.FileType]) => {
                    let [name, type] = value;

                    return new FileItem(path.join(dirPath, name), type);
                });

                this.set(dirPath, items);
            }

            if (depth > 1) {
                this.cache.get(dirPath).forEach(item => {
                    if (item.filetype & vscode.FileType.Directory) {
                        let relativePath = path.relative(dirPath, item.absolutePath);
                        if (!config.filePickerRecursiveIgnoreFolders.ignores(relativePath)) {
                            this._update(item.absolutePath, depth - 1);
                        }
                    }
                });
            }
        } catch (e) {
            this.set(dirPath, []);
        }
        this.end();
    }
}

function symmetricDifference(setA, setB) {
    const _difference = new Set(setA);
    for (const elem of setB) {
        if (_difference.has(elem)) {
            _difference.delete(elem);
        } else {
            _difference.add(elem);
        }
    }
    return _difference;
}

interface ListFilter {
    filterAndSort(items: FileItem[], filter: string): FileItem[];
}

class DirSortFilter implements ListFilter {
    filterAndSort(items: FileItem[], filter: string) {
        return items.sort((a, b) => {
            if ((a.filetype & vscode.FileType.Directory) === (b.filetype & vscode.FileType.Directory)) {
                return (a.relativePath.toLowerCase() < b.relativePath.toLowerCase()) ? -1 : 1;
            }

            return (a.filetype & vscode.FileType.Directory) ? -1 : 1;
        });
    }
}

class FuseFilter implements ListFilter {

    filterAndSort(items: FileItem[], filter: string) {
        const options = {
            includeScore: false,
            shouldSort: true,
            isCaseSensitive: false,
            // ignoreLocation: true,
            keys: ['relativePath'],
            threshold: config.filePickerMatchingThreshold
            //includeMatches: true
        };

        const fuse: Fuse<FileItem> = new Fuse(items, options);
        let result = fuse.search(filter);
        return result.map(res => res.item);
    }
}