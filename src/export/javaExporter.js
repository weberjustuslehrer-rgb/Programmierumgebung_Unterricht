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
    if (type === "Ganzzahl") return "int";
    if (type === "Kommazahl") return "double";
    if (type === "Text") return "String";
    if (type === "Wahrheitswert") return "boolean";
    return "int";
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
            .replace(/\bund\b/g, "&&")
            .replace(/\boder\b/g, "||")
            .replace(/\bnicht\b/g, "!")
    );
}

function replaceComparisonOperators(text) {
    return replaceOutsideStrings(text, part =>
        part.replace(/(?<![=!<>])=(?![=])/g, "==")
    );
}

function replaceIdentifiers(text) {
    const reserved = new Set([
        "true", "false", "if", "else", "while", "for", "return",
        "int", "double", "String", "boolean", "scanner", "random",
        "System", "out", "println", "nextLine", "Integer", "Double",
        "parseInt", "parseDouble", "Random", "Scanner"
    ]);

    return replaceOutsideStrings(text, part =>
        part.replace(/\b[A-Za-z_ÄÖÜäöü][A-Za-z0-9_ÄÖÜäöü]*\b/g, match => {
            if (reserved.has(match)) return match;
            return sanitizeIdentifier(match);
        })
    );
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
        const replacement = `(random.nextInt((${maxExpr}) - (${minExpr}) + 1) + (${minExpr}))`;

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

function buildLocalDeclarations(source, excludedNames = [], extraLocals = []) {
    const excluded = new Set(excludedNames.map(name => sanitizeIdentifier(name)));
    const all = [
        ...collectDeclaredVariables(source),
        ...collectInputVariables(source),
        ...extraLocals
    ];

    const lines = [];
    const seen = new Set();

    for (const entry of all) {
        const safeName = sanitizeIdentifier(entry.name);
        if (excluded.has(safeName)) continue;
        if (seen.has(safeName)) continue;
        seen.add(safeName);

        lines.push(`        ${mapType(entry.type)} ${safeName};`);
    }

    return lines;
}

function buildPrintExpression(expr) {
    const translated = translateExpression(expr);
    return `System.out.println(${translated});`;
}

function translateInputStatement(type, variable) {
    const safeVar = sanitizeIdentifier(variable);

    if (type === "Text") {
        return `${safeVar} = scanner.nextLine();`;
    }

    if (type === "Ganzzahl") {
        return `${safeVar} = Integer.parseInt(scanner.nextLine());`;
    }

    if (type === "Kommazahl") {
        return `${safeVar} = Double.parseDouble(scanner.nextLine().replace(",", "."));`;
    }

    if (type === "Wahrheitswert") {
        return `${safeVar} = parseBooleanWebSkript(scanner.nextLine());`;
    }

    return `${safeVar} = scanner.nextLine();`;
}

function translateSourceToJavaStatements(source, subprograms = []) {
    const lines = source.split("\n");
    const result = [];
    let indentLevel = 2;
    let repeatCounter = 0;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        if (line === "Ende Wenn" || line === "Ende Solange" || line === "Ende Wiederhole") {
            indentLevel = Math.max(2, indentLevel - 1);
            result.push(`${"    ".repeat(indentLevel)}}`);
            continue;
        }

        if (line === "Sonst") {
            indentLevel = Math.max(2, indentLevel - 1);
            result.push(`${"    ".repeat(indentLevel)}} else {`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Sonst Wenn ") && line.endsWith(" Dann")) {
            indentLevel = Math.max(2, indentLevel - 1);
            const condition = line.substring("Sonst Wenn ".length, line.length - " Dann".length).trim();
            result.push(`${"    ".repeat(indentLevel)}} else if (${translateExpression(condition)}) {`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Wenn ") && line.endsWith(" Dann")) {
            const condition = line.substring("Wenn ".length, line.length - " Dann".length).trim();
            result.push(`${"    ".repeat(indentLevel)}if (${translateExpression(condition)}) {`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Solange ") && line.endsWith(" gilt")) {
            const condition = line.substring("Solange ".length, line.length - " gilt".length).trim();
            result.push(`${"    ".repeat(indentLevel)}while (${translateExpression(condition)}) {`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Wiederhole ") && line.endsWith(" Mal")) {
            repeatCounter++;
            const loopVar = `__i${repeatCounter}`;
            const countExpr = line.substring("Wiederhole ".length, line.length - " Mal".length).trim();
            result.push(`${"    ".repeat(indentLevel)}for (${loopVar} = 1; ${loopVar} <= ${translateExpression(countExpr)}; ${loopVar}++) {`);
            indentLevel++;
            continue;
        }

        if (line.startsWith("Ausgabe ")) {
            const expr = line.substring("Ausgabe ".length).trim();
            result.push(`${"    ".repeat(indentLevel)}${buildPrintExpression(expr)}`);
            continue;
        }

        if (line.startsWith("Eingabe ")) {
            const parts = line.split(/\s+/);
            const type = parts[1];
            const variable = parts.slice(2).join(" ").trim();
            result.push(`${"    ".repeat(indentLevel)}${translateInputStatement(type, variable)}`);
            continue;
        }

        if (line.startsWith("Gib ") && line.endsWith(" zurück")) {
            const expr = line.substring(4, line.length - 7).trim();
            result.push(`${"    ".repeat(indentLevel)}return ${translateExpression(expr)};`);
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
                result.push(`${"    ".repeat(indentLevel)}${variable} = ${translateExpression(value)};`);
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
                result.push(`${"    ".repeat(indentLevel)}${sanitizeIdentifier(call.program)}(${args});`);
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
            result.push(`${"    ".repeat(indentLevel)}${variable} = ${translateExpression(value)};`);
            continue;
        }

        result.push(`${"    ".repeat(indentLevel)}// Nicht übersetzt: ${line}`);
    }

    return {
        lines: result,
        repeatCounter
    };
}

function buildMethodForSubprogram(subprogram, allSubprograms) {
    const methodName = sanitizeIdentifier(subprogram.name);
    const parameters = Array.isArray(subprogram.parameters) ? subprogram.parameters : [];
    const returnType = subprogram.returnType ? mapType(subprogram.returnType) : "void";

    const parameterText = parameters
        .map(param => `${mapType(param.type)} ${sanitizeIdentifier(param.name)}`)
        .join(", ");

    const translated = translateSourceToJavaStatements(
        subprogram.source || "",
        allSubprograms
    );

    const extraLocals = [];
    for (let i = 1; i <= translated.repeatCounter; i++) {
        extraLocals.push({ name: `__i${i}`, type: "Ganzzahl" });
    }

    const localDeclarations = buildLocalDeclarations(
        subprogram.source || "",
        parameters.map(param => param.name),
        extraLocals
    );

    const lines = [];
    lines.push(`    public static ${returnType} ${methodName}(${parameterText}) {`);

    if (localDeclarations.length > 0) {
        lines.push(...localDeclarations);
        lines.push("");
    }

    if (translated.lines.length > 0) {
        lines.push(...translated.lines);
    }

    if (translated.lines.length === 0 && returnType !== "void") {
        if (returnType === "int") lines.push("        return 0;");
        else if (returnType === "double") lines.push("        return 0.0;");
        else if (returnType === "boolean") lines.push("        return false;");
        else lines.push('        return "";');
    }

    lines.push("    }");
    return lines;
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

export function generateJavaCode(projectState) {
    const parts = [];
    const subprograms = Array.isArray(projectState.subprograms) ? projectState.subprograms : [];

    parts.push("import java.util.Scanner;");
    if (projectUsesRandom(projectState)) {
        parts.push("import java.util.Random;");
    }
    parts.push("");
    parts.push("public class Main {");
    parts.push("    private static final Scanner scanner = new Scanner(System.in);");
    if (projectUsesRandom(projectState)) {
        parts.push("    private static final Random random = new Random();");
    }
    parts.push("");

    if (projectUsesBooleanInput(projectState)) {
        parts.push("    public static boolean parseBooleanWebSkript(String text) {");
        parts.push('        String value = text.trim().toLowerCase();');
        parts.push('        if (value.equals("wahr")) return true;');
        parts.push('        if (value.equals("falsch")) return false;');
        parts.push('        throw new IllegalArgumentException("Bitte wahr oder falsch eingeben.");');
        parts.push("    }");
        parts.push("");
    }

    for (const subprogram of subprograms) {
        parts.push(...buildMethodForSubprogram(subprogram, subprograms));
        parts.push("");
    }

    const translatedMain = translateSourceToJavaStatements(projectState.mainSource || "", subprograms);

    const extraLocals = [];
    for (let i = 1; i <= translatedMain.repeatCounter; i++) {
        extraLocals.push({ name: `__i${i}`, type: "Ganzzahl" });
    }

    const mainLocalDeclarations = buildLocalDeclarations(
        projectState.mainSource || "",
        [],
        extraLocals
    );

    parts.push("    public static void main(String[] args) {");

    if (mainLocalDeclarations.length > 0) {
        parts.push(...mainLocalDeclarations);
        parts.push("");
    }

    parts.push(...translatedMain.lines);
    parts.push("    }");
    parts.push("}");

    return parts.join("\n");
}