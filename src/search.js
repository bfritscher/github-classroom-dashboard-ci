const fs = require('fs').promises;
const path = require('path');

const BLACKLIST = [
    'node_modules',
    'dist',
    '.git',
    'site-packages',
    '__pycache__',
];

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function prepRegex(regex) {
    if (!(regex instanceof RegExp)) {
        if (regex.startsWith('/') && regex.endsWith('/')) {
            regex = regex.slice(1, regex.length - 1);
        } else {
            escapeRegExp(regex);
        }
        regex = new RegExp(regex);
    }    
    return regex;
}

async function searchInFiles(rootPath, extensions, regex, windowLineDelta = 1, startPath = rootPath) {
    if (!extensions) {
        extensions = [];
    }
    regex = prepRegex(regex);
    let results = [];
    const files = await fs.readdir(startPath);
    for (const file of files) {
        const filePath = path.join(startPath, file);
        const stat = await fs.lstat(filePath);
        if (BLACKLIST.includes(file)) {
            continue;
        }
        if (stat.isDirectory()) {
            const subResults = await searchInFiles(rootPath, extensions, regex, windowLineDelta, filePath);
            results = results.concat(subResults);
        } else {
            const ext = path.extname(filePath);
            if (extensions.length === 0 || extensions.includes(ext)) {
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n');
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const line = lines[lineIndex];
                    if (line.match(regex)) {
                        const startLine = Math.max(0, lineIndex - windowLineDelta);
                        const endLine = Math.min(lines.length - 1, lineIndex + windowLineDelta);
                        const snippet = lines.slice(startLine, endLine + 1).join('\n');
                        const relativePath = path.relative(rootPath, filePath);
                        const globalRegex = new RegExp(`(\\S*${regex.source}\\S*)`, 'g');
                        results.push({ path: relativePath, line: lineIndex + 1 , snippet: snippet.replaceAll(globalRegex, `<mark>$1</mark>`) });
                    }
                }
            }
        }
    }
    return results;
}

async function searchFolderAndFiles(rootPath, regex, startPath = rootPath) {
    regex = prepRegex(regex);
    let results = [];
    const files = await fs.readdir(startPath);
    for (const file of files) {
        const filePath = path.join(startPath, file);
        const stat = await fs.lstat(filePath);
        // add folder even if blacklist
        if(file.match(regex)) {
            const relativePath = path.relative(rootPath, filePath)
            results.push({ path: relativePath, line: 0, snippet: relativePath });
        }        
        if (stat.isDirectory()) {
            // but do not go into it
            if (BLACKLIST.includes(file)) {
                continue;
            }
            const subResults = await searchFolderAndFiles(rootPath, regex, filePath);
            results = results.concat(subResults);
        }
    }
    return results;    
}


module.exports = {
    searchInFiles,
    searchFolderAndFiles
}
