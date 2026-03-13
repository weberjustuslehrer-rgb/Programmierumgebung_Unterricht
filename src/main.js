import { toPng } from "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm";
import { splitIntoLines } from "./language/tokenizer.js";
import { parseLine } from "./language/lineParser.js";
import { buildAST } from "./language/astBuilder.js";
import { Interpreter } from "./runtime/interpreter.js";
import { renderDiagram } from "./ui/diagram.js";
import { renderProgramList } from "./ui/programList.js";
import { renderVariableState, clearVariableState } from "./ui/variables.js";
import { generatePythonCode } from "./export/pythonExporter.js";
import { generatePascalCode } from "./export/pascalExporter.js";
import { generateJavaCode } from "./export/javaExporter.js";
import {
    initEditor,
    getEditorValue,
    setEditorValue,
    clearErrorLines,
    setErrorLines,
    clearActiveLine,
    setActiveLine
} from "./ui/editor.js";

initEditor();

const runButton = document.getElementById("runProgram");
const debugButton = document.getElementById("debugProgram");
const stepButton = document.getElementById("stepProgram");

const showDiagramButton = document.getElementById("showDiagram");
const exportDiagramButton = document.getElementById("exportDiagramPng");

const addSubprogramButton = document.getElementById("addProgram");
const renameProgramButton = document.getElementById("renameProgram");
const deleteProgramButton = document.getElementById("deleteProgram");

const fileMenuButton = document.getElementById("fileMenuButton");
const fileMenuDropdown = document.getElementById("fileMenuDropdown");
const helpMenuButton = document.getElementById("helpMenuButton");
const helpMenuDropdown = document.getElementById("helpMenuDropdown");
const languageMenuButton = document.getElementById("languageMenuButton");
const languageMenuDropdown = document.getElementById("languageMenuDropdown");

const newProjectButton = document.getElementById("newProject");
const saveProjectButton = document.getElementById("saveProject");
const loadProjectButton = document.getElementById("loadProject");
const openHelpButton = document.getElementById("openHelp");
const openPythonViewButton = document.getElementById("openPythonView");
const openPascalViewButton = document.getElementById("openPascalView");
const openJavaViewButton = document.getElementById("openJavaView");
const loadProjectInput = document.getElementById("loadProjectInput");

const clearConsoleButton = document.getElementById("clearConsole");

const consoleDiv = document.getElementById("consoleOutput");
const editorTitle = document.getElementById("editorTitle");
const subprogramMeta = document.getElementById("subprogramMeta");
const parameterInfo = document.getElementById("parameterInfo");
const returnInfo = document.getElementById("returnInfo");

const PROJECT_EXTENSION = ".wskript";
const PROJECT_FORMAT = "webskript-project";
const PROJECT_VERSION = 1;

const projectState = {
    currentProgramId: "main",
    mainSource: "",
    subprograms: []
};

let debugInterpreter = null;
let lastVariableState = null;
let isRunActive = false;

runButton.addEventListener("click", async () => {
    if (projectState.currentProgramId !== "main") return;
    if (isRunActive) return;

    saveCurrentEditorContent();

    const nodes = prepareProgramForCurrentContext();
    if (!nodes) return;

    debugInterpreter = null;
    clearActiveLine();
    consoleDiv.innerHTML = "";

    await yieldToBrowser();

    const interpreter = new Interpreter();
    interpreter.programs = projectState;

    isRunActive = true;
    updateExecutionButtons();

    try {
        interpreter.beginExecution(nodes, projectState.currentProgramId);
        await yieldToBrowser();

        while (interpreter.hasPendingStep()) {
            const entry = interpreter.step();

            if (entry) {
                if (entry.lineNumber) {
                    setActiveLine(entry.lineNumber);
                } else {
                    clearActiveLine();
                }

                if (entry.type === "output") {
                    appendConsoleLine(entry.text, "output");
                    await yieldToBrowser();
                } else if (entry.type === "error") {
                    appendConsoleLine(entry.text, "error");
                    await yieldToBrowser();
                }
            }
        }

        clearActiveLine();
        lastVariableState = interpreter.captureVariableState(projectState.currentProgramId);
        renderVariableState(lastVariableState);
    } catch (error) {
        appendConsoleLine(error.message, "error");
        clearActiveLine();
    } finally {
        isRunActive = false;
        updateExecutionButtons();
        scrollConsoleToBottom();
    }
});

debugButton.addEventListener("click", () => {
    if (projectState.currentProgramId !== "main") return;
    if (isRunActive) return;

    saveCurrentEditorContent();

    const nodes = prepareProgramForCurrentContext();
    if (!nodes) return;

    consoleDiv.innerHTML = "";
    clearActiveLine();

    debugInterpreter = new Interpreter({ debug: true });
    debugInterpreter.programs = projectState;
    debugInterpreter.beginDebug(nodes, projectState.currentProgramId);

    lastVariableState = null;
    clearVariableState("Debug-Modus vorbereitet. Mit „Schritt“ werden die Variablen sichtbar.");

    appendConsoleLine("Debug-Modus vorbereitet. Mit „Schritt“ wird der nächste Schritt ausgeführt.", "debug");
    updateExecutionButtons();
});

stepButton.addEventListener("click", () => {
    if (isRunActive) return;

    if (!debugInterpreter || !debugInterpreter.hasPendingStep()) {
        appendConsoleLine("Es ist kein Debug-Ablauf vorbereitet. Bitte zuerst „Debug“ klicken.", "error");
        clearActiveLine();
        updateExecutionButtons();
        return;
    }

    try {
        const entry = debugInterpreter.stepDebug();

        if (!entry) {
            appendConsoleLine("Debug-Ablauf beendet.", "debug");
            clearActiveLine();
            updateExecutionButtons();
            return;
        }

        if (entry.programId && entry.programId !== projectState.currentProgramId) {
            switchToProgram(entry.programId, false, true);
        }

        if (entry.lineNumber) {
            setActiveLine(entry.lineNumber);
        } else {
            clearActiveLine();
        }

        appendConsoleLine(entry.text, entry.type);

        if (entry.variableState) {
            lastVariableState = entry.variableState;
            renderVariableState(entry.variableState);
        }

        if (!debugInterpreter.hasPendingStep()) {
            appendConsoleLine("Debug-Ablauf beendet.", "debug");
        }
    } catch (error) {
        appendConsoleLine(error.message, "error");
        clearActiveLine();
        debugInterpreter = null;
    }

    updateExecutionButtons();
});

showDiagramButton.addEventListener("click", () => {
    saveCurrentEditorContent();
    openDiagramWindowForCurrentProgram();
});

if (exportDiagramButton) {
    exportDiagramButton.addEventListener("click", async () => {
        await exportCurrentDiagramAsPng();
    });
}

addSubprogramButton.addEventListener("click", () => {
    if (isRunActive) return;

    saveCurrentEditorContent();

    const name = window.prompt("Name des neuen Unterprogramms:");
    if (!name) return;

    const trimmed = name.trim();
    if (trimmed === "") return;

    if (trimmed.toLowerCase() === "hauptprogramm") {
        appendConsoleLine("Der Name „Hauptprogramm“ ist reserviert.", "error");
        return;
    }

    const alreadyExists = projectState.subprograms.some(
        subprogram => subprogram.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (alreadyExists) {
        appendConsoleLine(`Ein Unterprogramm mit dem Namen „${trimmed}“ existiert bereits.`, "error");
        return;
    }

    const parameterInput = window.prompt(
        "Parameter des Unterprogramms angeben.\nBeispiel: Text name, Ganzzahl alter\nLeer lassen für keine Parameter."
    );

    const parsedParameters = parseParameterDefinitions(parameterInput ?? "");
    if (!parsedParameters.ok) {
        appendConsoleLine(parsedParameters.message, "error");
        return;
    }

    const returnTypeInput = window.prompt(
        "Optionaler Rückgabetyp des Unterprogramms.\nMögliche Werte: Ganzzahl, Kommazahl, Text, Wahrheitswert\nLeer lassen für keinen Rückgabewert."
    );

    const parsedReturnType = parseReturnType(returnTypeInput ?? "");
    if (!parsedReturnType.ok) {
        appendConsoleLine(parsedReturnType.message, "error");
        return;
    }

    const newSubprogram = {
        id: "sub_" + Date.now(),
        name: trimmed,
        parameters: parsedParameters.parameters,
        returnType: parsedReturnType.returnType,
        source: ""
    };

    projectState.subprograms.push(newSubprogram);
    projectState.currentProgramId = newSubprogram.id;

    debugInterpreter = null;
    lastVariableState = null;

    clearActiveLine();
    consoleDiv.innerHTML = "";
    clearVariableState();

    renderAll();
});

renameProgramButton.addEventListener("click", () => {
    if (isRunActive) return;

    saveCurrentEditorContent();

    if (projectState.currentProgramId === "main") {
        appendConsoleLine("Das Hauptprogramm kann nicht umbenannt werden.", "error");
        return;
    }

    const currentSubprogram = getCurrentSubprogram();
    if (!currentSubprogram) return;

    const oldName = currentSubprogram.name;

    const newNameInput = window.prompt("Neuer Name des Unterprogramms:", oldName);
    if (!newNameInput) return;

    const newName = newNameInput.trim();
    if (newName === "") return;

    if (newName.toLowerCase() === "hauptprogramm") {
        appendConsoleLine("Der Name „Hauptprogramm“ ist reserviert.", "error");
        return;
    }

    const alreadyExists = projectState.subprograms.some(
        subprogram =>
            subprogram.id !== currentSubprogram.id &&
            subprogram.name.toLowerCase() === newName.toLowerCase()
    );

    if (alreadyExists) {
        appendConsoleLine(`Ein Unterprogramm mit dem Namen „${newName}“ existiert bereits.`, "error");
        return;
    }

    const parameterInput = window.prompt(
        "Parameter des Unterprogramms anpassen.\nBeispiel: Text name, Ganzzahl alter\nLeer lassen für keine Parameter.",
        currentSubprogram.parameters.map(param => `${param.type} ${param.name}`).join(", ")
    );

    if (parameterInput === null) {
        return;
    }

    const parsedParameters = parseParameterDefinitions(parameterInput);
    if (!parsedParameters.ok) {
        appendConsoleLine(parsedParameters.message, "error");
        return;
    }

    const returnTypeInput = window.prompt(
        "Optionalen Rückgabetyp anpassen.\nMögliche Werte: Ganzzahl, Kommazahl, Text, Wahrheitswert\nLeer lassen für keinen Rückgabewert.",
        currentSubprogram.returnType || ""
    );

    if (returnTypeInput === null) {
        return;
    }

    const parsedReturnType = parseReturnType(returnTypeInput);
    if (!parsedReturnType.ok) {
        appendConsoleLine(parsedReturnType.message, "error");
        return;
    }

    currentSubprogram.name = newName;
    currentSubprogram.parameters = parsedParameters.parameters;
    currentSubprogram.returnType = parsedReturnType.returnType;

    renameCallsEverywhere(oldName, newName);

    renderAll();
    appendConsoleLine(`Unterprogramm „${oldName}“ wurde in „${newName}“ umbenannt.`, "debug");
});

deleteProgramButton.addEventListener("click", () => {
    if (isRunActive) return;

    saveCurrentEditorContent();

    if (projectState.currentProgramId === "main") {
        appendConsoleLine("Das Hauptprogramm kann nicht gelöscht werden.", "error");
        return;
    }

    const currentSubprogram = getCurrentSubprogram();
    if (!currentSubprogram) return;

    const confirmed = window.confirm(`Unterprogramm „${currentSubprogram.name}“ wirklich löschen?`);
    if (!confirmed) return;

    const deletedName = currentSubprogram.name;
    const deletedId = currentSubprogram.id;

    projectState.subprograms = projectState.subprograms.filter(
        subprogram => subprogram.id !== deletedId
    );

    removeCallsEverywhere(deletedName);

    projectState.currentProgramId = "main";
    debugInterpreter = null;
    lastVariableState = null;

    clearActiveLine();
    clearErrorLines();

    renderAll();
    appendConsoleLine(`Unterprogramm „${deletedName}“ wurde gelöscht. Aufrufe wurden markiert.`, "debug");
});

newProjectButton.addEventListener("click", () => {
    if (isRunActive) return;

    closeAllMenus();

    const confirmed = window.confirm(
        "Soll wirklich ein neues Projekt erstellt werden?\n\nAlle nicht gespeicherten Änderungen gehen verloren."
    );

    if (!confirmed) return;

    projectState.currentProgramId = "main";
    projectState.mainSource = "";
    projectState.subprograms = [];

    debugInterpreter = null;
    lastVariableState = null;

    clearActiveLine();
    clearErrorLines();
    consoleDiv.innerHTML = "";
    clearVariableState("Noch keine Variablen vorhanden. Nutze Run oder Debug.");

    renderAll();
    appendConsoleLine("Neues Projekt erstellt.", "debug");
});

saveProjectButton.addEventListener("click", () => {
    if (isRunActive) return;

    closeAllMenus();
    saveCurrentEditorContent();

    const exportData = {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        mainSource: projectState.mainSource,
        subprograms: projectState.subprograms.map(subprogram => ({
            id: subprogram.id,
            name: subprogram.name,
            parameters: Array.isArray(subprogram.parameters) ? subprogram.parameters : [],
            returnType: subprogram.returnType ?? null,
            source: subprogram.source ?? ""
        }))
    };

    const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = createSafeFilename(getSuggestedProjectName());

    link.href = url;
    link.download = `${safeName}${PROJECT_EXTENSION}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    appendConsoleLine(`Projekt wurde als ${PROJECT_EXTENSION}-Datei gespeichert.`, "debug");
});

loadProjectButton.addEventListener("click", () => {
    if (isRunActive) return;

    closeAllMenus();
    loadProjectInput.value = "";
    loadProjectInput.click();
});

openHelpButton.addEventListener("click", () => {
    closeAllMenus();
    openHelpWindow();
});

openPythonViewButton.addEventListener("click", () => {
    closeAllMenus();
    saveCurrentEditorContent();

    const pythonCode = generatePythonCode(projectState);
    openCodeWindow(
        "Python-Übersetzung",
        "Automatisch erzeugte, kopierbare Python-Version des aktuellen WebSkript-Projekts.",
        pythonCode,
        "Python-Code wurde in die Zwischenablage kopiert."
    );
});

openPascalViewButton.addEventListener("click", () => {
    closeAllMenus();
    saveCurrentEditorContent();

    const pascalCode = generatePascalCode(projectState);
    openCodeWindow(
        "Pascal-Übersetzung",
        "Automatisch erzeugte, kopierbare Pascal-Version des aktuellen WebSkript-Projekts.",
        pascalCode,
        "Pascal-Code wurde in die Zwischenablage kopiert."
    );
});

openJavaViewButton.addEventListener("click", () => {
    closeAllMenus();
    saveCurrentEditorContent();

    const javaCode = generateJavaCode(projectState);
    openCodeWindow(
        "Java-Übersetzung",
        "Automatisch erzeugte, kopierbare Java-Version des aktuellen WebSkript-Projekts.",
        javaCode,
        "Java-Code wurde in die Zwischenablage kopiert."
    );
});

loadProjectInput.addEventListener("change", async (event) => {
    if (isRunActive) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(PROJECT_EXTENSION)) {
        appendConsoleLine(`Ungültiger Dateityp. Bitte eine ${PROJECT_EXTENSION}-Datei auswählen.`, "error");
        return;
    }

    try {
        const text = await file.text();
        const rawData = JSON.parse(text);
        const importedProject = normalizeImportedProject(rawData);

        if (!importedProject.ok) {
            appendConsoleLine(importedProject.message, "error");
            return;
        }

        applyImportedProject(importedProject.project);
        appendConsoleLine(`Projekt „${file.name}“ wurde geöffnet.`, "debug");
    } catch (error) {
        appendConsoleLine(`Projekt konnte nicht geöffnet werden: ${error.message}`, "error");
    }
});

clearConsoleButton.addEventListener("click", () => {
    if (isRunActive) return;
    consoleDiv.innerHTML = "";
});

fileMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = fileMenuDropdown.classList.contains("hidden");
    closeAllMenus();
    if (willOpen) {
        fileMenuDropdown.classList.remove("hidden");
    }
});

helpMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = helpMenuDropdown.classList.contains("hidden");
    closeAllMenus();
    if (willOpen) {
        helpMenuDropdown.classList.remove("hidden");
    }
});

languageMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = languageMenuDropdown.classList.contains("hidden");
    closeAllMenus();
    if (willOpen) {
        languageMenuDropdown.classList.remove("hidden");
    }
});

document.addEventListener("click", () => {
    closeAllMenus();
});

document.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
        closeAllMenus();
        return;
    }

    const exportShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "e";
    if (exportShortcut) {
        event.preventDefault();
        await exportCurrentDiagramAsPng();
    }
});

async function exportCurrentDiagramAsPng() {
    if (isRunActive) return;

    try {
        saveCurrentEditorContent();

        const { nodes, ast } = buildCurrentAst();

        const errorLines = [];
        nodes.forEach(node => {
            if (node.type === "error" || node.type === "unknown") {
                errorLines.push(node.lineNumber);
            }
        });

        clearErrorLines();
        if (errorLines.length > 0) {
            setErrorLines(errorLines);
        }

        const exportHost = document.createElement("div");
        exportHost.style.position = "fixed";
        exportHost.style.left = "-100000px";
        exportHost.style.top = "0";
        exportHost.style.zIndex = "-1";
        exportHost.style.pointerEvents = "none";
        exportHost.style.background = "#ffffff";
        exportHost.style.padding = "0";
        exportHost.style.margin = "0";

        const exportWrapper = document.createElement("div");
        exportWrapper.style.background = "#ffffff";
        exportWrapper.style.padding = "32px";
        exportWrapper.style.display = "inline-block";
        exportWrapper.style.fontFamily = "sans-serif";
        exportWrapper.style.color = "#1f2937";

        const title = document.createElement("div");
        title.textContent = `Struktogramm – ${getCurrentProgramLabel()}`;
        title.style.fontSize = "24px";
        title.style.fontWeight = "700";
        title.style.marginBottom = "20px";
        title.style.color = "#111827";

        const diagramCanvas = document.createElement("div");
        diagramCanvas.id = "diagramCanvas";
        diagramCanvas.style.display = "inline-block";
        diagramCanvas.style.background = "#ffffff";

        exportWrapper.appendChild(title);
        exportWrapper.appendChild(diagramCanvas);
        exportHost.appendChild(exportWrapper);
        document.body.appendChild(exportHost);

        try {
            renderDiagram(ast);

            await yieldToBrowser();
            await yieldToBrowser();

            const width = Math.ceil(exportWrapper.scrollWidth);
            const height = Math.ceil(exportWrapper.scrollHeight);

            const dataUrl = await toPng(exportWrapper, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: "#ffffff",
                width,
                height,
                style: {
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundColor: "#ffffff"
                }
            });

            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `${createSafeFilename(getCurrentProgramLabel())}-struktogramm.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            appendConsoleLine("Struktogramm wurde als PNG exportiert.", "debug");
        } finally {
            exportHost.remove();
        }
    } catch (error) {
        appendConsoleLine(`PNG-Export fehlgeschlagen: ${error.message}`, "error");
    }
}

function closeAllMenus() {
    fileMenuDropdown.classList.add("hidden");
    helpMenuDropdown.classList.add("hidden");
    languageMenuDropdown.classList.add("hidden");
}

function openHelpWindow() {
    const popup = window.open("", "_blank", "width=980,height=760");

    if (!popup) {
        appendConsoleLine("Das Hilfe-Fenster konnte nicht geöffnet werden.", "error");
        return;
    }

    popup.document.write(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>WebSkript Hilfe</title>
    <style>
        body { margin: 0; font-family: sans-serif; background: #eef2f7; color: #1f2937; }
        .helpWindow { height: 100vh; display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; gap: 14px; }
        .helpCard { background: white; border: 1px solid #d8e0ea; border-radius: 14px; box-shadow: 0 6px 18px rgba(31, 41, 55, 0.06); padding: 14px; box-sizing: border-box; }
        .helpHeader { flex-shrink: 0; }
        .helpHeader h1 { margin: 0 0 6px 0; font-size: 24px; }
        .helpHeader p { margin: 0; color: #556274; }
        .helpTabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .helpTabButton { appearance: none; border: 1px solid #cfd8e3; background: #eef3f8; color: #223043; border-radius: 10px; padding: 8px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .helpTabButton.active { background: #dceaff; border-color: #bcd5ff; color: #0f3f83; }
        .helpContent { flex: 1; min-height: 0; overflow: auto; }
        .helpPanel { display: none; }
        .helpPanel.active { display: block; }
        h2 { margin-top: 0; }
        h3 { margin-bottom: 8px; }
        p, li { line-height: 1.45; }
        code, pre { font-family: monospace; }
        pre { background: #f5f7fb; border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; overflow: auto; white-space: pre-wrap; }
        .helpFooter { display: flex; justify-content: flex-end; flex-shrink: 0; }
        .closeButton { appearance: none; border: 1px solid #d3dbe6; background: #eef2f6; color: #223043; border-radius: 10px; padding: 9px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
    </style>
</head>
<body>
    <div class="helpWindow">
        <div class="helpHeader helpCard">
            <h1>WebSkript Hilfe</h1>
            <p>Kurzübersicht zur Sprache und zur Arbeit mit dem Editor.</p>
        </div>

        <div class="helpTabs helpCard">
            <button class="helpTabButton active" data-tab="syntax">Syntax</button>
            <button class="helpTabButton" data-tab="subprograms">Unterprogramme</button>
            <button class="helpTabButton" data-tab="tips">Tipps</button>
            <button class="helpTabButton" data-tab="examples">Beispiele</button>
        </div>

        <div class="helpContent helpCard">
            <div class="helpPanel active" data-panel="syntax">
                <h2>Syntaxübersicht</h2>
                <h3>Variablen anlegen</h3>
                <pre>Ganzzahl a = 5
Kommazahl x = 3,5
Text name = "Steve Jobs"
Wahrheitswert fertig = wahr</pre>

                <h3>Ausgabe</h3>
                <pre>Ausgabe "Hallo"
Ausgabe name
Ausgabe 5 + 3</pre>

                <h3>Eingabe</h3>
                <pre>Eingabe Text name
Eingabe Ganzzahl punkte</pre>

                <h3>Zufall</h3>
                <pre>Ganzzahl wurf = ZufallGanzzahl(1, 6)
Ausgabe wurf</pre>

                <h3>Bedingungen</h3>
                <pre>Wenn punkte >= 5 Dann
    Ausgabe "Bestanden"
Sonst
    Ausgabe "Nicht bestanden"
Ende Wenn</pre>

                <h3>Schleifen</h3>
                <pre>Solange x < 10 gilt
    x = x + 1
Ende Solange

Wiederhole 3 Mal
    Ausgabe "Hallo"
Ende Wiederhole</pre>
            </div>

            <div class="helpPanel" data-panel="subprograms">
                <h2>Unterprogramme</h2>
                <h3>Ohne Rückgabewert</h3>
                <p>Ein Unterprogramm ohne Rückgabewert wird als eigene Anweisung aufgerufen.</p>
                <pre>Rufe Begruessung auf
Rufe ZeigeName mit name auf</pre>

                <h3>Mit Rückgabewert</h3>
                <p>Ein Unterprogramm mit Rückgabewert wird in einem Ausdruck verwendet.</p>
                <pre>Ganzzahl summe = Rufe Addiere mit a, b auf
Text text = Rufe ErzeugeText mit name auf</pre>

                <h3>Rückgabe im Unterprogramm</h3>
                <pre>Gib a + b zurück</pre>
            </div>

            <div class="helpPanel" data-panel="tips">
                <h2>Tipps und Hinweise</h2>
                <ul>
                    <li>Texte müssen in Anführungszeichen stehen.</li>
                    <li>Dezimalzahlen werden mit Komma geschrieben.</li>
                    <li>Mehrere Ausgaben hintereinander sind oft klarer als sehr lange verkettete Texte.</li>
                    <li>Unterprogramme ohne Rückgabewert werden mit <code>Rufe ... auf</code> verwendet.</li>
                    <li>Unterprogramme mit Rückgabewert stehen rechts von einem <code>=</code> oder in einem Ausdruck.</li>
                    <li><code>ZufallGanzzahl(min, max)</code> liefert eine Ganzzahl inklusive beider Grenzen.</li>
                    <li>PNG-Export des Struktogramms: <code>Strg/Cmd + Shift + E</code></li>
                </ul>
            </div>

            <div class="helpPanel" data-panel="examples">
                <h2>Beispielprogramme</h2>
                <pre>Ganzzahl wurf = ZufallGanzzahl(1, 6)
Ausgabe "Der Würfel zeigt:"
Ausgabe wurf</pre>
            </div>
        </div>

        <div class="helpFooter">
            <button class="closeButton" onclick="window.close()">Fenster schließen</button>
        </div>
    </div>

    <script>
        const buttons = document.querySelectorAll(".helpTabButton");
        const panels = document.querySelectorAll(".helpPanel");
        buttons.forEach(button => {
            button.addEventListener("click", () => {
                const tab = button.dataset.tab;
                buttons.forEach(btn => btn.classList.remove("active"));
                panels.forEach(panel => panel.classList.remove("active"));
                button.classList.add("active");
                document.querySelector('[data-panel="' + tab + '"]').classList.add("active");
            });
        });
    </script>
</body>
</html>
    `);

    popup.document.close();
}

function openCodeWindow(title, subtitle, code, copyMessage) {
    const popup = window.open("", "_blank", "width=1100,height=800");

    if (!popup) {
        appendConsoleLine(`Das Fenster „${title}“ konnte nicht geöffnet werden.`, "error");
        return;
    }

    popup.document.write(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
        body { margin: 0; font-family: sans-serif; background: #eef2f7; color: #1f2937; }
        .window { height: 100vh; display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; gap: 14px; }
        .card { background: white; border: 1px solid #d8e0ea; border-radius: 14px; box-shadow: 0 6px 18px rgba(31, 41, 55, 0.06); padding: 14px; box-sizing: border-box; }
        .header h1 { margin: 0 0 6px 0; font-size: 24px; }
        .header p { margin: 0; color: #556274; }
        .toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
        .toolbar button { appearance: none; border: 1px solid #d3dbe6; background: #eef2f6; color: #223043; border-radius: 10px; padding: 9px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .toolbar button:hover { background: #e7edf5; }
        .content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        pre { flex: 1; min-height: 0; margin: 0; overflow: auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 16px; box-sizing: border-box; font: 14px/1.45 monospace; white-space: pre; }
    </style>
</head>
<body>
    <div class="window">
        <div class="card header">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
        </div>

        <div class="card toolbar">
            <button id="copyCode">Code kopieren</button>
            <button onclick="window.close()">Fenster schließen</button>
        </div>

        <div class="card content">
            <pre id="codeBlock"></pre>
        </div>
    </div>

    <script>
        const code = ${JSON.stringify(code)};
        document.getElementById("codeBlock").textContent = code;

        document.getElementById("copyCode").addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(code);
                alert(${JSON.stringify(copyMessage)});
            } catch (error) {
                alert("Kopieren ist fehlgeschlagen.");
            }
        });
    </script>
</body>
</html>
    `);

    popup.document.close();
}

function parseParameterDefinitions(text) {
    const trimmed = text.trim();

    if (trimmed === "") {
        return {
            ok: true,
            parameters: []
        };
    }

    const parts = trimmed.split(",");
    const parameters = [];

    for (const rawPart of parts) {
        const part = rawPart.trim();
        const match = part.match(/^(Ganzzahl|Kommazahl|Text|Wahrheitswert)\s+([A-Za-z_][A-Za-z0-9_]*)$/);

        if (!match) {
            return {
                ok: false,
                message: `Ungültige Parameterdefinition: ${part}`
            };
        }

        parameters.push({
            type: match[1],
            name: match[2]
        });
    }

    return {
        ok: true,
        parameters
    };
}

function parseReturnType(text) {
    const trimmed = text.trim();

    if (trimmed === "") {
        return {
            ok: true,
            returnType: null
        };
    }

    const allowed = ["Ganzzahl", "Kommazahl", "Text", "Wahrheitswert"];

    if (!allowed.includes(trimmed)) {
        return {
            ok: false,
            message: `Ungültiger Rückgabetyp: ${trimmed}`
        };
    }

    return {
        ok: true,
        returnType: trimmed
    };
}

function renderAll() {
    renderProgramList(projectState, switchToProgram);
    updateEditorTitle();
    updateEditorMeta();
    updateExecutionButtons();
    loadCurrentEditorContent();
}

function switchToProgram(programId, resetConsole = true, preserveEditorState = false) {
    saveCurrentEditorContent();

    projectState.currentProgramId = programId;

    clearActiveLine();
    clearErrorLines();

    if (resetConsole) {
        debugInterpreter = null;
        consoleDiv.innerHTML = "";
        lastVariableState = null;
        clearVariableState("Noch keine Variablen vorhanden. Nutze Run oder Debug.");
    }

    renderAll();

    if (!preserveEditorState) {
        clearActiveLine();
    }
}

function updateExecutionButtons() {
    const isMainProgram = projectState.currentProgramId === "main";
    const hasPreparedDebug = !!debugInterpreter && debugInterpreter.hasPendingStep();

    runButton.disabled = !isMainProgram || isRunActive;
    debugButton.disabled = !isMainProgram || isRunActive;
    stepButton.disabled = !hasPreparedDebug || isRunActive;
}

function updateEditorTitle() {
    if (projectState.currentProgramId === "main") {
        editorTitle.textContent = "Hauptprogramm";
        return;
    }

    const currentSubprogram = getCurrentSubprogram();
    editorTitle.textContent = currentSubprogram ? currentSubprogram.name : "Unterprogramm";
}

function updateEditorMeta() {
    if (projectState.currentProgramId === "main") {
        subprogramMeta.classList.add("hidden");
        parameterInfo.textContent = "";
        returnInfo.textContent = "";
        return;
    }

    const currentSubprogram = getCurrentSubprogram();
    if (!currentSubprogram) {
        subprogramMeta.classList.add("hidden");
        return;
    }

    const parameterText =
        currentSubprogram.parameters && currentSubprogram.parameters.length > 0
            ? currentSubprogram.parameters.map(param => `${param.type} ${param.name}`).join(", ")
            : "keine";

    const returnText = currentSubprogram.returnType
        ? `Rückgabewert vom Typ: ${currentSubprogram.returnType}`
        : "Rückgabewert: keiner";

    parameterInfo.textContent = `Übergabewerte: ${parameterText}`;
    returnInfo.textContent = returnText;
    subprogramMeta.classList.remove("hidden");
}

function loadCurrentEditorContent() {
    if (projectState.currentProgramId === "main") {
        setEditorValue(projectState.mainSource);
        return;
    }

    const currentSubprogram = getCurrentSubprogram();
    setEditorValue(currentSubprogram ? currentSubprogram.source : "");
}

function saveCurrentEditorContent() {
    const value = getEditorValue();

    if (projectState.currentProgramId === "main") {
        projectState.mainSource = value;
        return;
    }

    const currentSubprogram = getCurrentSubprogram();
    if (currentSubprogram) {
        currentSubprogram.source = value;
    }
}

function getCurrentSubprogram() {
    return projectState.subprograms.find(
        subprogram => subprogram.id === projectState.currentProgramId
    );
}

function getCurrentSource() {
    if (projectState.currentProgramId === "main") {
        return projectState.mainSource;
    }

    const currentSubprogram = getCurrentSubprogram();
    return currentSubprogram ? currentSubprogram.source : "";
}

function buildCurrentAst() {
    const source = getCurrentSource();
    const lineEntries = splitIntoLines(source);

    const nodes = lineEntries.map(entry => {
        const parsed = parseLine(entry.text);
        parsed.lineNumber = entry.lineNumber;
        parsed.programId = projectState.currentProgramId;
        return parsed;
    });

    const ast = buildAST(nodes);
    return { nodes, ast };
}

function openDiagramWindowForCurrentProgram() {
    const { nodes, ast } = buildCurrentAst();

    const errorLines = [];
    nodes.forEach(node => {
        if (node.type === "error" || node.type === "unknown") {
            errorLines.push(node.lineNumber);
        }
    });

    clearErrorLines();
    if (errorLines.length > 0) {
        setErrorLines(errorLines);
    }

    const popup = window.open("", "_blank", "width=1000,height=750");

    if (!popup) {
        appendConsoleLine("Das Struktogramm-Fenster konnte nicht geöffnet werden.", "error");
        return;
    }

    const tempContainer = document.createElement("div");
    tempContainer.style.position = "fixed";
    tempContainer.style.left = "-99999px";
    tempContainer.style.top = "-99999px";
    tempContainer.style.width = "1200px";
    tempContainer.id = "diagramCanvas";
    document.body.appendChild(tempContainer);

    try {
        renderDiagram(ast);
        const diagramHtml = tempContainer.innerHTML;

        popup.document.write(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Struktogramm</title>
    <link rel="stylesheet" href="./src/styles/layout.css">
</head>
<body class="diagram-popup">
    <div class="diagram-window">
        <h2>Struktogramm – ${escapeHtml(getCurrentProgramLabel())}</h2>
        <div id="diagramPopupContent">${diagramHtml}</div>
        <div style="margin-top: 14px;">
            <button onclick="window.close()" class="ui-button ui-button-neutral">Fenster schließen</button>
        </div>
    </div>
</body>
</html>
        `);
        popup.document.close();
    } finally {
        tempContainer.remove();
    }
}

function getCurrentProgramLabel() {
    if (projectState.currentProgramId === "main") {
        return "Hauptprogramm";
    }
    const currentSubprogram = getCurrentSubprogram();
    return currentSubprogram ? currentSubprogram.name : "Unterprogramm";
}

function prepareProgramForCurrentContext() {
    const source = getCurrentSource();

    clearErrorLines();
    clearActiveLine();

    const lineEntries = splitIntoLines(source);

    const nodes = lineEntries.map(entry => {
        const parsed = parseLine(entry.text);
        parsed.lineNumber = entry.lineNumber;
        parsed.programId = projectState.currentProgramId;
        return parsed;
    });

    const errorLines = [];

    nodes.forEach(node => {
        if (node.type === "error" || node.type === "unknown") {
            errorLines.push(node.lineNumber);
        }
    });

    if (errorLines.length > 0) {
        setErrorLines(errorLines);
    }

    return nodes;
}

function renameCallsEverywhere(oldName, newName) {
    projectState.mainSource = renameCallsInSource(projectState.mainSource, oldName, newName);

    projectState.subprograms.forEach(subprogram => {
        subprogram.source = renameCallsInSource(subprogram.source, oldName, newName);
    });
}

function renameCallsInSource(source, oldName, newName) {
    const lines = source.split("\n");

    return lines.map(line => {
        const trimmed = line.trim();

        if (trimmed === `Rufe ${oldName} auf`) {
            return line.replace(`Rufe ${oldName} auf`, `Rufe ${newName} auf`);
        }

        if (trimmed.startsWith(`Rufe ${oldName} mit `) && trimmed.endsWith(" auf")) {
            return line.replace(`Rufe ${oldName} mit `, `Rufe ${newName} mit `);
        }

        return line;
    }).join("\n");
}

function removeCallsEverywhere(deletedName) {
    projectState.mainSource = removeCallsInSource(projectState.mainSource, deletedName);

    projectState.subprograms.forEach(subprogram => {
        subprogram.source = removeCallsInSource(subprogram.source, deletedName);
    });
}

function removeCallsInSource(source, deletedName) {
    const lines = source.split("\n");

    return lines.map(line => {
        const trimmed = line.trim();

        if (
            trimmed === `Rufe ${deletedName} auf` ||
            (trimmed.startsWith(`Rufe ${deletedName} mit `) && trimmed.endsWith(" auf"))
        ) {
            return `# GELÖSCHTER AUFRUF: ${trimmed}`;
        }

        return line;
    }).join("\n");
}

function createSafeFilename(name) {
    const trimmed = String(name || "webskript-projekt").trim();

    return trimmed
        .toLowerCase()
        .replaceAll(/[^\p{L}\p{N}\-_ ]/gu, "")
        .replaceAll(/\s+/g, "-")
        .replaceAll(/-+/g, "-")
        .replace(/^-/, "")
        .replace(/-$/, "") || "webskript-projekt";
}

function getSuggestedProjectName() {
    const firstSubprogram = projectState.subprograms[0];
    if (firstSubprogram && firstSubprogram.name) {
        return firstSubprogram.name + "-projekt";
    }
    return "webskript-projekt";
}

function normalizeImportedProject(rawData) {
    if (!rawData || typeof rawData !== "object") {
        return {
            ok: false,
            message: "Die Datei enthält kein gültiges Projektobjekt."
        };
    }

    if (rawData.format !== PROJECT_FORMAT) {
        return {
            ok: false,
            message: "Die Datei ist kein gültiges WebSkript-Projekt."
        };
    }

    if (typeof rawData.version !== "number") {
        return {
            ok: false,
            message: "Die Projektdatei enthält keine gültige Versionsangabe."
        };
    }

    const mainSource = typeof rawData.mainSource === "string" ? rawData.mainSource : "";
    const rawSubprograms = Array.isArray(rawData.subprograms) ? rawData.subprograms : [];

    const normalizedSubprograms = [];

    for (let i = 0; i < rawSubprograms.length; i++) {
        const entry = rawSubprograms[i];

        if (!entry || typeof entry !== "object") {
            return {
                ok: false,
                message: `Unterprogramm ${i + 1} ist ungültig.`
            };
        }

        if (typeof entry.name !== "string" || entry.name.trim() === "") {
            return {
                ok: false,
                message: `Unterprogramm ${i + 1} hat keinen gültigen Namen.`
            };
        }

        const normalizedParameters = Array.isArray(entry.parameters)
            ? entry.parameters.filter(param =>
                param &&
                typeof param === "object" &&
                typeof param.type === "string" &&
                typeof param.name === "string"
            )
            : [];

        normalizedSubprograms.push({
            id: typeof entry.id === "string" && entry.id.trim() !== ""
                ? entry.id
                : `sub_import_${i}_${Date.now()}`,
            name: entry.name.trim(),
            parameters: normalizedParameters,
            returnType: entry.returnType ?? null,
            source: typeof entry.source === "string" ? entry.source : ""
        });
    }

    const nameSet = new Set();
    for (const subprogram of normalizedSubprograms) {
        const lower = subprogram.name.toLowerCase();
        if (nameSet.has(lower)) {
            return {
                ok: false,
                message: `Der Unterprogrammname „${subprogram.name}“ kommt mehrfach vor.`
            };
        }
        nameSet.add(lower);
    }

    return {
        ok: true,
        project: {
            mainSource,
            subprograms: normalizedSubprograms
        }
    };
}

function applyImportedProject(project) {
    projectState.mainSource = project.mainSource;
    projectState.subprograms = project.subprograms;
    projectState.currentProgramId = "main";

    debugInterpreter = null;
    lastVariableState = null;

    clearActiveLine();
    clearErrorLines();
    consoleDiv.innerHTML = "";
    clearVariableState("Noch keine Variablen vorhanden. Nutze Run oder Debug.");

    renderAll();
}

function appendConsoleLine(text, kind) {
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
    scrollConsoleToBottom();
}

function scrollConsoleToBottom() {
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function yieldToBrowser() {
    return new Promise(resolve => {
        requestAnimationFrame(() => resolve());
    });
}

clearVariableState("Noch keine Variablen vorhanden. Nutze Run oder Debug.");
renderAll();