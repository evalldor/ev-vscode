import * as path from "path";

export function debounce<T extends Function>(func: T, waitFor = 80) {
    let timeout: any = 0;
    let callable = (...args: any) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.call(this, ...args), waitFor);
    };
    return <T>(<any>callable);
}

export function debounceStrict<T extends Function>(func: T, waitFor = 80) {
    let timeout: any = undefined;
    let callable = (...args: any) => {
        if (!timeout) {
            timeout = setTimeout(() => {
                timeout = clearTimeout(timeout);
                func.call(this, ...args);

            }, waitFor);
        }
    };

    return <T>(<any>callable);
}

export function isSubdir(parent: string, child: string) {
    const relative = path.relative(parent, child);
    return (relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative)));
}

export function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function isPathsEqual(path1: string, path2: string): boolean {
    path1 = path.resolve(path1);
    path2 = path.resolve(path2);

    return path1 === path2;
}

