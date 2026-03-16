export class Interpreter {
    constructor(options = {}) {
        this.maxLoopIterations = options.maxLoopIterations || 100000;
        this.debug = options.debug || false;
        this.programs = options.programs || null;
        this.turtleApi = options.turtleApi || null;

        this.mainContext = {
            variables: {},
            variableTypes: {}
        };

        this.execution = null;
    }

    /* -------------------------------------------------------------
       Grundlegende Hilfsfunktionen
    ------------------------------------------------------------- */

    formatValue(value) {
        if (typeof value === "boolean") {
            return value ? "wahr" : "falsch";
        }

        if (typeof value === "number") {
            const rounded = Math.round(value * 1000000000) / 1000000000;

            if (Number.isInteger(rounded)) {
                return String(rounded);
            }

            return String(rounded).replace(".", ",");
        }

        return String(value);
    }

    normalizeNumericString(text) {
        return text.replace(",", ".");
    }

    inferType(value) {
        if (typeof value === "boolean") return "Wahrheitswert";
        if (typeof value === "string") return "Text";

        if (typeof value === "number") {
            return Number.isInteger(value) ? "Ganzzahl" : "Kommazahl";
        }

        return "Unbekannt";
    }

    isValueCompatible(expectedType, value) {
        const actualType = this.inferType(value);

        if (expectedType === actualType) {
            return true;
        }

        if (expectedType === "Kommazahl" && actualType === "Ganzzahl") {
            return true;
        }

        return false;
    }

    parseInput(rawInput, expectedType) {
        const trimmed = rawInput.trim();

        if (expectedType === "Text") {
            return { ok: true, value: trimmed };
        }

        if (expectedType === "Wahrheitswert") {
            if (trimmed === "wahr") return { ok: true, value: true };
            if (trimmed === "falsch") return { ok: true, value: false };

            return { ok: false, message: `Die Eingabe "${trimmed}" passt nicht zum Datentyp Wahrheitswert.` };
        }

        if (expectedType === "Ganzzahl") {
            const normalized = this.normalizeNumericString(trimmed);
            const number = Number(normalized);

            if (!isNaN(number) && Number.isInteger(number)) {
                return { ok: true, value: number };
            }

            return { ok: false, message: `Die Eingabe "${trimmed}" passt nicht zum Datentyp Ganzzahl.` };
        }

        if (expectedType === "Kommazahl") {
            const normalized = this.normalizeNumericString(trimmed);
            const number = Number(normalized);

            if (!isNaN(number)) {
                return { ok: true, value: number };
            }

            return { ok: false, message: `Die Eingabe "${trimmed}" passt nicht zum Datentyp Kommazahl.` };
        }

        return { ok: false, message: "Unbekannter Datentyp bei der Eingabe." };
    }

    withLine(node, message) {
        if (node && node.lineNumber) {
            return `Zeile ${node.lineNumber}: ${message}`;
        }
        return message;
    }

    getProgramName(programId) {
        if (programId === "main") {
            return "Hauptprogramm";
        }

        if (!this.programs || !Array.isArray(this.programs.subprograms)) {
            return "Unterprogramm";
        }

        const subprogram = this.programs.subprograms.find(entry => entry.id === programId);
        return subprogram ? subprogram.name : "Unterprogramm";
    }

    isMainProgramId(programId) {
        return programId === "main";
    }

    isTurtleMode() {
        return this.programs?.mode === "turtle";
    }

    captureVariableState(currentProgramId) {
        const mainVariables = [];
        const localVariables = [];

        const mainVars = this.mainContext?.variables || {};
        const mainTypes = this.mainContext?.variableTypes || {};

        for (const name of Object.keys(mainVars)) {
            mainVariables.push({
                name,
                type: mainTypes[name] || this.inferType(mainVars[name]),
                value: this.formatValue(mainVars[name])
            });
        }

        if (currentProgramId !== "main" && this.execution) {
            const frame = this.execution.callStack[this.execution.callStack.length - 1];
            if (frame) {
                for (const name of Object.keys(frame.variables)) {
                    localVariables.push({
                        name,
                        type: frame.variableTypes[name] || this.inferType(frame.variables[name]),
                        value: this.formatValue(frame.variables[name])
                    });
                }
            }
        }

        return {
            mainVariables,
            localVariables,
            localProgramName: currentProgramId !== "main" ? this.getProgramName(currentProgramId) : null
        };
    }

    createTraceEntry(type, node, text, programId) {
        return {
            type,
            lineNumber: node?.lineNumber ?? null,
            programId,
            text,
            variableState: this.captureVariableState(programId || "main")
        };
    }

    /* -------------------------------------------------------------
       Ausdrucksauswertung
    ------------------------------------------------------------- */

    hasOuterParentheses(expr) {
        expr = expr.trim();

        if (!(expr.startsWith("(") && expr.endsWith(")"))) {
            return false;
        }

        let depth = 0;
        let inString = false;

        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];

            if (char === '"') {
                inString = !inString;
            }

            if (inString) continue;

            if (char === "(") depth++;
            if (char === ")") depth--;

            if (depth === 0 && i < expr.length - 1) {
                return false;
            }
        }

        return true;
    }

    splitTopLevel(expr, operators) {
        let inString = false;
        let bracketDepth = 0;

        for (let i = expr.length - 1; i >= 0; i--) {
            const char = expr[i];

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === ")") {
                bracketDepth++;
                continue;
            }

            if (char === "(") {
                bracketDepth--;
                continue;
            }

            if (bracketDepth !== 0) continue;

            for (const operator of operators) {
                const start = i - operator.length + 1;

                if (start < 0) continue;

                if (expr.substring(start, i + 1) === operator) {
                    const left = expr.substring(0, start).trim();
                    const right = expr.substring(i + 1).trim();

                    if (left !== "" && right !== "") {
                        return {
                            operator,
                            left,
                            right
                        };
                    }
                }
            }
        }

        return null;
    }

    parseCallExpression(expr) {
        expr = expr.trim();

        while (this.hasOuterParentheses(expr)) {
            expr = expr.substring(1, expr.length - 1).trim();
        }

        if (!expr.startsWith("Rufe ") || !expr.endsWith(" auf")) {
            return null;
        }

        const inner = expr.substring(5, expr.length - 4).trim();

        if (inner.includes(" mit ")) {
            const mitIndex = inner.indexOf(" mit ");
            const program = inner.substring(0, mitIndex).trim();
            const argsText = inner.substring(mitIndex + 5).trim();

            return {
                program,
                args: argsText === "" ? [] : this.splitArguments(argsText)
            };
        }

        return {
            program: inner,
            args: []
        };
    }

    parseRandomExpression(expr) {
        expr = expr.trim();

        while (this.hasOuterParentheses(expr)) {
            expr = expr.substring(1, expr.length - 1).trim();
        }

        if (!expr.startsWith("ZufallGanzzahl(") || !expr.endsWith(")")) {
            return null;
        }

        const inner = expr.substring("ZufallGanzzahl(".length, expr.length - 1).trim();
        const args = this.splitArguments(inner);

        if (args.length !== 2) {
            throw new Error("ZufallGanzzahl erwartet genau zwei Argumente.");
        }

        return {
            min: args[0],
            max: args[1]
        };
    }

    splitArguments(text) {
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

    getCurrentFrame() {
        if (!this.execution || this.execution.callStack.length === 0) {
            return null;
        }
        return this.execution.callStack[this.execution.callStack.length - 1];
    }

    getValue(token) {
        token = token.trim();
        const frame = this.getCurrentFrame();

        if (token.startsWith('"') && token.endsWith('"')) {
            return token.substring(1, token.length - 1);
        }

        if (token === "wahr") return true;
        if (token === "falsch") return false;

        if (frame && frame.variables[token] !== undefined) {
            return frame.variables[token];
        }

        const normalized = this.normalizeNumericString(token);
        const number = Number(normalized);

        if (!isNaN(number)) {
            return number;
        }

        return 0;
    }

    randomIntInclusive(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    evaluateExpression(expr) {
        expr = expr.trim();

        const randomExpression = this.parseRandomExpression(expr);
        if (randomExpression) {
            const minValue = this.evaluateExpression(randomExpression.min);
            const maxValue = this.evaluateExpression(randomExpression.max);

            if (!Number.isInteger(minValue) || !Number.isInteger(maxValue)) {
                throw new Error("ZufallGanzzahl erwartet zwei Ganzzahlen.");
            }

            if (minValue > maxValue) {
                throw new Error("Bei ZufallGanzzahl darf die untere Grenze nicht größer als die obere Grenze sein.");
            }

            return this.randomIntInclusive(minValue, maxValue);
        }

        const callExpression = this.parseCallExpression(expr);
        if (callExpression) {
            return this.executeReturningCallExpression(callExpression);
        }

        while (this.hasOuterParentheses(expr)) {
            expr = expr.substring(1, expr.length - 1).trim();
        }

        if (expr.startsWith('"') && expr.endsWith('"')) {
            return expr.substring(1, expr.length - 1);
        }

        if (expr === "wahr") return true;
        if (expr === "falsch") return false;

        let split = this.splitTopLevel(expr, ["+", "-"]);
        if (split) {
            const left = this.evaluateExpression(split.left);
            const right = this.evaluateExpression(split.right);

            if (split.operator === "+") {
                if (typeof left === "string" || typeof right === "string") {
                    return this.formatValue(left) + this.formatValue(right);
                }
                return left + right;
            }

            return left - right;
        }

        split = this.splitTopLevel(expr, ["*", "/"]);
        if (split) {
            const left = this.evaluateExpression(split.left);
            const right = this.evaluateExpression(split.right);

            if (split.operator === "*") {
                return left * right;
            }

            return left / right;
        }

        return this.getValue(expr);
    }

    evaluateComparison(condition) {
        const operators = ["<=", ">=", "!=", "==", ">", "<"];

        for (const operator of operators) {
            const split = this.splitTopLevel(condition, [operator]);

            if (split) {
                const left = this.evaluateExpression(split.left);
                const right = this.evaluateExpression(split.right);

                if (operator === "==") return left === right;
                if (operator === "!=") return left !== right;
                if (operator === ">") return left > right;
                if (operator === "<") return left < right;
                if (operator === ">=") return left >= right;
                if (operator === "<=") return left <= right;
            }
        }

        const value = this.evaluateExpression(condition);
        return value === true;
    }

    evaluateCondition(condition) {
        condition = condition.trim();

        while (this.hasOuterParentheses(condition)) {
            condition = condition.substring(1, condition.length - 1).trim();
        }

        if (condition.startsWith("nicht ")) {
            const rest = condition.substring("nicht ".length).trim();
            return !this.evaluateCondition(rest);
        }

        const orSplit = this.splitTopLevel(condition, [" oder "]);
        if (orSplit) {
            return this.evaluateCondition(orSplit.left) || this.evaluateCondition(orSplit.right);
        }

        const andSplit = this.splitTopLevel(condition, [" und "]);
        if (andSplit) {
            return this.evaluateCondition(andSplit.left) && this.evaluateCondition(andSplit.right);
        }

        return this.evaluateComparison(condition);
    }

    /* -------------------------------------------------------------
       Programm-/Blockaufbau
    ------------------------------------------------------------- */

    parseSubprogramLine(line) {
        const declarationTypes = ["Ganzzahl", "Kommazahl", "Text", "Wahrheitswert"];

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

        if (line.startsWith("Gib ") && line.endsWith(" zurück")) {
            const expression = line.substring(4, line.length - 7).trim();
            return {
                type: "return",
                expression
            };
        }

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

        if (line === "Ende Wiederhole") {
            return { type: "endrepeat" };
        }

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

        if (line.startsWith("Ausgabe ")) {
            const expression = line.substring("Ausgabe ".length).trim();
            return {
                type: "output",
                expression
            };
        }

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

        if (line === "Sonst") {
            return { type: "else" };
        }

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

        if (line === "Ende Wenn") {
            return { type: "endif" };
        }

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

        if (line === "Ende Solange") {
            return { type: "endwhile" };
        }

        if (line.startsWith("Rufe ") && line.includes(" mit ") && line.endsWith(" auf")) {
            const withoutPrefix = line.substring(5, line.length - 4).trim();
            const mitIndex = withoutPrefix.indexOf(" mit ");

            if (mitIndex !== -1) {
                const program = withoutPrefix.substring(0, mitIndex).trim();
                const argText = withoutPrefix.substring(mitIndex + 5).trim();

                return {
                    type: "call",
                    program,
                    args: this.splitArguments(argText)
                };
            }
        }

        if (line.startsWith("Rufe ") && line.endsWith(" auf")) {
            const program = line.substring(5, line.length - 4).trim();

            return {
                type: "call",
                program,
                args: []
            };
        }

        if (line.startsWith("vorwaerts(") && line.endsWith(")")) {
            return {
                type: "turtle_forward",
                expression: line.substring("vorwaerts(".length, line.length - 1).trim()
            };
        }

        if (line.startsWith("dreheLinks(") && line.endsWith(")")) {
            return {
                type: "turtle_left",
                expression: line.substring("dreheLinks(".length, line.length - 1).trim()
            };
        }

        if (line.startsWith("dreheRechts(") && line.endsWith(")")) {
            return {
                type: "turtle_right",
                expression: line.substring("dreheRechts(".length, line.length - 1).trim()
            };
        }

        if (line === "stiftHoch()") {
            return {
                type: "turtle_pen_up"
            };
        }

        if (line === "stiftRunter()") {
            return {
                type: "turtle_pen_down"
            };
        }

        if (line === "loescheZeichenflaeche()") {
            return {
                type: "turtle_clear"
            };
        }

        if (line.startsWith("geheZu(") && line.endsWith(")")) {
            const inner = line.substring("geheZu(".length, line.length - 1).trim();
            const args = this.splitArguments(inner);

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

    buildStructuredNodes(nodes, startIndex = 0, stopTypes = []) {
        const result = [];
        let index = startIndex;

        while (index < nodes.length) {
            const node = nodes[index];

            if (stopTypes.includes(node.type)) {
                break;
            }

            if (node.type === "if") {
                const builtIf = this.buildIfNode(nodes, index);
                result.push(builtIf.node);
                index = builtIf.nextIndex;
                continue;
            }

            if (node.type === "while") {
                const builtWhile = this.buildWhileNode(nodes, index);
                result.push(builtWhile.node);
                index = builtWhile.nextIndex;
                continue;
            }

            if (node.type === "repeat") {
                const builtRepeat = this.buildRepeatNode(nodes, index);
                result.push(builtRepeat.node);
                index = builtRepeat.nextIndex;
                continue;
            }

            if (
                node.type === "elseif" ||
                node.type === "else" ||
                node.type === "endif" ||
                node.type === "endwhile" ||
                node.type === "endrepeat"
            ) {
                break;
            }

            result.push(node);
            index++;
        }

        return {
            nodes: result,
            nextIndex: index
        };
    }

    buildIfNode(nodes, startIndex) {
        const base = nodes[startIndex];
        let index = startIndex + 1;

        const thenPart = this.buildStructuredNodes(nodes, index, ["elseif", "else", "endif"]);
        index = thenPart.nextIndex;

        const elseIfParts = [];

        while (index < nodes.length && nodes[index].type === "elseif") {
            const elseifNode = nodes[index];
            index++;

            const elseIfBody = this.buildStructuredNodes(nodes, index, ["elseif", "else", "endif"]);
            elseIfParts.push({
                condition: elseifNode.condition,
                conditionNode: elseifNode,
                nodes: elseIfBody.nodes
            });

            index = elseIfBody.nextIndex;
        }

        let elseNodes = [];
        let elseNode = null;

        if (index < nodes.length && nodes[index].type === "else") {
            elseNode = nodes[index];
            index++;

            const elsePart = this.buildStructuredNodes(nodes, index, ["endif"]);
            elseNodes = elsePart.nodes;
            index = elsePart.nextIndex;
        }

        if (index < nodes.length && nodes[index].type === "endif") {
            index++;
        }

        return {
            node: {
                type: "ifblock",
                lineNumber: base.lineNumber,
                condition: base.condition,
                conditionNode: base,
                thenNodes: thenPart.nodes,
                elseIfParts,
                elseNodes,
                elseNode
            },
            nextIndex: index
        };
    }

    buildWhileNode(nodes, startIndex) {
        const base = nodes[startIndex];
        let index = startIndex + 1;

        const body = this.buildStructuredNodes(nodes, index, ["endwhile"]);
        index = body.nextIndex;

        if (index < nodes.length && nodes[index].type === "endwhile") {
            index++;
        }

        return {
            node: {
                type: "whileblock",
                lineNumber: base.lineNumber,
                condition: base.condition,
                conditionNode: base,
                bodyNodes: body.nodes
            },
            nextIndex: index
        };
    }

    buildRepeatNode(nodes, startIndex) {
        const base = nodes[startIndex];
        let index = startIndex + 1;

        const body = this.buildStructuredNodes(nodes, index, ["endrepeat"]);
        index = body.nextIndex;

        if (index < nodes.length && nodes[index].type === "endrepeat") {
            index++;
        }

        return {
            node: {
                type: "repeatblock",
                lineNumber: base.lineNumber,
                count: base.count,
                countNode: base,
                bodyNodes: body.nodes
            },
            nextIndex: index
        };
    }

    /* -------------------------------------------------------------
       Ausführungsrahmen
    ------------------------------------------------------------- */

    createProgramFrame({ nodes, programId, programName, returnType = null, caller = null }) {
        return {
            kind: "program",
            programId,
            programName,
            returnType,
            caller,
            variables: {},
            variableTypes: {},
            controlStack: [
                {
                    kind: "block",
                    nodes,
                    index: 0
                }
            ],
            returnState: {
                returned: false,
                value: null
            }
        };
    }

    createChildBlockFrame(block, state = {}) {
        return {
            kind: block.kind,
            ...state,
            nodes: block.nodes || [],
            index: 0
        };
    }

    beginExecution(nodes, programId = "main") {
        const structured = this.buildStructuredNodes(nodes).nodes;

        this.mainContext = {
            variables: {},
            variableTypes: {}
        };

        this.execution = {
            callStack: [
                this.createProgramFrame({
                    nodes: structured,
                    programId,
                    programName: this.getProgramName(programId),
                    returnType: null,
                    caller: null
                })
            ],
            isFinished: false,
            lastEntry: null,
            pendingEntries: []
        };
    }

    hasPendingStep() {
        if (!this.execution) {
            return false;
        }

        const hasPendingEntries =
            Array.isArray(this.execution.pendingEntries) &&
            this.execution.pendingEntries.length > 0;

        return !this.execution.isFinished || hasPendingEntries;
    }

    currentProgramFrame() {
        if (!this.execution || this.execution.callStack.length === 0) {
            return null;
        }
        return this.execution.callStack[this.execution.callStack.length - 1];
    }

    currentControlFrame() {
        const programFrame = this.currentProgramFrame();
        if (!programFrame || programFrame.controlStack.length === 0) {
            return null;
        }
        return programFrame.controlStack[programFrame.controlStack.length - 1];
    }

    updateMainContextFromCurrentFrame() {
        const frame = this.currentProgramFrame();
        if (frame && this.isMainProgramId(frame.programId)) {
            this.mainContext = {
                variables: frame.variables,
                variableTypes: frame.variableTypes
            };
        }
    }

    finishCurrentProgramFrame() {
        const frame = this.currentProgramFrame();
        if (!frame) return null;

        const finishedFrame = this.execution.callStack.pop();

        if (this.execution.callStack.length === 0) {
            this.execution.isFinished = true;
            return finishedFrame;
        }

        const parent = this.currentProgramFrame();
        if (parent) {
            this.updateMainContextFromCurrentFrame();
        }

        return finishedFrame;
    }

    pushProgramFrame(frame) {
        this.execution.callStack.push(frame);
        this.updateMainContextFromCurrentFrame();
    }

    pushControlFrame(controlFrame) {
        const programFrame = this.currentProgramFrame();
        programFrame.controlStack.push(controlFrame);
    }

    popControlFrame() {
        const programFrame = this.currentProgramFrame();
        return programFrame.controlStack.pop();
    }

    readInput(node) {
        const rawInput = window.prompt(`Bitte ${node.varType} für ${node.variable} eingeben:`);

        if (rawInput === null) {
            throw new Error("Eingabe wurde abgebrochen.");
        }

        const parsed = this.parseInput(rawInput, node.varType);
        if (!parsed.ok) {
            throw new Error(parsed.message);
        }

        return parsed.value;
    }

    callSubprogram(callInfo, expectReturnValue, pendingAction = null) {
        if (!this.programs || !Array.isArray(this.programs.subprograms)) {
            throw new Error("Es sind keine Unterprogramme verfügbar.");
        }

        const subprogram = this.programs.subprograms.find(entry => entry.name === callInfo.program);

        if (!subprogram) {
            throw new Error(`Das Unterprogramm ${callInfo.program} existiert nicht.`);
        }

        const parameters = subprogram.parameters || [];
        const args = callInfo.args || [];

        if (args.length !== parameters.length) {
            throw new Error(`Das Unterprogramm ${callInfo.program} erwartet ${parameters.length} Übergabewerte, erhalten wurden aber ${args.length}.`);
        }

        const resolvedArgs = [];
        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            const argValue = this.evaluateExpression(args[i]);

            if (!this.isValueCompatible(parameter.type, argValue)) {
                throw new Error(`Der Übergabewert "${this.formatValue(argValue)}" passt nicht zum Parameter ${parameter.name} vom Typ ${parameter.type}.`);
            }

            resolvedArgs.push({
                parameter,
                value: argValue
            });
        }



        const lineEntries = subprogram.source
            .split("\n")
            .map((line, index) => ({ text: line.trim(), lineNumber: index + 1 }))
            .filter(entry => entry.text !== "" && !entry.text.startsWith("#"));

        const subNodes = lineEntries.map(entry => {
            const parsed = this.parseSubprogramLine(entry.text);
            parsed.lineNumber = entry.lineNumber;
            return parsed;
        });

        const structuredNodes = this.buildStructuredNodes(subNodes).nodes;

        const callerFrame = this.currentProgramFrame();

        const subFrame = this.createProgramFrame({
            nodes: structuredNodes,
            programId: subprogram.id,
            programName: subprogram.name,
            returnType: subprogram.returnType || null,
            caller: {
                programId: callerFrame.programId,
                expectReturnValue,
                node: this.currentControlFrame()?.currentNode || null,
                pendingAction
            }
        });

        for (const entry of resolvedArgs) {
            subFrame.variables[entry.parameter.name] = entry.value;
            subFrame.variableTypes[entry.parameter.name] = entry.parameter.type;
        }

        this.pushProgramFrame(subFrame);

        return {
            kind: "call_started",
            entry: this.createTraceEntry(
                "debug",
                this.currentProgramFrame().caller?.node || null,
                args.length > 0
                    ? `Das Unterprogramm ${callInfo.program} wird mit Übergabewerten aufgerufen.`
                    : `Das Unterprogramm ${callInfo.program} wird aufgerufen.`,
                callerFrame.programId
            )
        };
    }
    applyPendingReturnValue(callerFrame, callerInfo, returnValue) {
        const action = callerInfo?.pendingAction;
        if (!action) {
            return;
        }

        if (action.kind === "declaration") {
            if (!this.isValueCompatible(action.varType, returnValue)) {
                throw new Error(`Typfehler: Der Wert "${this.formatValue(returnValue)}" passt nicht zum Typ ${action.varType}.`);
            }

            callerFrame.variables[action.variable] = returnValue;
            callerFrame.variableTypes[action.variable] = action.varType;
            this.updateMainContextFromCurrentFrame();
            return;
        }

        if (action.kind === "assignment") {
            if (callerFrame.variableTypes[action.variable] === undefined) {
                throw new Error(`Fehler: Die Variable ${action.variable} wurde noch nicht angelegt.`);
            }

            const expectedType = callerFrame.variableTypes[action.variable];

            if (!this.isValueCompatible(expectedType, returnValue)) {
                throw new Error(`Typfehler: Der Wert "${this.formatValue(returnValue)}" passt nicht zum Typ ${expectedType}.`);
            }

            callerFrame.variables[action.variable] = returnValue;
            this.updateMainContextFromCurrentFrame();
        }
    }
    executeReturningCallExpression(callInfo) {
        if (!this.programs || !Array.isArray(this.programs.subprograms)) {
            throw new Error("Es sind keine Unterprogramme verfügbar.");
        }

        const subprogram = this.programs.subprograms.find(entry => entry.name === callInfo.program);

        if (!subprogram) {
            throw new Error(`Das Unterprogramm ${callInfo.program} existiert nicht.`);
        }

        if (!subprogram.returnType) {
            throw new Error(`Das Unterprogramm ${callInfo.program} hat keinen Rückgabewert.`);
        }

        const parameters = subprogram.parameters || [];
        const args = callInfo.args || [];

        if (args.length !== parameters.length) {
            throw new Error(`Das Unterprogramm ${callInfo.program} erwartet ${parameters.length} Übergabewerte, erhalten wurden aber ${args.length}.`);
        }

        const resolvedArgs = [];
        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            const argValue = this.evaluateExpression(args[i]);

            if (!this.isValueCompatible(parameter.type, argValue)) {
                throw new Error(`Der Übergabewert "${this.formatValue(argValue)}" passt nicht zum Parameter ${parameter.name} vom Typ ${parameter.type}.`);
            }

            resolvedArgs.push({
                parameter,
                value: argValue
            });
        }

        const lineEntries = subprogram.source
            .split("\n")
            .map((line, index) => ({ text: line.trim(), lineNumber: index + 1 }))
            .filter(entry => entry.text !== "" && !entry.text.startsWith("#"));

        const subNodes = lineEntries.map(entry => {
            const parsed = this.parseSubprogramLine(entry.text);
            parsed.lineNumber = entry.lineNumber;
            return parsed;
        });

        const structuredNodes = this.buildStructuredNodes(subNodes).nodes;

        const parentFrame = this.getCurrentFrame();
        if (!parentFrame) {
            throw new Error("Kein aktiver Programmkontext für den Unterprogrammaufruf vorhanden.");
        }

        const savedExecution = this.execution;
        const savedMainContext = this.mainContext;

        const tempFrame = this.createProgramFrame({
            nodes: structuredNodes,
            programId: subprogram.id,
            programName: subprogram.name,
            returnType: subprogram.returnType,
            caller: null
        });

        for (const entry of resolvedArgs) {
            tempFrame.variables[entry.parameter.name] = entry.value;
            tempFrame.variableTypes[entry.parameter.name] = entry.parameter.type;
        }

        this.execution = {
            callStack: [tempFrame],
            isFinished: false,
            lastEntry: null
        };

        try {
            while (this.hasPendingStep()) {
                this.step();
            }

            const result = tempFrame.returnState;

            if (!result.returned) {
                throw new Error(`Das Unterprogramm ${callInfo.program} hat keinen Wert zurückgegeben.`);
            }

            if (!this.isValueCompatible(subprogram.returnType, result.value)) {
                throw new Error(`Der Rückgabewert "${this.formatValue(result.value)}" passt nicht zum Rückgabetyp ${subprogram.returnType}.`);
            }

            return result.value;
        } finally {
            this.execution = savedExecution;
            this.mainContext = savedMainContext;
        }
    }
    /* -------------------------------------------------------------
       Einzelschritt-Ausführung
    ------------------------------------------------------------- */

    step() {
        if (!this.execution) {
            return null;
        }

        if (
            Array.isArray(this.execution.pendingEntries) &&
            this.execution.pendingEntries.length > 0
        ) {
            return this.execution.pendingEntries.shift();
        }

        if (this.execution.isFinished) {
            return null;
        }

        while (this.execution && !this.execution.isFinished) {
            const programFrame = this.currentProgramFrame();
            const controlFrame = this.currentControlFrame();

            if (!programFrame) {
                this.execution.isFinished = true;
                return null;
            }

            if (!controlFrame) {
                const finishedFrame = this.finishCurrentProgramFrame();

                if (finishedFrame && finishedFrame.caller) {
                    const callerFrame = this.currentProgramFrame();
                    if (!callerFrame) {
                        return null;
                    }

                    if (finishedFrame.caller.expectReturnValue) {
                        if (!finishedFrame.returnType) {
                            throw new Error(`Das Unterprogramm ${finishedFrame.programName} hat keinen Rückgabewert.`);
                        }

                        if (!finishedFrame.returnState.returned) {
                            throw new Error(`Das Unterprogramm ${finishedFrame.programName} hat keinen Wert zurückgegeben.`);
                        }

                        this.applyPendingReturnValue(
                            callerFrame,
                            finishedFrame.caller,
                            finishedFrame.returnState.value
                        );

                        const action = finishedFrame.caller.pendingAction;
                        let message = `Das Unterprogramm ${finishedFrame.programName} ist beendet.`;

                        if (action?.kind === "declaration") {
                            message += ` Der Variable ${action.variable} vom Typ ${action.varType} wird der Wert ${this.formatValue(finishedFrame.returnState.value)} zugewiesen.`;
                        } else if (action?.kind === "assignment") {
                            message += ` Der Variable ${action.variable} wird der Wert ${this.formatValue(finishedFrame.returnState.value)} zugewiesen.`;
                        }

                        return this.createTraceEntry(
                            "debug",
                            finishedFrame.caller.node,
                            message,
                            callerFrame.programId
                        );
                    }

                    return this.createTraceEntry(
                        "debug",
                        finishedFrame.caller.node,
                        `Das Unterprogramm ${finishedFrame.programName} ist beendet.`,
                        callerFrame.programId
                    );
                }

                if (this.execution.isFinished) {
                    return null;
                }

                continue;
            }

            if (controlFrame.kind === "block") {
                if (controlFrame.index >= controlFrame.nodes.length) {
                    this.popControlFrame();

                    if (programFrame.controlStack.length === 0) {
                        const finishedFrame = this.finishCurrentProgramFrame();

                        if (finishedFrame && finishedFrame.caller) {
                            const callerFrame = this.currentProgramFrame();
                            if (!callerFrame) {
                                return null;
                            }

                            if (finishedFrame.caller.expectReturnValue) {
                                if (!finishedFrame.returnType) {
                                    throw new Error(`Das Unterprogramm ${finishedFrame.programName} hat keinen Rückgabewert.`);
                                }

                                if (!finishedFrame.returnState.returned) {
                                    throw new Error(`Das Unterprogramm ${finishedFrame.programName} hat keinen Wert zurückgegeben.`);
                                }

                                this.applyPendingReturnValue(
                                    callerFrame,
                                    finishedFrame.caller,
                                    finishedFrame.returnState.value
                                );

                                const action = finishedFrame.caller.pendingAction;
                                let message = `Das Unterprogramm ${finishedFrame.programName} ist beendet.`;

                                if (action?.kind === "declaration") {
                                    message += ` Der Variable ${action.variable} vom Typ ${action.varType} wird der Wert ${this.formatValue(finishedFrame.returnState.value)} zugewiesen.`;
                                } else if (action?.kind === "assignment") {
                                    message += ` Der Variable ${action.variable} wird der Wert ${this.formatValue(finishedFrame.returnState.value)} zugewiesen.`;
                                }

                                return this.createTraceEntry(
                                    "debug",
                                    finishedFrame.caller.node,
                                    message,
                                    callerFrame.programId
                                );
                            }

                            return this.createTraceEntry(
                                "debug",
                                finishedFrame.caller.node,
                                `Das Unterprogramm ${finishedFrame.programName} ist beendet.`,
                                callerFrame.programId
                            );
                        }

                        if (this.execution.isFinished) {
                            return null;
                        }

                        continue;
                    }

                    continue;
                }

                const node = controlFrame.nodes[controlFrame.index];
                controlFrame.currentNode = node;

                if (node.type === "ifblock") {
                    let conditionResult;

                    try {
                        conditionResult = this.evaluateCondition(node.condition);
                    } catch (error) {
                        controlFrame.index++;
                        return this.createTraceEntry("error", node.conditionNode, this.withLine(node.conditionNode, error.message), programFrame.programId);
                    }

                    controlFrame.index++;

                    if (conditionResult) {
                        this.pushControlFrame(
                            this.createChildBlockFrame({
                                kind: "block",
                                nodes: node.thenNodes
                            })
                        );
                        return this.createTraceEntry(
                            "debug",
                            node.conditionNode,
                            `Die Bedingung "${node.condition}" ist wahr.`,
                            programFrame.programId
                        );
                    }

                    for (const elseIfPart of node.elseIfParts) {
                        let elseIfResult;
                        try {
                            elseIfResult = this.evaluateCondition(elseIfPart.condition);
                        } catch (error) {
                            return this.createTraceEntry(
                                "error",
                                elseIfPart.conditionNode,
                                this.withLine(elseIfPart.conditionNode, error.message),
                                programFrame.programId
                            );
                        }

                        if (elseIfResult) {
                            this.pushControlFrame(
                                this.createChildBlockFrame({
                                    kind: "block",
                                    nodes: elseIfPart.nodes
                                })
                            );
                            return this.createTraceEntry(
                                "debug",
                                elseIfPart.conditionNode,
                                `Die Sonst-Wenn-Bedingung "${elseIfPart.condition}" ist wahr.`,
                                programFrame.programId
                            );
                        }
                    }

                    if (node.elseNodes.length > 0) {
                        this.pushControlFrame(
                            this.createChildBlockFrame({
                                kind: "block",
                                nodes: node.elseNodes
                            })
                        );
                        return this.createTraceEntry(
                            "debug",
                            node.elseNode || node.conditionNode,
                            "Der Sonst-Zweig wird ausgeführt.",
                            programFrame.programId
                        );
                    }

                    return this.createTraceEntry(
                        "debug",
                        node.conditionNode,
                        `Die Bedingung "${node.condition}" ist falsch.`,
                        programFrame.programId
                    );
                }

                if (node.type === "whileblock") {
                    let conditionResult;

                    try {
                        conditionResult = this.evaluateCondition(node.condition);
                    } catch (error) {
                        controlFrame.index++;
                        return this.createTraceEntry("error", node.conditionNode, this.withLine(node.conditionNode, error.message), programFrame.programId);
                    }

                    if (!conditionResult) {
                        controlFrame.index++;
                        return this.createTraceEntry(
                            "debug",
                            node.conditionNode,
                            `Die Solange-Bedingung "${node.condition}" ist falsch.`,
                            programFrame.programId
                        );
                    }

                    const whileFrame = {
                        kind: "while",
                        node,
                        iterations: 0
                    };

                    controlFrame.index++;
                    this.pushControlFrame(whileFrame);

                    return this.createTraceEntry(
                        "debug",
                        node.conditionNode,
                        `Die Solange-Bedingung "${node.condition}" ist wahr.`,
                        programFrame.programId
                    );
                }

                if (node.type === "repeatblock") {
                    let countValue;

                    try {
                        countValue = this.evaluateExpression(node.count);
                    } catch (error) {
                        controlFrame.index++;
                        return this.createTraceEntry("error", node.countNode, this.withLine(node.countNode, error.message), programFrame.programId);
                    }

                    if (!Number.isInteger(countValue)) {
                        controlFrame.index++;
                        return this.createTraceEntry(
                            "error",
                            node.countNode,
                            this.withLine(node.countNode, `Typfehler: Die Anzahl bei Wiederhole muss eine Ganzzahl sein, war aber "${this.formatValue(countValue)}".`),
                            programFrame.programId
                        );
                    }

                    if (countValue < 0) {
                        controlFrame.index++;
                        return this.createTraceEntry(
                            "error",
                            node.countNode,
                            this.withLine(node.countNode, "Fehler: Die Anzahl bei Wiederhole darf nicht negativ sein."),
                            programFrame.programId
                        );
                    }

                    controlFrame.index++;

                    if (countValue === 0) {
                        return this.createTraceEntry(
                            "debug",
                            node.countNode,
                            "Die Wiederhole-Schleife startet mit 0 Durchläufen.",
                            programFrame.programId
                        );
                    }

                    this.pushControlFrame({
                        kind: "repeat",
                        node,
                        total: countValue,
                        current: 0
                    });

                    return this.createTraceEntry(
                        "debug",
                        node.countNode,
                        `Die Wiederhole-Schleife startet mit ${countValue} Durchläufen.`,
                        programFrame.programId
                    );
                }

                try {
                    const entry = this.executeSimpleNode(node, programFrame);
                    controlFrame.index++;
                    if (entry) return entry;
                } catch (error) {
                    controlFrame.index++;
                    return this.createTraceEntry("error", node, this.withLine(node, error.message), programFrame.programId);
                }

                continue;
            }

            if (controlFrame.kind === "while") {
                let conditionResult;

                try {
                    conditionResult = this.evaluateCondition(controlFrame.node.condition);
                } catch (error) {
                    this.popControlFrame();
                    return this.createTraceEntry("error", controlFrame.node.conditionNode, this.withLine(controlFrame.node.conditionNode, error.message), programFrame.programId);
                }

                if (!conditionResult) {
                    this.popControlFrame();
                    return this.createTraceEntry(
                        "debug",
                        controlFrame.node.conditionNode,
                        "Die Solange-Schleife wird beendet.",
                        programFrame.programId
                    );
                }

                controlFrame.iterations++;

                if (controlFrame.iterations > this.maxLoopIterations) {
                    this.popControlFrame();
                    return this.createTraceEntry(
                        "error",
                        controlFrame.node.conditionNode,
                        this.withLine(controlFrame.node.conditionNode, "Fehler: mögliche Endlosschleife"),
                        programFrame.programId
                    );
                }

                this.pushControlFrame(
                    this.createChildBlockFrame({
                        kind: "block",
                        nodes: controlFrame.node.bodyNodes
                    })
                );

                return this.createTraceEntry(
                    "debug",
                    controlFrame.node.conditionNode,
                    `Durchlauf ${controlFrame.iterations} der Solange-Schleife beginnt.`,
                    programFrame.programId
                );
            }

            if (controlFrame.kind === "repeat") {
                if (controlFrame.current >= controlFrame.total) {
                    this.popControlFrame();
                    return this.createTraceEntry(
                        "debug",
                        controlFrame.node.countNode,
                        "Die Wiederhole-Schleife ist beendet.",
                        programFrame.programId
                    );
                }

                controlFrame.current++;

                this.pushControlFrame(
                    this.createChildBlockFrame({
                        kind: "block",
                        nodes: controlFrame.node.bodyNodes
                    })
                );

                return this.createTraceEntry(
                    "debug",
                    controlFrame.node.countNode,
                    `Durchlauf ${controlFrame.current} von ${controlFrame.total} beginnt.`,
                    programFrame.programId
                );
            }
        }

        return null;
    }

    executeSimpleNode(node, programFrame) {


        if (node.type === "declaration") {
            const directCall = this.parseCallExpression(node.value);

            if (this.debug && directCall) {
                const result = this.callSubprogram(
                    directCall,
                    true,
                    {
                        kind: "declaration",
                        variable: node.variable,
                        varType: node.varType
                    }
                );

                return result.entry;
            }

            const value = this.evaluateExpression(node.value);

            if (!this.isValueCompatible(node.varType, value)) {
                throw new Error(`Typfehler: Der Wert "${this.formatValue(value)}" passt nicht zum Typ ${node.varType}.`);
            }

            programFrame.variables[node.variable] = value;
            programFrame.variableTypes[node.variable] = node.varType;
            this.updateMainContextFromCurrentFrame();

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Der Variable ${node.variable} vom Typ ${node.varType} wird der Wert ${this.formatValue(value)} zugewiesen.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "input") {
            const value = this.readInput(node);

            programFrame.variables[node.variable] = value;
            programFrame.variableTypes[node.variable] = node.varType;
            this.updateMainContextFromCurrentFrame();

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Für die Variable ${node.variable} wird der Wert ${this.formatValue(value)} eingelesen.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "assignment") {
            if (programFrame.variableTypes[node.variable] === undefined) {
                throw new Error(`Fehler: Die Variable ${node.variable} wurde noch nicht angelegt.`);
            }

            const directCall = this.parseCallExpression(node.value);

            if (this.debug && directCall) {
                const result = this.callSubprogram(
                    directCall,
                    true,
                    {
                        kind: "assignment",
                        variable: node.variable
                    }
                );

                return result.entry;
            }

            const value = this.evaluateExpression(node.value);
            const expectedType = programFrame.variableTypes[node.variable];

            if (!this.isValueCompatible(expectedType, value)) {
                throw new Error(`Typfehler: Der Wert "${this.formatValue(value)}" passt nicht zum Typ ${expectedType}.`);
            }

            programFrame.variables[node.variable] = value;
            this.updateMainContextFromCurrentFrame();

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Der Variable ${node.variable} wird der Wert ${this.formatValue(value)} zugewiesen.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "output") {
            const value = this.evaluateExpression(node.expression);
            const formattedValue = this.formatValue(value);

            if (this.debug) {
                if (!Array.isArray(this.execution.pendingEntries)) {
                    this.execution.pendingEntries = [];
                }

                this.execution.pendingEntries.push(
                    this.createTraceEntry(
                        "output",
                        node,
                        formattedValue,
                        programFrame.programId
                    )
                );

                return this.createTraceEntry(
                    "debug",
                    node,
                    `Es wird der Wert ${formattedValue} ausgegeben.`,
                    programFrame.programId
                );
            }

            return this.createTraceEntry(
                "output",
                node,
                formattedValue,
                programFrame.programId
            );
        }

        if (node.type === "return") {
            if (!programFrame.returnType) {
                throw new Error("Rückgabe ist nur in Unterprogrammen mit Rückgabetyp erlaubt.");
            }

            const value = this.evaluateExpression(node.expression);

            if (!this.isValueCompatible(programFrame.returnType, value)) {
                throw new Error(`Der Rückgabewert "${this.formatValue(value)}" passt nicht zum Rückgabetyp ${programFrame.returnType}.`);
            }

            programFrame.returnState = {
                returned: true,
                value
            };

            programFrame.controlStack = [];

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Das Unterprogramm gibt den Wert ${this.formatValue(value)} zurück.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "call") {
            const result = this.callSubprogram(
                {
                    program: node.program,
                    args: node.args || []
                },
                false
            );

            return result.entry;
        }

        if (node.type === "turtle_forward") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl vorwaerts(...) ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.forward) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            const distance = this.evaluateExpression(node.expression);

            if (typeof distance !== "number" || Number.isNaN(distance)) {
                throw new Error("vorwaerts(...) erwartet eine Zahl.");
            }

            this.turtleApi.forward(distance);

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Die Turtle bewegt sich um ${this.formatValue(distance)} Schritte vorwärts.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "turtle_left") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl dreheLinks(...) ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.turnLeft) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            const angle = this.evaluateExpression(node.expression);

            if (typeof angle !== "number" || Number.isNaN(angle)) {
                throw new Error("dreheLinks(...) erwartet eine Zahl.");
            }

            this.turtleApi.turnLeft(angle);

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Die Turtle dreht sich um ${this.formatValue(angle)} Grad nach links.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "turtle_right") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl dreheRechts(...) ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.turnRight) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            const angle = this.evaluateExpression(node.expression);

            if (typeof angle !== "number" || Number.isNaN(angle)) {
                throw new Error("dreheRechts(...) erwartet eine Zahl.");
            }

            this.turtleApi.turnRight(angle);

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Die Turtle dreht sich um ${this.formatValue(angle)} Grad nach rechts.`,
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "turtle_pen_up") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl stiftHoch() ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.penUp) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            this.turtleApi.penUp();

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    "Der Stift wird angehoben.",
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "turtle_pen_down") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl stiftRunter() ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.penDown) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            this.turtleApi.penDown();

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    "Der Stift wird abgesenkt.",
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "turtle_clear") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl loescheZeichenflaeche() ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.clear) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            this.turtleApi.clear();

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    "Die Zeichenfläche wird gelöscht.",
                    programFrame.programId
                )
                : null;
        }

        if (node.type === "turtle_move_to") {
            if (!this.isTurtleMode()) {
                throw new Error("Der Befehl geheZu(...) ist nur im Turtle-Modus erlaubt.");
            }

            if (!this.turtleApi?.moveTo) {
                throw new Error("Die Turtle-Umgebung ist nicht verfügbar.");
            }

            const x = this.evaluateExpression(node.xExpression);
            const y = this.evaluateExpression(node.yExpression);

            if (typeof x !== "number" || Number.isNaN(x) || typeof y !== "number" || Number.isNaN(y)) {
                throw new Error("geheZu(...) erwartet zwei Zahlen.");
            }

            this.turtleApi.moveTo(x, y);

            return this.debug
                ? this.createTraceEntry(
                    "debug",
                    node,
                    `Die Turtle bewegt sich zu (${this.formatValue(x)} | ${this.formatValue(y)}).`,
                    programFrame.programId
                )
                : null;
        }


        if (node.type === "error") {
            return this.createTraceEntry(
                "error",
                node,
                this.withLine(node, "Fehler: " + node.message),
                programFrame.programId
            );
        }

        if (node.type === "unknown") {
            return this.createTraceEntry(
                "error",
                node,
                this.withLine(node, `Unbekannte Zeile: ${node.content}`),
                programFrame.programId
            );
        }

        return null;
    }


    stopExecution() {
        if (!this.execution) {
            return;
        }

        this.execution.isFinished = true;
        this.execution.callStack = [];
        this.execution.lastEntry = null;

        if (Array.isArray(this.execution.pendingEntries)) {
            this.execution.pendingEntries.length = 0;
        }
    }


    /* -------------------------------------------------------------
       Öffentliche API --> neu
    ------------------------------------------------------------- */

    run(nodes, consoleDiv, programId = "main") {
        this.debug = false;
        this.beginExecution(nodes, programId);

        while (this.hasPendingStep()) {
            const entry = this.step();
            if (!entry) continue;

            if (entry.type === "output") {
                this.appendConsoleLine(consoleDiv, entry.text, "output");
            } else if (entry.type === "error") {
                this.appendConsoleLine(consoleDiv, entry.text, "error");
            }
        }

        return this.captureVariableState(programId);
    }

    beginDebug(nodes, programId = "main") {
        this.debug = true;
        this.beginExecution(nodes, programId);
    }

    stepDebug() {
        this.debug = true;
        return this.step();
    }

    appendConsoleLine(consoleDiv, text, kind) {
        const line = document.createElement("div");
        line.textContent = text;

        if (kind === "debug") {
            line.className = "console-debug";
        } else if (kind === "error") {
            line.className = "console-error";
        } else {
            line.className = "console-output";
        }

        consoleDiv.appendChild(line);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
}