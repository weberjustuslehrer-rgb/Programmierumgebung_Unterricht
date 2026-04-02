import { tasks } from "./taskData.js";
import { checkTask } from "./taskChecker.js";

const state = {
    currentTaskIndex: 0,
    failsCount: new Array(tasks.length).fill(0),
    solvedTasks: new Array(tasks.length).fill(false),
    savedCodes: new Array(tasks.length).fill(""),
    enabled: false,
    collapsed: false,
    callbacks: {
        onLoadStarterCode: null,
        onGetCurrentCode: null,
        onProgramsSnapshot: null,
        onClearTurtleStage: null
    }
};

function getElements() {
    return {
        taskPanel: document.getElementById("taskPanel"),
        taskTitle: document.getElementById("taskTitle"),
        taskDescription: document.getElementById("taskDescription"),
        taskProgressText: document.getElementById("taskProgressText"),
        taskProgressFill: document.getElementById("taskProgressFill"),
        taskFeedback: document.getElementById("taskFeedback"),
        taskSolutionBox: document.getElementById("taskSolutionBox"),
        showSolutionButton: document.getElementById("showSolutionButton"),
        prevTaskButton: document.getElementById("prevTaskButton"),
        nextTaskButton: document.getElementById("nextTaskButton"),
        taskPanelBody: document.getElementById("taskPanelBody"),
        toggleTaskPanelButton: document.getElementById("toggleTaskPanelButton"),
    };
}

function updateTaskPanelCollapseUi() {
    const els = getElements();

    if (!els.taskPanel || !els.toggleTaskPanelButton) {
        return;
    }

    els.taskPanel.classList.toggle("taskPanel-collapsed", state.collapsed);
    els.toggleTaskPanelButton.textContent = state.collapsed
        ? "Aufgabe ausklappen"
        : "Aufgabe einklappen";
}



function saveCurrentTaskCode() {
    const getCode = state.callbacks.onGetCurrentCode;
    if (!getCode) return;

    state.savedCodes[state.currentTaskIndex] = getCode();
}

function loadCurrentTaskIntoEditor() {
    const task = tasks[state.currentTaskIndex];
    const loadCode = state.callbacks.onLoadStarterCode;

    if (!loadCode) return;

    const existing = state.savedCodes[state.currentTaskIndex];
    const codeToLoad = existing !== "" ? existing : (task.emptyStarterCode || "");
    loadCode(codeToLoad);
}

function clearTaskVisualState() {
    const els = getElements();
    els.taskSolutionBox.textContent = "";
    els.taskSolutionBox.classList.add("hidden");
    els.showSolutionButton.classList.add("hidden");
}

export function initTaskEngine({
                                   onLoadStarterCode,
                                   onGetCurrentCode,
                                   onProgramsSnapshot,
                                   onClearTurtleStage
                               }) {
    state.callbacks.onLoadStarterCode = onLoadStarterCode;
    state.callbacks.onGetCurrentCode = onGetCurrentCode;
    state.callbacks.onProgramsSnapshot = onProgramsSnapshot;
    state.callbacks.onClearTurtleStage = onClearTurtleStage;

    const els = getElements();

    if (els.toggleTaskPanelButton) {
        els.toggleTaskPanelButton.addEventListener("click", () => {
            state.collapsed = !state.collapsed;
            updateTaskPanelCollapseUi();
        });
    }

    els.prevTaskButton.addEventListener("click", () => {
        saveCurrentTaskCode();

        if (state.currentTaskIndex > 0) {
            state.currentTaskIndex--;
            renderTask();
            loadCurrentTaskIntoEditor();
            if (state.callbacks.onClearTurtleStage) {
                state.callbacks.onClearTurtleStage();
            }
        }
    });

    els.nextTaskButton.addEventListener("click", () => {
        saveCurrentTaskCode();

        if (state.currentTaskIndex < tasks.length - 1) {
            state.currentTaskIndex++;
            renderTask();
            loadCurrentTaskIntoEditor();
            if (state.callbacks.onClearTurtleStage) {
                state.callbacks.onClearTurtleStage();
            }
        }
    });

    els.showSolutionButton.addEventListener("click", () => {
        const task = tasks[state.currentTaskIndex];
        els.taskSolutionBox.textContent = task.solution;
        els.taskSolutionBox.classList.remove("hidden");
    });


    renderTask();
}

export function setTaskModeEnabled(enabled, onLoadStarterCode) {
    state.enabled = enabled;
    if (onLoadStarterCode) {
        state.callbacks.onLoadStarterCode = onLoadStarterCode;
    }

    const els = getElements();

    if (enabled) {
        els.taskPanel.classList.remove("hidden");
        updateTaskPanelCollapseUi();
        renderTask();
        loadCurrentTaskIntoEditor();
        if (state.callbacks.onClearTurtleStage) {
            state.callbacks.onClearTurtleStage();
        }
    } else {
        saveCurrentTaskCode();
        els.taskPanel.classList.add("hidden");
        clearFeedback();
    }
}

export function isTaskModeEnabled() {
    return state.enabled;
}

export function evaluateCurrentTask(trace) {
    saveCurrentTaskCode();

    const task = tasks[state.currentTaskIndex];
    const sourceCode = state.callbacks.onGetCurrentCode?.() || "";
    const programs = state.callbacks.onProgramsSnapshot?.() || null;

    const result = checkTask(task, {
        trace,
        sourceCode,
        programs
    });

    if (result.success) {
        state.failsCount[state.currentTaskIndex] = 0;
        state.solvedTasks[state.currentTaskIndex] = true;
        showFeedback(result.message, "success");
        return;
    }

    state.failsCount[state.currentTaskIndex]++;

    if (state.failsCount[state.currentTaskIndex] >= 4) {
        showFeedback(result.message + " Tipp und Lösung sind jetzt verfügbar.", "error");
        getElements().showSolutionButton.classList.remove("hidden");
    } else if (state.failsCount[state.currentTaskIndex] >= 2) {
        showFeedback(result.message + " 💡 Tipp: " + task.hint, "hint");
    } else {
        showFeedback(result.message, "error");
    }
}

export function renderTask() {
    const els = getElements();
    const task = tasks[state.currentTaskIndex];

    updateTaskPanelCollapseUi();

    els.taskTitle.textContent = task.title;
    els.taskDescription.textContent = task.description;
    els.taskProgressText.textContent = `Aufgabe ${state.currentTaskIndex + 1} von ${tasks.length}`;
    els.taskProgressFill.style.width = `${((state.currentTaskIndex + 1) / tasks.length) * 100}%`;

    els.prevTaskButton.disabled = state.currentTaskIndex === 0;
    els.nextTaskButton.disabled = state.currentTaskIndex === tasks.length - 1;

    clearTaskVisualState();





    if (state.solvedTasks[state.currentTaskIndex]) {
        showFeedback("Diese Aufgabe wurde bereits einmal korrekt gelöst.", "success");
    } else {
        clearFeedback();
    }
}

function showFeedback(message, type) {
    const els = getElements();
    els.taskFeedback.textContent = message;
    els.taskFeedback.className = `taskFeedback ${type}`;
}

function clearFeedback() {
    const els = getElements();
    els.taskFeedback.textContent = "";
    els.taskFeedback.className = "taskFeedback hidden";
}