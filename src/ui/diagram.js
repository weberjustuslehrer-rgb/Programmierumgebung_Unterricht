export function renderDiagram(ast) {
    const canvas = document.getElementById("diagramCanvas");
    canvas.innerHTML = "";

    const root = document.createElement("div");
    root.classList.add("ns-root");

    ast.body.forEach(node => {
        root.appendChild(renderNode(node));
    });

    canvas.appendChild(root);
}

function renderNode(node) {
    if (node.type === "if") {
        return renderIfNode(node);
    }

    if (node.type === "while") {
        return renderWhileNode(node);
    }

    if (node.type === "repeat") {
        return renderRepeatNode(node);
    }

    return renderStatementNode(node);
}

function renderStatementNode(node) {
    const box = document.createElement("div");
    box.classList.add("ns-statement");

    if (node.type === "declaration") {
        box.textContent = `${node.varType} ${node.variable} = ${node.value}`;
    }
    else if (node.type === "assignment") {
        box.textContent = `${node.variable} = ${node.value}`;
    }
    else if (node.type === "output") {
        box.textContent = `Ausgabe ${node.expression}`;
    }
    else if (node.type === "input") {
        box.textContent = `Eingabe: ${node.variable}`;
    }
    else if (node.type === "call") {
        box.classList.add("ns-call");
        if (node.args && node.args.length > 0) {
            box.textContent = `Rufe ${node.program} mit ${node.args.join(", ")} auf`;
        } else {
            box.textContent = `Rufe ${node.program} auf`;
        }
    }
    else if (node.type === "return") {
        box.textContent = `Gib ${node.expression} zurück`;
    }

    else if (node.type === "turtle_forward") {
        box.textContent = `Gehe ${node.expression} Schritte vorwärts`;
    }
    else if (node.type === "turtle_backward") {
        box.textContent = `Gehe ${node.expression} Schritte rückwärts`;
    }
    else if (node.type === "turtle_left") {
        box.textContent = `Drehe um ${node.expression}° nach links`;
    }
    else if (node.type === "turtle_right") {
        box.textContent = `Drehe um ${node.expression}° nach rechts`;
    }
    else if (node.type === "turtle_pen_up") {
        box.textContent = "Hebe den Stift an";
    }
    else if (node.type === "turtle_pen_down") {
        box.textContent = "Setze den Stift auf";
    }
    else if (node.type === "turtle_clear") {
        box.textContent = "Lösche die Zeichenfläche";
    }
    else if (node.type === "turtle_move_to") {
        box.textContent = `Gehe zu (${node.xExpression} | ${node.yExpression})`;
    }

    else {
        box.textContent = node.type;
    }

    return box;
}

function renderIfNode(node) {
    const container = document.createElement("div");
    container.classList.add("ns-if");

    const header = document.createElement("div");
    header.classList.add("ns-header");
    header.textContent = `Wenn ${node.condition}`;

    const branches = document.createElement("div");
    branches.classList.add("ns-branches");

    const thenColumn = document.createElement("div");
    thenColumn.classList.add("ns-branch-column");

    const thenLabel = document.createElement("div");
    thenLabel.classList.add("ns-branch-label");
    thenLabel.textContent = "Dann";

    const thenContent = document.createElement("div");
    thenContent.classList.add("ns-branch-content");

    node.thenBody.forEach(child => {
        thenContent.appendChild(renderNode(child));
    });

    if (node.thenBody.length === 0) {
        thenContent.appendChild(renderEmptyCell());
    }

    thenColumn.appendChild(thenLabel);
    thenColumn.appendChild(thenContent);

    const elseColumn = document.createElement("div");
    elseColumn.classList.add("ns-branch-column");

    const elseLabel = document.createElement("div");
    elseLabel.classList.add("ns-branch-label");
    elseLabel.textContent = "Sonst";

    const elseContent = document.createElement("div");
    elseContent.classList.add("ns-branch-content");

    if (node.elseBody && node.elseBody.length > 0) {
        node.elseBody.forEach(child => {
            elseContent.appendChild(renderNode(child));
        });
    } else {
        elseContent.appendChild(renderEmptyCell());
    }

    elseColumn.appendChild(elseLabel);
    elseColumn.appendChild(elseContent);

    branches.appendChild(thenColumn);
    branches.appendChild(elseColumn);

    container.appendChild(header);
    container.appendChild(branches);

    return container;
}

function renderWhileNode(node) {
    const container = document.createElement("div");
    container.classList.add("ns-while");

    const header = document.createElement("div");
    header.classList.add("ns-header");
    header.textContent = `Solange ${node.condition}`;

    const frame = document.createElement("div");
    frame.classList.add("ns-loop-frame");

    const body = document.createElement("div");
    body.classList.add("ns-loop-body");

    node.body.forEach(child => {
        body.appendChild(renderNode(child));
    });

    if (node.body.length === 0) {
        body.appendChild(renderEmptyCell());
    }

    frame.appendChild(body);
    container.appendChild(header);
    container.appendChild(frame);

    return container;
}

function renderRepeatNode(node) {
    const container = document.createElement("div");
    container.classList.add("ns-repeat");

    const header = document.createElement("div");
    header.classList.add("ns-header");
    header.textContent = `Wiederhole ${node.count} Mal`;

    const frame = document.createElement("div");
    frame.classList.add("ns-loop-frame");

    const body = document.createElement("div");
    body.classList.add("ns-loop-body");

    node.body.forEach(child => {
        body.appendChild(renderNode(child));
    });

    if (node.body.length === 0) {
        body.appendChild(renderEmptyCell());
    }

    frame.appendChild(body);
    container.appendChild(header);
    container.appendChild(frame);

    return container;
}

function renderEmptyCell() {
    const empty = document.createElement("div");
    empty.classList.add("ns-empty-cell");
    empty.innerHTML = "&nbsp;";
    return empty;
}