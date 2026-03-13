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

function mapType(type) {
    if (type === "Ganzzahl") return "Integer";
    if (type === "Kommazahl") return "Real";
    if (type === "Text") return "String";
    if (type === "Wahrheitswert") return "Boolean";
    return "Integer";
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

function parseCallExpression(expr) {
    const trimmed = expr.trim();

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

function replaceOutsideStrings(text, callback) {
    let result = "";
    let current = "";
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            if (!inString) {
                result += callback(current);
                current = '"';
                inString = true;
            } else {
                current += '"';
                result += current;
                current = "";
                inString = false;
            }
            continue;
        }

        current += char;
    }

    if (current !== "") {
        result += inString ? current : callback(current);
    }

    return result;
}

function replaceDecimalCommas(text) {
    return replaceOutsideStrings(text, part =>
        part.replace(/\b\d+,\d+\b/g, match => match.replace(",", "."))
    );
}

function replaceBooleanWords(text) {
    return replaceOutsideStrings(text, part =>
        part
            .replace(/\bwahr\b/g, "true")
            .replace(/\bfalsch\b/g, "false")
            .replace(/\bund\b/g, "and")
            .replace(/\boder\b/g, "or")
            .replace(/\bnicht\b/g, "not")
    );
}

function replaceComparisonOperators(text) {
    return replaceOutsideStrings(text, part =>
        part
            .replace(/==/g, "=")
            .replace(/!=/g, "<>")
    );
}

function replaceIdentifiers(text) {
    const reserved = new Set([
        "true", "false", "and", "or", "not",
        "begin", "end", "if", "then", "else",
        "while", "do", "for", "to", "downto",
        "procedure", "function", "var", "program",
        "integer", "real", "string", "boolean",
        "readln", "writeln", "Result", "Random", "Randomize"
    ]);

    return replaceOutsideStrings(text, part =>
        part.replace(/\b[A-Za-z_ÄÖÜäöü][A-Za-z0-9_ÄÖÜäöü]*\b/g, match => {
            if (reserved.has(match)) return match;
            return sanitizeIdentifier(match);
        })
    );
}

function replaceStringsWithPascalQuotes(text) {
    let result = "";
    let current = "";
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            if (!inString) {
                result += current;
                current = "";
                inString = true;
            } else {
                result += `'${current.replaceAll("'", "''")}'`;
                current = "";
                inString = false;
            }
            continue;
        }

        current += char;
    }

    result += current;
    return result;
}

function translateCallExpressions(text) {
    let result = text;

    while (true) {
        const match = findFirstCall(result);
        if (!match) break;

        const translatedArgs = match.args.map(arg => translateExpression(arg)).join(", ");
        const replacement = `${sanitizeIdentifier(match.program)}(${translatedArgs})`;

        result = result.substring(0, match.start) + replacement + result.substring(match.end);
    }

    return result;
}

function findFirstCall(text) {
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
                const parsed = parseCallExpression(full);

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

        const minExpr = translateExpression(match.min);
        const maxExpr = translateExpression(match.max);
        const replacement = `(Random((${maxExpr}) - (${minExpr}) + 1) + (${minExpr}))`;

        result = result.substring(0, match.start) + replacement + result.substring(match.end);
    }

    return result;
}

function translateExpression(expression) {
    let result = expression.trim();

    result = translateRandomExpressions(result);
    result = translateCallExpressions(result);
    result = replaceBooleanWords(result);
    result = replaceComparisonOperators(result);
    result = replaceDecimalCommas(result);
    result = replaceIdentifiers(result);
    result = replaceStringsWithPascalQuotes(result);

    return result;
}

function collectDeclaredVariables(source) {
    const declarations = [];
    const lines = source.split("\n");

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (
            line.startsWith("Ganzzahl ") ||
            line.startsWith("Kommazahl ") ||
            line.startsWith("Text ") ||
            line.startsWith("Wahrheitswert ")
        ) {
            const firstSpace = line.indexOf(" ");
            const type = line.substring(0, firstSpace).trim();
            const rest = line.substring(firstSpace + 1).trim();
            const splitIndex = rest.indexOf("=");

            if (splitIndex !== -1) {
                const name = rest.substring(0, splitIndex).trim();
                declarations.push({
                    name,
                    type
                });
            }
        }
    }

    return declarations;
}

function collectInputVariables(source) {
    const declarations = [];
    const lines = source.split("\n");

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (
            line.startsWith("Eingabe Ganzzahl ") ||
            line.startsWith("Eingabe Kommazahl ") ||
            line.startsWith("Eingabe Text ") ||
            line.startsWith("Eingabe Wahrheitswert ")
        ) {
            const parts = line.split(/\s+/);
            const type = parts[1];
            const name = parts.slice(2).join(" ").trim();

            declarations.push({
                name,
                type
            });
        }
    }

    return declarations;
}

function groupDeclarationsByType(declarations, excludedNames = []) {
    const excluded = new Set(excludedNames.map(name => sanitizeIdentifier(name)));
    const groups = new Map();

    for (const decl of declarations) {
        const safeName = sanitizeIdentifier(decl.name);
        if (excluded.has(safeName)) continue;

        const pascalType = mapType(decl.type);

        if (!groups.has(pascalType)) {
            groups.set(pascalType, new Set());
        }

        groups.get(pascalType).add(safeName);
    }

    return groups;
}

function buildVarBlock(declarations, excludedNames = [], extraNames = []) {
    const groups = groupDeclarationsByType(declarations, excludedNames);

    for (const extra of extraNames) {
        if (!groups.has(extra.type)) {
            groups.set(extra.type, new Set());
        }
        groups.get(extra.type).add(extra.name);
    }

    if (groups.size === 0) {
        return [];
    }

    const lines = ["var"];
    for (const [type, names] of groups.entries()) {
        lines.push(`    ${Array.from(names).join(", ")}: ${type};`);
    }
    return lines;
}

function splitTopLevelPlus(expr) {
    const parts = [];
    let current = "";
    let inString = false;
    let bracketDepth = 0;

    for (let i = 0; i < expr.length; i++) {
        const char = expr[i];

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

        if (!inString && bracketDepth === 0 && char === "+") {
            parts.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    if (current.trim() !== "") {
        parts.push(current.trim());
    }

    return parts;
}

function buildWritelnArguments(expr) {
    const parts = splitTopLevelPlus(expr);

    if (parts.length <= 1) {
        return translateExpression(expr);
    }

    return parts.map(part => translateExpression(part)).join(", ");
}

function translateCondition(condition) {
    return translateExpression(condition).trim();
}

function translateSourceToPascalStatements(source, functionContextName = null, subprograms = []) {
    const lines = source.split("\n");
    const result = [];
    let indentLevel = 1;
    let repeatCounter = 0;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        if (line === "Ende Wenn" || line === "Ende Solange" || line === "Ende Wiederhole") {
            indentLevel = Math.max(1, indentLevel - 1);
            result.push("    ".repeat(indentLevel) + "end;");
            continue;
        }

        if (line === "Sonst") {
            indentLevel = Math.max(1, indentLevel - 1);
            result.push("    ".repeat(indentLevel) + "end");
            result.push("    ".repeat(indentLevel) + "else");
            result.push("    ".repeat(indentLevel) + "begin");
            indentLevel++;
            continue;
        }

        if (line.startsWith("Sonst Wenn ") && line.endsWith(" Dann")) {
            indentLevel = Math.max(1, indentLevel - 1);
            const condition = line.substring("Sonst Wenn ".length, line.length - " Dann".length).trim();
            result.push("    ".repeat(indentLevel) + "end");
            result.push("    ".repeat(indentLevel) + `else if ${translateCondition(condition)} then`);
            result.push("    ".repeat(indentLevel) + "begin");
            indentLevel++;
            continue;
        }

        if (line.startsWith("Wenn ") && line.endsWith(" Dann")) {
            const condition = line.substring("Wenn ".length, line.length - " Dann".length).trim();
            result.push("    ".repeat(indentLevel) + `if ${translateCondition(condition)} then`);
            result.push("    ".repeat(indentLevel) + "begin");
            indentLevel++;
            continue;
        }

        if (line.startsWith("Solange ") && line.endsWith(" gilt")) {
            const condition = line.substring("Solange ".length, line.length - " gilt".length).trim();
            result.push("    ".repeat(indentLevel) + `while ${translateCondition(condition)} do`);
            result.push("    ".repeat(indentLevel) + "begin");
            indentLevel++;
            continue;
        }

        if (line.startsWith("Wiederhole ") && line.endsWith(" Mal")) {
            repeatCounter++;
            const loopVar = `__i${repeatCounter}`;
            const countExpr = line.substring("Wiederhole ".length, line.length - " Mal".length).trim();

            result.push("    ".repeat(indentLevel) + `for ${loopVar} := 1 to ${translateExpression(countExpr)} do`);
            result.push("    ".repeat(indentLevel) + "begin");
            indentLevel++;
            continue;
        }

        if (line.startsWith("Ausgabe ")) {
            const expr = line.substring("Ausgabe ".length).trim();
            result.push("    ".repeat(indentLevel) + `writeln(${buildWritelnArguments(expr)});`);
            continue;
        }

        if (line.startsWith("Eingabe ")) {
            const parts = line.split(/\s+/);
            const type = parts[1];
            const variable = sanitizeIdentifier(parts.slice(2).join(" ").trim());

            if (type === "Wahrheitswert") {
                result.push("    ".repeat(indentLevel) + "{ Hinweis: Wahrheitswerte direkt als true/false eingeben }");
            }

            result.push("    ".repeat(indentLevel) + `readln(${variable});`);
            continue;
        }

        if (line.startsWith("Gib ") && line.endsWith(" zurück")) {
            const expr = line.substring(4, line.length - 7).trim();

            if (functionContextName) {
                result.push("    ".repeat(indentLevel) + `${functionContextName} := ${translateExpression(expr)};`);
            } else {
                result.push("    ".repeat(indentLevel) + `{ Rückgabe außerhalb einer Funktion: ${translateExpression(expr)} }`);
            }
            continue;
        }

        if (
            line.startsWith("Ganzzahl ") ||
            line.startsWith("Kommazahl ") ||
            line.startsWith("Text ") ||
            line.startsWith("Wahrheitswert ")
        ) {
            const firstSpace = line.indexOf(" ");
            const rest = line.substring(firstSpace + 1).trim();
            const splitIndex = rest.indexOf("=");

            if (splitIndex !== -1) {
                const variable = sanitizeIdentifier(rest.substring(0, splitIndex).trim());
                const value = rest.substring(splitIndex + 1).trim();
                result.push("    ".repeat(indentLevel) + `${variable} := ${translateExpression(value)};`);
            }
            continue;
        }

        if (line.startsWith("Rufe ") && line.endsWith(" auf")) {
            const call = parseCallExpression(line);

            if (call) {
                const targetSubprogram = subprograms.find(sub => sub.name === call.program);

                if (targetSubprogram && targetSubprogram.returnType) {
                    continue;
                }

                const args = call.args.map(arg => translateExpression(arg)).join(", ");
                result.push("    ".repeat(indentLevel) + `${sanitizeIdentifier(call.program)}(${args});`);
                continue;
            }
        }

        if (
            line.includes("=") &&
            !line.includes("==") &&
            !line.includes(">=") &&
            !line.includes("<=") &&
            !line.includes("!=")
        ) {
            const splitIndex = line.indexOf("=");
            const variable = sanitizeIdentifier(line.substring(0, splitIndex).trim());
            const value = line.substring(splitIndex + 1).trim();
            result.push("    ".repeat(indentLevel) + `${variable} := ${translateExpression(value)};`);
            continue;
        }

        result.push("    ".repeat(indentLevel) + `{ Nicht übersetzt: ${line} }`);
    }

    return {
        lines: result,
        repeatCounter
    };
}

function buildSubprogramPascal(subprogram, allSubprograms) {
    const safeName = sanitizeIdentifier(subprogram.name);
    const parameters = Array.isArray(subprogram.parameters) ? subprogram.parameters : [];

    const parameterText = parameters
        .map(param => `${sanitizeIdentifier(param.name)}: ${mapType(param.type)}`)
        .join("; ");

    const declarations = [
        ...collectDeclaredVariables(subprogram.source || ""),
        ...collectInputVariables(subprogram.source || "")
    ];

    const excludedNames = parameters.map(param => param.name);

    const translated = translateSourceToPascalStatements(
        subprogram.source || "",
        subprogram.returnType ? safeName : null,
        allSubprograms
    );

    const extraNames = [];
    for (let i = 1; i <= translated.repeatCounter; i++) {
        extraNames.push({ name: `__i${i}`, type: "Integer" });
    }

    const varBlock = buildVarBlock(declarations, excludedNames, extraNames);

    const lines = [];

    if (subprogram.returnType) {
        if (parameterText.trim() === "") {
            lines.push(`function ${safeName}: ${mapType(subprogram.returnType)};`);
        } else {
            lines.push(`function ${safeName}(${parameterText}): ${mapType(subprogram.returnType)};`);
        }
    } else {
        if (parameterText.trim() === "") {
            lines.push(`procedure ${safeName};`);
        } else {
            lines.push(`procedure ${safeName}(${parameterText});`);
        }
    }

    if (varBlock.length > 0) {
        lines.push(...varBlock);
    }

    lines.push("begin");

    if (translated.lines.length === 0) {
        lines.push("end;");
        return lines;
    }

    lines.push(...translated.lines);
    lines.push("end;");

    return lines;
}

function projectUsesRandom(projectState) {
    const allSources = [
        projectState.mainSource || "",
        ...(projectState.subprograms || []).map(sub => sub.source || "")
    ];

    return allSources.some(source => source.includes("ZufallGanzzahl("));
}

export function generatePascalCode(projectState) {
    const subprograms = Array.isArray(projectState.subprograms) ? projectState.subprograms : [];
    const lines = [];

    lines.push("program WebSkriptExport;");
    lines.push("{$mode objfpc}");
    lines.push("");

    for (const subprogram of subprograms) {
        lines.push(...buildSubprogramPascal(subprogram, subprograms));
        lines.push("");
    }

    const mainDeclarations = [
        ...collectDeclaredVariables(projectState.mainSource || ""),
        ...collectInputVariables(projectState.mainSource || "")
    ];

    const mainTranslated = translateSourceToPascalStatements(projectState.mainSource || "", null, subprograms);

    const extraNames = [];
    for (let i = 1; i <= mainTranslated.repeatCounter; i++) {
        extraNames.push({ name: `__i${i}`, type: "Integer" });
    }

    const mainVarBlock = buildVarBlock(mainDeclarations, [], extraNames);

    if (mainVarBlock.length > 0) {
        lines.push(...mainVarBlock);
    }

    lines.push("begin");

    if (projectUsesRandom(projectState)) {
        lines.push("    Randomize;");
    }

    if (mainTranslated.lines.length === 0) {
        lines.push("end.");
        return lines.join("\n");
    }

    lines.push(...mainTranslated.lines);
    lines.push("end.");

    return lines.join("\n");
}