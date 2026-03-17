let errorLineSet = new Set();
let activeLineNumber = null;

export function initEditor() {
    const textarea = document.getElementById("editor");
    const highlight = document.getElementById("editorHighlight");
    const lineNumbersInner = document.getElementById("lineNumbersInner");

    function updateEditorView() {
        const lines = textarea.value.split("\n");

        const html = lines.map((line, index) => {
            const lineNumber = index + 1;
            const highlightedLine = highlightLine(line);

            let classes = "editor-line";

            if (errorLineSet.has(lineNumber)) {
                classes += " editor-line-error";
            }

            if (activeLineNumber === lineNumber) {
                classes += " editor-line-active";
            }

            return `<div class="${classes}">${highlightedLine || "&nbsp;"}</div>`;
        }).join("");

        highlight.innerHTML = html;
        updateLineNumbers(lines.length);
        syncScroll();
    }

    function updateLineNumbers(lineCount) {
        let html = "";

        for (let i = 1; i <= Math.max(1, lineCount); i++) {
            let classes = "";

            if (errorLineSet.has(i)) {
                classes += "line-number-error ";
            }

            if (activeLineNumber === i) {
                classes += "line-number-active ";
            }

            html += `<div class="${classes.trim()}">${i}</div>`;
        }

        lineNumbersInner.innerHTML = html;
    }

    function syncScroll() {
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
        lineNumbersInner.style.marginTop = `${-textarea.scrollTop}px`;
    }

    textarea.addEventListener("input", updateEditorView);
    textarea.addEventListener("scroll", syncScroll);

    textarea.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
            event.preventDefault();

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;
            const indent = "    ";

            textarea.value =
                value.substring(0, start) +
                indent +
                value.substring(end);

            textarea.selectionStart = textarea.selectionEnd = start + indent.length;
            updateEditorView();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;

            const beforeCursor = value.substring(0, start);
            const afterCursor = value.substring(end);

            const currentLineStart = beforeCursor.lastIndexOf("\n") + 1;
            const currentLine = beforeCursor.substring(currentLineStart);

            const currentIndentMatch = currentLine.match(/^\s*/);
            const currentIndent = currentIndentMatch ? currentIndentMatch[0] : "";

            const trimmedLine = currentLine.trim();

            let extraIndent = "";
            if (
                trimmedLine.startsWith("Wenn ") ||
                trimmedLine.startsWith("Sonst Wenn ") ||
                trimmedLine === "Sonst" ||
                trimmedLine.startsWith("Solange ") ||
                trimmedLine.startsWith("Wiederhole ")
            ) {
                extraIndent = "    ";
            }

            const insertion = "\n" + currentIndent + extraIndent;

            textarea.value =
                beforeCursor +
                insertion +
                afterCursor;

            const newPos = start + insertion.length;
            textarea.selectionStart = textarea.selectionEnd = newPos;

            updateEditorView();
        }
    });

    updateEditorView();
}

export function getEditorValue() {
    const textarea = document.getElementById("editor");
    return textarea ? textarea.value : "";
}

export function setEditorValue(value) {
    const textarea = document.getElementById("editor");
    if (!textarea) return;

    textarea.value = value;
    refreshEditor();
}

export function clearErrorLines() {
    errorLineSet = new Set();
    refreshEditor();
}

export function setErrorLines(lineNumbers) {
    errorLineSet = new Set(lineNumbers);
    refreshEditor();
}

export function clearActiveLine() {
    activeLineNumber = null;
    refreshEditor();
}

export function setActiveLine(lineNumber) {
    activeLineNumber = lineNumber;
    refreshEditor();
}

function refreshEditor() {
    const textarea = document.getElementById("editor");
    if (!textarea) return;

    const event = new Event("input");
    textarea.dispatchEvent(event);
}

function highlightLine(line) {
    const commentIndex = findCommentIndex(line);

    let codePart = line;
    let commentPart = "";

    if (commentIndex !== -1) {
        codePart = line.substring(0, commentIndex);
        commentPart = line.substring(commentIndex);
    }

    let escaped = escapeHtml(codePart);

    const stringStore = [];
    escaped = escaped.replace(/"[^"]*"/g, (match) => {
        const placeholder = `__STRING_${stringStore.length}__`;
        stringStore.push(match);
        return placeholder;
    });

    const replacements = [
        { regex: /\b(ZufallGanzzahl)\b/g, className: "token-keyword" },
        { regex: /\b(vorwaerts|dreheLinks|dreheRechts|stiftHoch|stiftRunter|geheZu|loescheZeichenflaeche)\b/g, className: "token-function" },
        { regex: /\b(Sonst Wenn|Ende Wenn|Ende Solange|Ende Wiederhole)\b/g, className: "token-keyword" },
        { regex: /\b(Wenn|Dann|Sonst|Solange|gilt|Wiederhole|Mal|Eingabe|Ausgabe|Gib|zurück|Rufe|mit|auf)\b/g, className: "token-keyword" },
        { regex: /\b(Ganzzahl|Kommazahl|Text|Wahrheitswert)\b/g, className: "token-type" },
        { regex: /\b(wahr|falsch)\b/g, className: "token-boolean" },
        { regex: /\b\d+(,\d+)?\b/g, className: "token-number" }
    ];

    for (const rule of replacements) {
        escaped = escaped.replace(rule.regex, (match) => {
            return `<span class="${rule.className}">${match}</span>`;
        });
    }

    escaped = escaped.replace(/__STRING_(\d+)__/g, (_, index) => {
        return `<span class="token-string">${stringStore[Number(index)]}</span>`;
    });

    if (commentPart !== "") {
        escaped += `<span class="token-comment">${escapeHtml(commentPart)}</span>`;
    }

    return escaped;
}

export function highlightLineForDisplay(line) {
    return highlightLine(line);
}

export function highlightCodeBlock(code) {
    return code
        .split("\n")
        .map((line) => highlightLine(line) || "&nbsp;")
        .join("\n");
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

function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}