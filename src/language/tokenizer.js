export function splitIntoLines(source) {
    const rawLines = source.split("\n");
    const lines = [];

    rawLines.forEach((line, index) => {
        const trimmed = line.trim();
        const lineNumber = index + 1;

        // Leere Zeilen ignorieren
        if (trimmed === "") {
            return;
        }

        // Ganze Kommentarzeilen ignorieren
        if (trimmed.startsWith("#")) {
            return;
        }

        // Inline-Kommentare entfernen
        const commentIndex = findCommentIndex(trimmed);

        let text = trimmed;
        if (commentIndex !== -1) {
            text = trimmed.substring(0, commentIndex).trim();
        }

        if (text !== "") {
            lines.push({
                text,
                lineNumber
            });
        }
    });

    return lines;
}

function findCommentIndex(line) {
    let inString = false;

    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inString = !inString;
        }

        if (!inString && line[i] === "#") {
            return i;
        }
    }

    return -1;
}