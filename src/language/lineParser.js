export function parseLine(line) {
    const declarationTypes = ["Ganzzahl", "Kommazahl", "Text", "Wahrheitswert"];

    // Eingabe
    for (const currentType of declarationTypes) {
        const prefix = `Eingabe ${currentType} `;
        if (line.startsWith(prefix)) {
            const variable = line.substring(prefix.length).trim();

            return {
                type: "input",
                varType: currentType,
                variable
            };
        }
    }

    // Rückgabe
    if (line.startsWith("Gib ") && line.endsWith(" zurück")) {
        const expression = line.substring(4, line.length - 7).trim();

        return {
            type: "return",
            expression
        };
    }

    // Wiederhole x Mal
    if (line.startsWith("Wiederhole ") && line.endsWith(" Mal")) {
        const countExpression = line
            .replace("Wiederhole ", "")
            .replace(" Mal", "")
            .trim();

        return {
            type: "repeat",
            count: countExpression
        };
    }

    // Ende Wiederhole
    if (line === "Ende Wiederhole") {
        return {
            type: "endrepeat"
        };
    }

    // Deklarationen
    for (const currentType of declarationTypes) {
        if (line.startsWith(currentType + " ")) {
            const rest = line.substring((currentType + " ").length);
            const splitIndex = rest.indexOf("=");

            if (splitIndex === -1) {
                return {
                    type: "error",
                    message: "Deklaration hat kein '=' Zeichen",
                    content: line
                };
            }

            const variable = rest.substring(0, splitIndex).trim();
            const value = rest.substring(splitIndex + 1).trim();

            return {
                type: "declaration",
                varType: currentType,
                variable,
                value
            };
        }
    }

    // Ausgabe
    if (line.startsWith("Ausgabe ")) {
        const expression = line.substring("Ausgabe ".length).trim();

        return {
            type: "output",
            expression
        };
    }

    // Sonst Wenn
    if (line.startsWith("Sonst Wenn ")) {
        const conditionPart = line
            .replace("Sonst Wenn ", "")
            .replace(" Dann", "")
            .trim();

        return {
            type: "elseif",
            condition: conditionPart
        };
    }

    // Sonst
    if (line === "Sonst") {
        return {
            type: "else"
        };
    }

    // Wenn
    if (line.startsWith("Wenn ")) {
        const conditionPart = line
            .replace("Wenn ", "")
            .replace(" Dann", "")
            .trim();

        return {
            type: "if",
            condition: conditionPart
        };
    }

    // Ende Wenn
    if (line === "Ende Wenn") {
        return {
            type: "endif"
        };
    }

    // Solange
    if (line.startsWith("Solange ")) {
        const conditionPart = line
            .replace("Solange ", "")
            .replace(" gilt", "")
            .trim();

        return {
            type: "while",
            condition: conditionPart
        };
    }

    // Ende Solange
    if (line === "Ende Solange") {
        return {
            type: "endwhile"
        };
    }

    // Unterprogramm-Aufruf mit Parametern
    if (line.startsWith("Rufe ") && line.includes(" mit ") && line.endsWith(" auf")) {
        const withoutPrefix = line.substring(5, line.length - 4).trim();
        const mitIndex = withoutPrefix.indexOf(" mit ");

        if (mitIndex !== -1) {
            const program = withoutPrefix.substring(0, mitIndex).trim();
            const argText = withoutPrefix.substring(mitIndex + 5).trim();

            return {
                type: "call",
                program,
                args: splitArguments(argText)
            };
        }
    }

    // Unterprogramm-Aufruf ohne Parameter
    if (line.startsWith("Rufe ") && line.endsWith(" auf")) {
        const program = line.substring(5, line.length - 4).trim();

        return {
            type: "call",
            program,
            args: []
        };
    }

    // Turtle: vorwaerts(...)
    if (line.startsWith("vorwaerts(") && line.endsWith(")")) {
        return {
            type: "turtle_forward",
            expression: line.substring("vorwaerts(".length, line.length - 1).trim()
        };
    }

// Turtle: dreheLinks(...)
    if (line.startsWith("dreheLinks(") && line.endsWith(")")) {
        return {
            type: "turtle_left",
            expression: line.substring("dreheLinks(".length, line.length - 1).trim()
        };
    }

// Turtle: dreheRechts(...)
    if (line.startsWith("dreheRechts(") && line.endsWith(")")) {
        return {
            type: "turtle_right",
            expression: line.substring("dreheRechts(".length, line.length - 1).trim()
        };
    }

// Turtle: stiftHoch()
    if (line === "stiftHoch()") {
        return {
            type: "turtle_pen_up"
        };
    }

// Turtle: stiftRunter()
    if (line === "stiftRunter()") {
        return {
            type: "turtle_pen_down"
        };
    }

// Turtle: loescheZeichenflaeche()
    if (line === "loescheZeichenflaeche()") {
        return {
            type: "turtle_clear"
        };
    }

// Turtle: geheZu(x, y)
    if (line.startsWith("geheZu(") && line.endsWith(")")) {
        const inner = line.substring("geheZu(".length, line.length - 1).trim();
        const args = splitArguments(inner);

        if (args.length !== 2) {
            return {
                type: "error",
                message: "geheZu erwartet genau zwei Argumente.",
                content: line
            };
        }

        return {
            type: "turtle_move_to",
            xExpression: args[0],
            yExpression: args[1]
        };
    }

    // Zuweisung
    if (
        line.includes("=") &&
        !line.includes("==") &&
        !line.includes(">=") &&
        !line.includes("<=") &&
        !line.includes("!=")
    ) {
        const splitIndex = line.indexOf("=");

        if (splitIndex !== -1) {
            const variable = line.substring(0, splitIndex).trim();
            const value = line.substring(splitIndex + 1).trim();

            return {
                type: "assignment",
                variable,
                value
            };
        }
    }

    return {
        type: "unknown",
        content: line
    };
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