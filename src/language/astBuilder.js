export function buildAST(nodes) {
    const result = parseBlock(nodes, 0, []);
    return {
        type: "program",
        body: result.body
    };
}

function parseBlock(nodes, startIndex, stopTypes) {
    const body = [];
    let i = startIndex;

    while (i < nodes.length) {
        const node = nodes[i];

        if (stopTypes.includes(node.type)) {
            break;
        }

        if (node.type === "if") {
            const ifResult = parseIf(nodes, i);
            body.push(ifResult.node);
            i = ifResult.nextIndex;
            continue;
        }

        if (node.type === "while") {
            const whileResult = parseWhile(nodes, i);
            body.push(whileResult.node);
            i = whileResult.nextIndex;
            continue;
        }

        if (node.type === "repeat") {
            const repeatResult = parseRepeat(nodes, i);
            body.push(repeatResult.node);
            i = repeatResult.nextIndex;
            continue;
        }

        body.push(node);
        i++;
    }

    return {
        body: body,
        nextIndex: i
    };
}

function parseIf(nodes, startIndex) {
    const ifNode = {
        type: "if",
        condition: nodes[startIndex].condition,
        thenBody: [],
        elseBody: null
    };

    let i = startIndex + 1;

    const thenResult = parseBlock(nodes, i, ["elseif", "else", "endif"]);
    ifNode.thenBody = thenResult.body;
    i = thenResult.nextIndex;

    if (i < nodes.length && nodes[i].type === "elseif") {
        const nestedElseIf = parseElseIfChain(nodes, i);
        ifNode.elseBody = [nestedElseIf.node];
        i = nestedElseIf.nextIndex;
    }
    else if (i < nodes.length && nodes[i].type === "else") {
        const elseResult = parseBlock(nodes, i + 1, ["endif"]);
        ifNode.elseBody = elseResult.body;
        i = elseResult.nextIndex;
    }

    if (i < nodes.length && nodes[i].type === "endif") {
        i++;
    }

    return {
        node: ifNode,
        nextIndex: i
    };
}

function parseElseIfChain(nodes, startIndex) {
    const ifNode = {
        type: "if",
        condition: nodes[startIndex].condition,
        thenBody: [],
        elseBody: null
    };

    let i = startIndex + 1;

    const thenResult = parseBlock(nodes, i, ["elseif", "else", "endif"]);
    ifNode.thenBody = thenResult.body;
    i = thenResult.nextIndex;

    if (i < nodes.length && nodes[i].type === "elseif") {
        const nestedElseIf = parseElseIfChain(nodes, i);
        ifNode.elseBody = [nestedElseIf.node];
        i = nestedElseIf.nextIndex;
    }
    else if (i < nodes.length && nodes[i].type === "else") {
        const elseResult = parseBlock(nodes, i + 1, ["endif"]);
        ifNode.elseBody = elseResult.body;
        i = elseResult.nextIndex;
    }

    return {
        node: ifNode,
        nextIndex: i
    };
}

function parseWhile(nodes, startIndex) {
    const whileNode = {
        type: "while",
        condition: nodes[startIndex].condition,
        body: []
    };

    const bodyResult = parseBlock(nodes, startIndex + 1, ["endwhile"]);
    whileNode.body = bodyResult.body;

    let i = bodyResult.nextIndex;

    if (i < nodes.length && nodes[i].type === "endwhile") {
        i++;
    }

    return {
        node: whileNode,
        nextIndex: i
    };
}

function parseRepeat(nodes, startIndex) {
    const repeatNode = {
        type: "repeat",
        count: nodes[startIndex].count,
        body: []
    };

    const bodyResult = parseBlock(nodes, startIndex + 1, ["endrepeat"]);
    repeatNode.body = bodyResult.body;

    let i = bodyResult.nextIndex;

    if (i < nodes.length && nodes[i].type === "endrepeat") {
        i++;
    }

    return {
        node: repeatNode,
        nextIndex: i
    };
}