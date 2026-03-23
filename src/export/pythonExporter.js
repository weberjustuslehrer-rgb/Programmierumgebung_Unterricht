function sanitizeIdentifier(name) {
    return String(name)
        .trim()
        .replaceAll("ä", "ae")
        .replaceAll("ö", "oe")
        .replaceAll("ü", "ue")
        .replaceAll("Ä", "Ae")
        .replaceAll("Ö", "Oe")
        .replaceAll("Ü", "Ue")
        .replaceAll("ß", "ss")
        .replace(/[^\w]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+/, "")
        .replace(/_+$/, "") || "wert";
}

function splitArguments(text) {
    const args = [];
    let current = "";
    let inString = false;
    let bracketDepth = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            inString = !inString;
            current += char;
            continue;
        }

        if (!inString && char === "(") {
            bracketDepth++;
            current += char;
            continue;
        }

        if (!inString && char === ")") {
            bracketDepth--;
            current += char;
            continue;
        }

        if (!inString && bracketDepth === 0 && char === ",") {
            args.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    if (current.trim() !== "") {
        args.push(current.trim());
    }

    return args;
}

function parseWebSkriptCall(text) {
    const trimmed = text.trim();

    if (!trimmed.startsWith("Rufe ") || !trimmed.endsWith(" auf")) {
        return null;
    }

    const inner = trimmed.substring(5, trimmed.length - 4).trim();

    if (inner.includes(" mit ")) {
        const mitIndex = inner.indexOf(" mit ");
        const program = inner.substring(0, mitIndex).trim();
        const argsText = inner.substring(mitIndex + 5).trim();

        return {
            program,
            args: argsText === "" ? [] : splitArguments(argsText)
        };
    }

    return {
        program: inner,
        args: []
    };
}

function replaceOutsideStrings(text, regex, replacement) {
    const parts = [];
    let current = "";
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            if (!inString) {
                if (current !== "") {
                    parts.push({ type: "code", value: current });
                    current = "";
                }
                inString = true;
                current += char;
            } else {
                current += char;
                parts.push({ type: "string", value: current });
                current = "";
                inString = false;
            }
            continue;
        }

        current += char;
    }

    if (current !== "") {
        parts.push({ type: inString ? "string" : "code", value: current });
    }

    return parts.map(part => {
        if (part.type === "string") return part.value;
        if (typeof replacement === "function") {
            return part.value.replace(regex, replacement);
        }
        return part.value.replace(regex, replacement);
    }).join("");
}

function findCallExpression(text) {
    for (let i = 0; i < text.length; i++) {
        if (text.substring(i, i + 5) !== "Rufe ") continue;

        let inString = false;
        let bracketDepth = 0;

        for (let j = i + 5; j < text.length; j++) {
            const char = text[j];

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === "(") bracketDepth++;
            if (char === ")") bracketDepth--;

            if (bracketDepth === 0 && text.substring(j - 3, j + 1) === " auf") {
                const full = text.substring(i, j + 1);
                const parsed = parseWebSkriptCall(full);
                if (!parsed) return null;

                return {
                    start: i,
                    end: j + 1,
                    program: parsed.program,
                    args: parsed.args
                };
            }
        }
    }

    return null;
}

function findRandomExpression(text) {
    const marker = "ZufallGanzzahl(";

    for (let i = 0; i < text.length; i++) {
        if (text.substring(i, i + marker.length) !== marker) continue;

        let inString = false;
        let bracketDepth = 0;

        for (let j = i; j < text.length; j++) {
            const char = text[j];

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === "(") bracketDepth++;
            if (char === ")") {
                bracketDepth--;
                if (bracketDepth === 0) {
                    const full = text.substring(i, j + 1);
                    const inner = full.substring(marker.length, full.length - 1).trim();
                    const args = splitArguments(inner);

                    if (args.length !== 2) return null;

                    return {
                        start: i,
                        end: j + 1,
                        min: args[0],
                        max: args[1]
                    };
                }
            }
        }
    }

    return null;
}

function translateRandomExpressions(text) {
    let result = text;

    while (true) {
        const match = findRandomExpression(result);
        if (!match) break;

        const replacement = `random.randint(${translateExpressionToPython(match.min)}, ${translateExpressionToPython(match.max)})`;
        result = result.substring(0, match.start) + replacement + result.substring(match.end);
    }

    return result;
}

function translateCallExpressions(text) {
    let result = text;

    while (true) {
        const match = findCallExpression(result);
        if (!match) break;

        const replacement = `${sanitizeIdentifier(match.program)}(${match.args.map(arg => translateExpressionToPython(arg)).join(", ")})`;
        result = result.substring(0, match.start) + replacement + result.substring(match.end);
    }

    return result;
}

function replaceDecimalCommas(text) {
    return replaceOutsideStrings(text, /\b\d+,\d+\b/g, match => match.replace(",", "."));
}

function replaceIdentifiersOutsideStrings(text) {
    const keywords = new Set([
        "True", "False", "and", "or", "not",
        "if", "elif", "else", "while", "for", "in", "range",
        "return", "print", "input", "int", "float", "parse_bool",
        "random"
    ]);

    return replaceOutsideStrings(text, /\b[A-Za-z_ÄÖÜäöü][A-Za-z0-9_ÄÖÜäöü]*\b/g, match => {
        if (keywords.has(match)) return match;
        return sanitizeIdentifier(match);
    });
}

function translateExpressionToPython(expression) {
    let result = expression.trim();

    result = replaceOutsideStrings(result, /\bwahr\b/g, "True");
    result = replaceOutsideStrings(result, /\bfalsch\b/g, "False");
    result = replaceOutsideStrings(result, /\bund\b/g, "and");
    result = replaceOutsideStrings(result, /\boder\b/g, "or");
    result = replaceOutsideStrings(result, /\bnicht\b/g, "not");

    result = translateRandomExpressions(result);
    result = translateCallExpressions(result);
    result = replaceDecimalCommas(result);
    result = replaceIdentifiersOutsideStrings(result);

    return result;
}

function pythonInputExpression(type) {
    if (type === "Text") return "input()";
    if (type === "Ganzzahl") return "int(input())";
    if (type === "Kommazahl") return "float(input().replace(\",\", \".\"))";
    if (type === "Wahrheitswert") return "parse_bool(input())";
    return "input()";
}

function translateStatementToPython(line) {
    const declarationTypes = ["Ganzzahl", "Kommazahl", "Text", "Wahrheitswert"];

    for (const currentType of declarationTypes) {
        const inputPrefix = `Eingabe ${currentType} `;
        if (line.startsWith(inputPrefix)) {
            const variable = line.substring(inputPrefix.length).trim();
            return `${sanitizeIdentifier(variable)} = ${pythonInputExpression(currentType)}`;
        }
    }

    if (line.startsWith("Ausgabe ")) {
        const expression = line.substring("Ausgabe ".length).trim();
        return `print(${translateExpressionToPython(expression)})`;
    }

    if (line.startsWith("Gib ") && line.endsWith(" zurück")) {
        const expression = line.substring(4, line.length - 7).trim();
        return `return ${translateExpressionToPython(expression)}`;
    }

    for (const currentType of declarationTypes) {
        const prefix = `${currentType} `;
        if (line.startsWith(prefix)) {
            const rest = line.substring(prefix.length);
            const splitIndex = rest.indexOf("=");

            if (splitIndex !== -1) {
                const variable = rest.substring(0, splitIndex).trim();
                const value = rest.substring(splitIndex + 1).trim();
                return `${sanitizeIdentifier(variable)} = ${translateExpressionToPython(value)}`;
            }
        }
    }

    if (line.startsWith("Rufe ") && line.endsWith(" auf")) {
        return translateExpressionToPython(line);
    }

    if (
        line.includes("=") &&
        !line.includes("==") &&
        !line.includes(">=") &&
        !line.includes("<=") &&
        !line.includes("!=")
    ) {
        const splitIndex = line.indexOf("=");
        const variable = line.substring(0, splitIndex).trim();
        const value = line.substring(splitIndex + 1).trim();
        return `${sanitizeIdentifier(variable)} = ${translateExpressionToPython(value)}`;
    }

    if (line.startsWith("vorwaerts(") && line.endsWith(")")) {
        const expression = line.substring("vorwaerts(".length, line.length - 1).trim();
        return `t.forward(${translateExpressionToPython(expression)})`;
    }

    if (line.startsWith("rueckwaerts(") && line.endsWith(")")) {
        const expression = line.substring("rueckwaerts(".length, line.length - 1).trim();
        return `t.backward(${translateExpressionToPython(expression)})`;
    }

    if (line.startsWith("dreheLinks(") && line.endsWith(")")) {
        const expression = line.substring("dreheLinks(".length, line.length - 1).trim();
        return `t.left(${translateExpressionToPython(expression)})`;
    }

    if (line.startsWith("dreheRechts(") && line.endsWith(")")) {
        const expression = line.substring("dreheRechts(".length, line.length - 1).trim();
        return `t.right(${translateExpressionToPython(expression)})`;
    }

    if (line === "stiftHoch()") {
        return "t.penup()";
    }

    if (line === "stiftRunter()") {
        return "t.pendown()";
    }

    if (line === "loescheZeichenflaeche()") {
        return "t.clear()";
    }

    if (line.startsWith("geheZu(") && line.endsWith(")")) {
        const inner = line.substring("geheZu(".length, line.length - 1).trim();
        const args = splitArguments(inner);

        if (args.length === 2) {
            return `t.goto(${translateExpressionToPython(args[0])}, ${translateExpressionToPython(args[1])})`;
        }
    }

    return `# Nicht übersetzt: ${line}`;
}

function translateSourceToPython(source, baseIndentLevel = 0) {
    const lines = source.split("\n");
    const result = [];
    let indentLevel = baseIndentLevel;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        if (line === "Ende Wenn" || line === "Ende Solange" || line === "Ende Wiederhole") {
            indentLevel = Math.max(baseIndentLevel, indentLevel - 1);
            continue;
        }

        if (line === "Sonst") {
            indentLevel = Math.max(baseIndentLevel, indentLevel - 1);
            result.push("    ".repeat(indentLevel) + "else:");
            indentLevel++;
            continue;
        }

        if (line.startsWith("Sonst Wenn ") && line.endsWith(" Dann")) {
            indentLevel = Math.max(baseIndentLevel, indentLevel - 1);
            const condition = line.substring("Sonst Wenn ".length, line.length - " Dann".length).trim();
            result.push("    ".repeat(indentLevel) + `elif ${translateExpressionToPython(condition)}:`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Wenn ") && line.endsWith(" Dann")) {
            const condition = line.substring("Wenn ".length, line.length - " Dann".length).trim();
            result.push("    ".repeat(indentLevel) + `if ${translateExpressionToPython(condition)}:`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Solange ") && line.endsWith(" gilt")) {
            const condition = line.substring("Solange ".length, line.length - " gilt".length).trim();
            result.push("    ".repeat(indentLevel) + `while ${translateExpressionToPython(condition)}:`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Wiederhole ") && line.endsWith(" Mal")) {
            const countExpr = line.substring("Wiederhole ".length, line.length - " Mal".length).trim();
            result.push("    ".repeat(indentLevel) + `for _ in range(${translateExpressionToPython(countExpr)}):`);
            indentLevel++;
            continue;
        }

        result.push("    ".repeat(indentLevel) + translateStatementToPython(line));
    }

    return result;
}

function projectUsesBooleanInput(projectState) {
    const allSources = [
        projectState.mainSource || "",
        ...(projectState.subprograms || []).map(sub => sub.source || "")
    ];

    return allSources.some(source =>
        source.split("\n").some(line => line.trim().startsWith("Eingabe Wahrheitswert "))
    );
}

function projectUsesRandom(projectState) {
    const allSources = [
        projectState.mainSource || "",
        ...(projectState.subprograms || []).map(sub => sub.source || "")
    ];

    return allSources.some(source => source.includes("ZufallGanzzahl("));
}

function projectUsesTurtle(projectState) {
    return projectState?.mode === "turtle";
}

function translateSubprogramToPython(subprogram) {
    const parameterNames = (subprogram.parameters || []).map(param => sanitizeIdentifier(param.name)).join(", ");
    const lines = [];

    lines.push(`# Unterprogramm: ${subprogram.name}`);
    lines.push(`def ${sanitizeIdentifier(subprogram.name)}(${parameterNames}):`);

    const bodyLines = translateSourceToPython(subprogram.source || "", 1);
    if (bodyLines.length === 0) {
        lines.push("    pass");
    } else {
        lines.push(...bodyLines);
    }

    return lines;
}

export function generatePythonCode(projectState) {
    const parts = [];

    parts.push("# Automatisch aus WebSkript erzeugt");

    if (projectUsesTurtle(projectState)) {
        parts.push("import turtle");

        if (projectUsesRandom(projectState)) {
            parts.push("import random");
        }

        parts.push("");
        parts.push("screen = turtle.Screen()");
        parts.push("t = turtle.Turtle()");
        parts.push("t.speed(0)");
        parts.push("");

        for (const subprogram of projectState.subprograms || []) {
            parts.push(...translateSubprogramToPython(subprogram));
            parts.push("");
        }

        const mainLines = translateSourceToPython(projectState.mainSource || "", 0);
        if (mainLines.length === 0) {
            parts.push("pass");
        } else {
            parts.push(...mainLines);
        }

        parts.push("");
        parts.push("screen.mainloop()");
        return parts.join("\n");
    }

    if (projectUsesRandom(projectState)) {
        parts.push("import random");
    }

    if (projectUsesRandom(projectState) || projectUsesBooleanInput(projectState)) {
        parts.push("");
    }

    if (projectUsesBooleanInput(projectState)) {
        parts.push("def parse_bool(text):");
        parts.push("    value = text.strip().lower()");
        parts.push("    if value == \"wahr\":");
        parts.push("        return True");
        parts.push("    if value == \"falsch\":");
        parts.push("        return False");
        parts.push("    raise ValueError(\"Bitte wahr oder falsch eingeben.\")");
        parts.push("");
    }

    for (const subprogram of projectState.subprograms || []) {
        parts.push(...translateSubprogramToPython(subprogram));
        parts.push("");
    }

    parts.push("def main():");
    const mainLines = translateSourceToPython(projectState.mainSource || "", 1);
    if (mainLines.length === 0) {
        parts.push("    pass");
    } else {
        parts.push(...mainLines);
    }
    parts.push("");
    parts.push("if __name__ == \"__main__\":");
    parts.push("    main()");

    return parts.join("\n");
}