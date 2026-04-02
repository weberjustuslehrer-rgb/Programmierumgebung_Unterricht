function normalizeSource(source) {
    return String(source || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
}

function countTraceEntries(trace, type, value) {
    return trace.filter(entry => {
        if (entry.type !== type) return false;
        if (value === undefined) return true;
        return entry.value === value;
    }).length;
}

function matchesExactTrace(trace, expected) {
    if (!Array.isArray(expected)) return true;
    if (trace.length !== expected.length) return false;

    for (let i = 0; i < expected.length; i++) {
        const a = trace[i];
        const b = expected[i];

        if (a.type !== b.type) return false;

        if ("value" in b && a.value !== b.value) return false;
        if ("x" in b && a.x !== b.x) return false;
        if ("y" in b && a.y !== b.y) return false;
    }

    return true;
}

function matchesTracePattern(trace, patterns) {
    if (!Array.isArray(patterns)) return true;

    return patterns.every(pattern => {
        const count = countTraceEntries(trace, pattern.type, pattern.value);
        return count === pattern.count;
    });
}

function includesAllSourceParts(source, requiredParts) {
    if (!Array.isArray(requiredParts)) return true;
    const normalized = normalizeSource(source).toLowerCase();

    return requiredParts.every(part =>
        normalized.includes(String(part).toLowerCase())
    );
}

function findSubprogramByName(programs, name) {
    if (!programs || !Array.isArray(programs.subprograms)) return null;
    return programs.subprograms.find(sub =>
        String(sub.name || "").trim().toLowerCase() === String(name).trim().toLowerCase()
    ) || null;
}

function customCheck(task, context) {
    const { sourceCode, trace, programs } = context;
    const normalized = normalizeSource(sourceCode).toLowerCase();
    const custom = task.requires?.customCheck;

    if (!custom) {
        return { success: true };
    }

    if (custom === "subprogramSquare80") {
        const sub = findSubprogramByName(programs, "Quadrat");
        if (!sub) {
            return { success: false, message: "Bitte lege ein Unterprogramm mit dem Namen „Quadrat“ an." };
        }
        if (!normalized.includes("rufe quadrat auf")) {
            return { success: false, message: "Im Hauptprogramm muss das Unterprogramm „Quadrat“ aufgerufen werden." };
        }
        return { success: true };
    }

    if (custom === "twoSquareCalls") {
        const callCount = (normalized.match(/rufe quadrat auf/g) || []).length;
        if (callCount < 2) {
            return { success: false, message: "Das Unterprogramm „Quadrat“ sollte mindestens zweimal aufgerufen werden." };
        }
        if (!normalized.includes("gehezu(") && !normalized.includes("gehezu (")) {
            return { success: false, message: "Zwischen den Quadraten fehlt ein Positionswechsel mit geheZu(...)." };
        }
        return { success: true };
    }

    if (custom === "ifTriangleElseSquare") {
        if (!normalized.includes("wenn") || !normalized.includes("sonst")) {
            return { success: false, message: "Es fehlt eine vollständige Alternative mit Wenn ... Sonst ... Ende Wenn." };
        }
        return { success: true };
    }

    if (custom === "subprogramTriangle") {
        const sub = findSubprogramByName(programs, "Dreieck");
        if (!sub) {
            return { success: false, message: "Bitte lege ein Unterprogramm mit dem Namen „Dreieck“ an." };
        }
        if (!normalized.includes("rufe dreieck auf")) {
            return { success: false, message: "Im Hauptprogramm muss „Dreieck“ aufgerufen werden." };
        }
        return { success: true };
    }

    if (custom === "houseWithSubprograms") {
        if (!normalized.includes("rufe quadrat auf") || !normalized.includes("rufe dreieck auf")) {
            return { success: false, message: "Für das Haus sollen Quadrat und Dreieck als Unterprogramme verwendet werden." };
        }
        return { success: true };
    }

    if (custom === "threeSquaresRow") {
        if (!normalized.includes("rufe quadrat auf")) {
            return { success: false, message: "Nutze dein Unterprogramm „Quadrat“." };
        }
        if (!normalized.includes("wiederhole 3 mal")) {
            return { success: false, message: "Die drei Quadrate sollen über eine Wiederholung entstehen." };
        }
        return { success: true };
    }

    if (custom === "ifSquareElseTriangleSubprograms") {
        if (!normalized.includes("wenn") || !normalized.includes("sonst")) {
            return { success: false, message: "Es fehlt die Alternative." };
        }
        if (!normalized.includes("rufe quadrat auf") || !normalized.includes("rufe dreieck auf")) {
            return { success: false, message: "Nutze die vorhandenen Unterprogramme Quadrat und Dreieck." };
        }
        return { success: true };
    }

    if (custom === "whileFiveSteps") {
        if (!normalized.includes("solange") || !normalized.includes("i = i + 1")) {
            return { success: false, message: "Es fehlt eine vollständige Solange-Schleife mit Zählvariable." };
        }
        return { success: true };
    }

    if (custom === "subprogramStar") {
        const sub = findSubprogramByName(programs, "Stern");
        if (!sub) {
            return { success: false, message: "Bitte lege ein Unterprogramm mit dem Namen „Stern“ an." };
        }
        if (!normalized.includes("rufe stern auf")) {
            return { success: false, message: "Im Hauptprogramm muss „Stern“ aufgerufen werden." };
        }
        return { success: true };
    }

    if (custom === "twoStars") {
        const starCalls = (normalized.match(/rufe stern auf/g) || []).length;
        if (starCalls < 2) {
            return { success: false, message: "Der Stern soll mindestens zweimal gezeichnet werden." };
        }
        return { success: true };
    }

    if (custom === "freeStructureTask") {
        const hasLoop = normalized.includes("wiederhole") || normalized.includes("solange");
        const hasIf = normalized.includes("wenn") && normalized.includes("sonst");
        const hasCall = normalized.includes("rufe ");
        if (!hasLoop || !hasIf || !hasCall) {
            return {
                success: false,
                message: "Die Aufgabe verlangt mindestens eine Wiederholung, eine Alternative und einen Unterprogrammaufruf."
            };
        }
        return { success: true };
    }

    if (custom === "finalProject") {
        const callMatches = normalized.match(/rufe [a-zA-Z_][a-zA-Z0-9_]* auf/g) || [];
        const uniqueCalls = new Set(callMatches.map(item => item.toLowerCase()));

        const hasLoop = normalized.includes("wiederhole") || normalized.includes("solange");
        const hasMove = normalized.includes("stifthoch") && normalized.includes("gehezu") && normalized.includes("stiftrunter");

        if (uniqueCalls.size < 2) {
            return { success: false, message: "Bitte verwende mindestens zwei verschiedene Unterprogramme." };
        }

        if (!hasLoop) {
            return { success: false, message: "Bitte verwende mindestens eine Wiederholung." };
        }

        if (!hasMove) {
            return { success: false, message: "Bitte verwende mindestens einen Positionswechsel mit stiftHoch / geheZu / stiftRunter." };
        }

        return { success: true };
    }

    return { success: true };
}

export function checkTask(task, context) {
    const relevantTrace = (context.trace || []).filter(entry =>
        ["forward", "backward", "left", "right", "moveTo", "penUp", "penDown", "clear"].includes(entry.type)
    );

    const sourceCode = context.sourceCode || "";
    const requires = task.requires || {};

    if (requires.exactTrace && !matchesExactTrace(relevantTrace, requires.exactTrace)) {
        return {
            success: false,
            message: "Die Befehlsfolge passt noch nicht ganz zur Aufgabe."
        };
    }

    if (requires.tracePattern && !matchesTracePattern(relevantTrace, requires.tracePattern)) {
        return {
            success: false,
            message: "Die ausgeführten Turtle-Befehle passen noch nicht zur Aufgabe."
        };
    }

    if (requires.sourceIncludes && !includesAllSourceParts(sourceCode, requires.sourceIncludes)) {
        return {
            success: false,
            message: "Im Quelltext fehlt noch ein wichtiger Bestandteil."
        };
    }

    const customResult = customCheck(task, context);
    if (!customResult.success) {
        return customResult;
    }

    return {
        success: true,
        message: "🎉 Super gemacht! Lösung korrekt."
    };
}