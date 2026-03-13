export function renderProgramList(projectState, onSelectProgram) {
    const container = document.getElementById("programList");
    container.innerHTML = "";

    const mainItem = document.createElement("div");
    mainItem.className =
        "programEntry programEntry-main" +
        (projectState.currentProgramId === "main" ? " active" : "");
    mainItem.textContent = "Hauptprogramm";
    mainItem.addEventListener("click", () => onSelectProgram("main"));
    container.appendChild(mainItem);

    projectState.subprograms.forEach(subprogram => {
        const item = document.createElement("div");
        item.className = "programEntry" + (projectState.currentProgramId === subprogram.id ? " active" : "");
        item.textContent = subprogram.name;
        item.addEventListener("click", () => onSelectProgram(subprogram.id));
        container.appendChild(item);
    });
}

export function formatSubprogramSignature(subprogram) {
    const paramText = (subprogram.parameters || [])
        .map(param => `${param.type} ${param.name}`)
        .join(", ");

    const returnText = subprogram.returnType ? ` → ${subprogram.returnType}` : "";

    if (paramText === "") {
        return `${subprogram.name}()${returnText}`;
    }

    return `${subprogram.name}(${paramText})${returnText}`;
}