import * as fs from "fs";
import Fuse from 'fuse.js';
import * as path from "path";
import * as vscode from 'vscode';
import * as actions from "./actions";
import { config } from "./config";
import * as util from "./util";


function isWorkspacePath(filePath: string): boolean {
    try{
        const res = vscode.Uri.parse(filePath);
        return res.scheme.toLowerCase() === "ws";
    }catch(e) {
        console.error(e);
        console.error(filePath);
    }
    
    return false;
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
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            const relative = path.relative(folder.uri.fsPath, fsPath);
            const isSubPath = (!relative.startsWith('..') && !path.isAbsolute(relative));
            if (isSubPath) {
                return [folder.name, folder.uri.fsPath];
            }
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
        return fsPath;
    }

    return `ws://${path.join(wsFolder, path.relative(wsFolderPath, fsPath))}`;
}





class FPath {

    private _path: string;
    private _type: vscode.FileType | undefined;

    constructor(pathString: string, type?: vscode.FileType) {
        if (pathString.length > 0) {
            this._path = pathString;
        }
        else {
            this._path = path.sep;
        }

        this._type = type;
    }

    public static home() {
        return new FPath(path.resolve("") + path.sep);
    }

    public static ws() {
        return new FPath("ws://");
    }

    public async getType(): Promise<vscode.FileType> {
        if (!this._type) {
            this._type = (await vscode.workspace.fs.stat(vscode.Uri.file(this.toFsPath()))).type;
        }

        return this._type;
    }

    public toFsPath(): string {
        if (this.isWorkspaceRoot()) {
            throw Error("Workspace root has no fs path");
        }

        let p = workspaceToFsPath(this._path);

        if (this._path.endsWith(path.sep) && !p.endsWith(path.sep)) {
            p += path.sep;
        }

        return p;
    }

    public toWsPath(): string {

        let p = fsToWorkspacePath(this._path);
        if (this._path.endsWith(path.sep) && !p.endsWith(path.sep)) {
            p += path.sep;
        }

        return p;
    }

    public upOneLevel(): FPath {
        if (this.currentFilter().length === 0) {
            return this.parent();
        }

        return this.currentDirectory();
    }

    public async isDirectory(): Promise<boolean> {
        if(this.isWorkspaceRoot()) {
            return true;
        }

        const type = await this.getType();
        return Boolean(type & vscode.FileType.Directory);
    }

    public async listDirectory(): Promise<FPath[]> {
        if (this.isWorkspaceRoot()) {
            return vscode.workspace.workspaceFolders.map(folder => new FPath(folder.uri.fsPath));
        }

        if (!await this.isDirectory()) {
            throw new Error(`'${this._path}' is not a directory`);
        }

        const dirPath = this.toFsPath();
        let files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
        return files.map((value: [string, vscode.FileType]) => {
            let [name, type] = value;
            return new FPath(path.join(dirPath, name), type);
        });
    }

    public relativeTo(other: FPath): FPath {
        if (other.isWorkspaceRoot()) {
            throw new Error("Not implemented. Should not be used.");
        }

        if (this.isWorkspaceRoot()) {
            const [wsFolder, wsFolderPath] = getWorkspaceFolderForFsPath(other.toFsPath());

            if (wsFolder) {
                const relative = path.relative(path.dirname(wsFolderPath), other.toFsPath());
                return new FPath(relative);
            }
        }

        const relative = path.relative(this.toFsPath(), other.toFsPath());
        return new FPath(relative);
    }

    public parent(): FPath {
        if (this.isWorkspaceRoot()) {
            return new FPath(path.resolve("") + path.sep);
        }

        let val = path.dirname(this._path);

        if(!val.endsWith(path.sep) || val.endsWith(":"+path.sep)) {
            val += path.sep;
        }



        return new FPath(val);
    }

    public withEndingSlash(): FPath {
        if (this._path.endsWith(path.sep)) {
            return this;
        }

        return new FPath(this._path + path.sep);
    }

    public currentDirectory(): FPath {
        if (this._path.endsWith(path.sep)) {
            return new FPath(this._path);
        }

        return this.parent();
    }

    public currentFilter(): string {
        if (this._path.endsWith(path.sep)) {
            return "";
        }
        
        return this._path.split(path.sep).at(-1).toLowerCase();
    }

    public isWorkspaceRoot(): boolean {
        return this._path.length >= 3 && "ws://".indexOf(this._path.toLowerCase()) === 0;
    }

    public async exists(): Promise<boolean> {
        if(this.isWorkspaceRoot()) {
            return true;
        }
        
        try{
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(this.toFsPath()));
        } catch(e) {
            return false;
        }

        return true;
    }

    public isSubpathOf(other: FPath): boolean {
        if(other.isWorkspaceRoot()){
            if(this.isWorkspaceRoot()) {
                return true;
            }

            const [wsFolder, wsFolderPath] = getWorkspaceFolderForFsPath(this.toFsPath());
            return Boolean(wsFolder);
        }
        
        return util.isSubdir(other.toFsPath(), this.toFsPath());
    }

    public hash(): string {
        return this._path;
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

        if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
            this.goto(new FPath(path.dirname(vscode.window.activeTextEditor.document.uri.fsPath) + path.sep));
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
            this.goto(new FPath(cwd + path.sep));
        } else {

            if (config.filePickerWorkspacePaths && vscode.workspace.workspaceFolders){
                if(vscode.workspace.workspaceFolders.length === 1) {
                    this.goto(new FPath(vscode.workspace.workspaceFolders[0].uri.fsPath).withEndingSlash());
                } else {
                    this.goto(FPath.ws());
                }

            } else {
                this.goto(FPath.home());
            }
            
            
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

    public getCurrentValue(): FPath {
        return new FPath(this.quickPick.value);
    }

    public goto(filepath: FPath): void {
        if (!config.filePickerWorkspacePaths) {
            this.quickPick.value = filepath.toFsPath();
        }

        this.quickPick.value = filepath.toWsPath();
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
        this.goto(this.getCurrentValue().upOneLevel());
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

    private onCacheUpdate(key: FPath) {
        const currPath = this.filePicker.getCurrentValue();
        const dirToList = currPath.currentDirectory();
        // const currentFilter = currPath.currentFilter();
        // const [dirToList, currentFilter] = this.filePicker.getCurrentInput();
        // console.log(`${key.toFsPath()} subdir of ${dirToList.toFsPath()}?: ${util.isSubdir(dirToList.toFsPath(), key.toFsPath())}`);

       if (key.isSubpathOf(dirToList)) {
            this.render();
        }
    }

    private async _render() {
        const currPath = this.filePicker.getCurrentValue();
        const dirToList = currPath.currentDirectory();
        const currentFilter = currPath.currentFilter();
        // const [dirToList, currentFilter] = this.filePicker.getCurrentInput();

        if (currentFilter.length === 0) {
            // When no filter is given, directories are listed before files.
            let items = await this.directoryCache.getFileListForDir(dirToList, 1);
            this.filePicker.quickPick.items = await this.simpleFilter.filterAndSort(items, currentFilter);
        } else {

            let items = await this.directoryCache.getFileListForDir(dirToList, config.filePickerFolderSearchDepth);
            items = await this.fuzzyFilter.filterAndSort(items, currentFilter);

            // TODO: highlight matches
            if (items.length > 0) {
                this.filePicker.quickPick.items = items;
            } else {
                this.filePicker.activateActionMode();
            }

        }
    }

    async onUpdate(): Promise<void> {
        const currPath = this.filePicker.getCurrentValue();
        const dirToList = currPath.currentDirectory();
        const currentFilter = currPath.currentFilter();

        try {

            if (await dirToList.isDirectory()) {

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

    async onAccept(): Promise<void> {
        if (this.filePicker.quickPick.activeItems.length > 0) {
            let item = this.filePicker.quickPick.activeItems[0];

            if (await item.absolutePath.isDirectory()) {
                this.filePicker.goto(item.absolutePath.withEndingSlash());
            } else {
                this.filePicker.hide();
                actions.openFile(item.absolutePath.toFsPath());

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
                actions.openNewFile(value.toFsPath());
            })
        ];

        this.actionsOnExistingFiles = [
            new ActionItem("$(new-folder) Add folder to workspace", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.addWorkspaceFolder(value.toFsPath());
            }),
            new ActionItem("$(folder-opened) Open folder", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.openFolder(value.toFsPath());
            }),
            new ActionItem("$(empty-window) Open in new window", (filePicker) => {
                let value = filePicker.getCurrentValue();
                filePicker.hide();
                actions.openInNewWindow(value.toFsPath());
            })
        ];
    }

    async onUpdate(): Promise<void> {
        let currentValue = this.filePicker.getCurrentValue();
        let items = [];

        if(await currentValue.exists()) {
            items = this.actionsOnExistingFiles;
        } else {
            items = this.actionsOnNonExistingFiles;
        }

        this.filePicker.quickPick.items = items;
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
    absolutePath: FPath;
    relativePath: string;
    label: string;

    constructor(uri: FPath) {
        this.absolutePath = uri;
    }

    public async setBaseUri(baseUri: FPath) {
        this.relativePath = baseUri.relativeTo(this.absolutePath).toFsPath();
        const type = await this.absolutePath.getType();

        switch (type) {
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
        return this.absolutePath.hash() + this.absolutePath.getType();
    }
}

class DirectoryCache {
    cache: Map<string, FileItem[]> = new Map();
    hashes: Map<string, Set<string>> = new Map();
    onUpdateCallback: (dirPath: FPath) => any;
    onBusyStart: (...args: any[]) => any;
    onBusyEnd: (...args: any[]) => any;
    lastScanTimes: Map<string, number> = new Map();

    constructor(onUpdateCallback: (dirPath: FPath) => any,
        onBusyStart: (...args: any[]) => any,
        onBusyEnd: (...args: any[]) => any) {

        this.onUpdateCallback = onUpdateCallback;
        this.onBusyStart = onBusyStart;
        this.onBusyEnd = onBusyEnd;
    }

    public set(dirPath: FPath, items: FileItem[]) {
        let hashSet = new Set<string>(items.map(item => item.hash()));

        if (this.cache.has(dirPath.hash())) {
            let existingHashes = this.hashes.get(dirPath.hash());
            let diff = symmetricDifference(hashSet, existingHashes);
            if (diff.size === 0) {
                return;
            }
        }

        this.cache.set(dirPath.hash(), items);
        this.hashes.set(dirPath.hash(), hashSet);
        this.onUpdateCallback(dirPath);
    }

    public get(dirPath: FPath): FileItem[] {
        return this.cache.get(dirPath.hash());
    }

    public has(dirPath: FPath) {
        return this.cache.has(dirPath.hash());
    }

    public async getFileListForDir(dirPath: FPath, depth = 1): Promise<FileItem[]> {
        
        if (depth === 0 || !this.cache.has(dirPath.hash())) {
            return [];
        }

        let items = this.cache.get(dirPath.hash());
        return (await Promise.all(items.map(async item => {
            await item.setBaseUri(dirPath);
            if (item.absolutePath.isDirectory() && !config.filePickerRecursiveIgnoreFolders.ignores(item.relativePath)) {
                let items = [item, ...await this.getFileListForDir(item.absolutePath, depth - 1)];
                for await (item of items) {
                    await item.setBaseUri(dirPath);
                }

                return items;
            }

            return [item];
        }))).flat();
    }

    public async update(dirPath: FPath, depth = 1) {
        this.onBusyStart();
        // let start = Date.now();
        await this._update(dirPath, depth);
        // console.log(`Scan directory time was ${Date.now() - start}ms`);
        this.onBusyEnd();
    }

    private async _update(dirPath: FPath, depth = 1) {
        
        try {
            // Breadth First directory Search
            if (!this.lastScanTimes.has(dirPath.hash()) || (Date.now() - this.lastScanTimes.get(dirPath.hash())) >= config.filePickerDirScanDebounceMilliseconds) {
                this.lastScanTimes.set(dirPath.hash(), Date.now());

                let items = (await dirPath.listDirectory()).map(fpath => new FileItem(fpath));

                this.set(dirPath, items);
            }

            if (depth > 1) {
                for await (const item of this.cache.get(dirPath.hash())) {
                    if (item.absolutePath.isDirectory()) {
                        let relativePath = dirPath.relativeTo(item.absolutePath).toFsPath();
                        if (!config.filePickerRecursiveIgnoreFolders.ignores(relativePath)) {
                            await this._update(item.absolutePath, depth - 1);
                        }
                    }
                }
            }
        } catch (e) {
            this.set(dirPath, []);
        }
        
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
    filterAndSort(items: FileItem[], filter: string): Promise<FileItem[]>;
}

class DirSortFilter implements ListFilter {
    async filterAndSort(items: FileItem[], filter: string) {
        return (await Promise.all(items.map(async item => {
            return {
                item: item,
                isDirectory: await item.absolutePath.isDirectory(),
                relativePath: item.relativePath.toLowerCase()
            };
        }))).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return (a.relativePath < b.relativePath) ? -1 : 1;
            }

            return a.isDirectory ? -1 : 1;
        }).map(item => item.item);
    }
}

class FuseFilter implements ListFilter {

    async filterAndSort(items: FileItem[], filter: string) {
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