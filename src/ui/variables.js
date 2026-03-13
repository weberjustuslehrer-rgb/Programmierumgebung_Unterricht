export function renderVariableState(state) {
    const container = document.getElementById("variablesContent");
    if (!container) return;

    if (!state) {
        container.innerHTML = `<div class="variables-placeholder">Noch keine Variablen vorhanden.</div>`;
        return;
    }

    let html = "";

    html += renderSection("Variablen im Hauptprogramm", state.mainVariables || []);

    if (state.localVariables && state.localVariables.length > 0) {
        const localTitle = state.localProgramName
            ? `Variablen im Unterprogramm „${escapeHtml(state.localProgramName)}“`
            : "Variablen im Unterprogramm";

        html += renderSection(localTitle, state.localVariables);
    }

    container.innerHTML = html;
}

export function clearVariableState(message = "Noch keine Variablen vorhanden.") {
    const container = document.getElementById("variablesContent");
    if (!container) return;

    container.innerHTML = `<div class="variables-placeholder">${escapeHtml(message)}</div>`;
}

function renderSection(title, variables) {
    let html = `<div class="variable-section">`;
    html += `<h4>${title}</h4>`;

    if (!variables || variables.length === 0) {
        html += `<div class="variable-empty">Keine Variablen vorhanden.</div>`;
        html += `</div>`;
        return html;
    }

    html += `
        <table class="variable-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Typ</th>
                    <th>Wert</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const variable of variables) {
        html += `
            <tr>
                <td class="variable-name">${escapeHtml(variable.name)}</td>
                <td class="variable-type">${escapeHtml(variable.type)}</td>
                <td class="variable-value">${escapeHtml(variable.value)}</td>
            </tr>
        `;
    }

    html += `
            </tbody>
        </table>
    `;

    html += `</div>`;
    return html;
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}