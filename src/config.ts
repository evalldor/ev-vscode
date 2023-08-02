import * as vscode from "vscode";
import * as constants from "./constants";



export namespace config {
    export let filePickerFolderSearchDepth: number = 1;
    export let filePickerMatchingThreshold: number = 0.49;
    export let filePickerDirScanDebounceMilliseconds: number = 1000;
}

export function updateConfig() {
    let newConfig = vscode.workspace.getConfiguration("ev");
    config.filePickerFolderSearchDepth = newConfig.get(constants.CONFIG_FILEPICKER_SEARCH_DEPTH);
    config.filePickerMatchingThreshold = newConfig.get(constants.CONFIG_FILEPICKER_MATCHING_THRESHOLD);
}


