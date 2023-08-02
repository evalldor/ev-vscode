import * as vscode from "vscode";
import * as constants from "./constants";
import ignore, { Ignore } from 'ignore';

export namespace config {
    export let filePickerFolderSearchDepth: number = 1;
    export let filePickerMatchingThreshold: number = 0.49;
    export let filePickerDirScanDebounceMilliseconds: number = 5000;
    export let filePickerRecursiveIgnoreFolders: Ignore = ignore().add([
        "node_modules",
        ".*"
    ]);
}

export function updateConfig() {
    let newConfig = vscode.workspace.getConfiguration("ev");
    config.filePickerFolderSearchDepth = newConfig.get(constants.CONFIG_FILEPICKER_SEARCH_DEPTH);
    config.filePickerMatchingThreshold = newConfig.get(constants.CONFIG_FILEPICKER_MATCHING_THRESHOLD);
    config.filePickerDirScanDebounceMilliseconds = newConfig.get(constants.CONFIG_FILEPICKER_DIR_SCAN_DEBOUNCE);
    config.filePickerRecursiveIgnoreFolders = ignore().add(newConfig.get(constants.CONFIG_FILEPICKER_RECURSIVE_IGNORE_FOLDERS));
}


