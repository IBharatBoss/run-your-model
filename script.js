/* =========================================
   TEST YOUR MODEL (v6)
   93% Geometry, Immutable State, Prompt Isolation, Kill Switch
   ========================================= */

const STORAGE_KEY = 'testYourModel_savedModels';
const CHAT_STORAGE_KEY = 'testYourModel_chats';
const SETTINGS_KEY = 'testYourModel_settings';
const MAX_GLOBAL_JUDGES = 5;
const LEGACY_DEFAULT_JUDGE_PROMPT = "You are a ruthless, impartial AI benchmark judge. Grade with extreme strictness. A score of 50 means 'acceptable', 80 is 'exceptional', and 100 is virtually impossible. Penalize heavily for verbosity, hallucinations, and lack of clarity. Never show mercy.";
const DEFAULT_JUDGE_PROMPT = "You are an impartial industry benchmark judge. Evaluate each model strictly against the exact human input. Aggressively penalize hallucinations, refusals without valid policy reasons, and irrelevant or evasive responses. Avoid score ties unless outputs are genuinely equivalent. You must rank models fairly with clear separation based on benchmark-level quality standards.";

function defaultSummaryState() {
    return {
        status: 'idle',
        text: '',
        error: '',
        updatedAt: null,
        byJudgeId: ''
    };
}

const state = {
    isGenerating: false,
    promptCounter: 0,
    modelHistories: {},
    sessionOutputs: {},
    savedModels: [],
    activeAbortController: null,
    settings: {
        globalJudgePrompt: DEFAULT_JUDGE_PROMPT,
        allowDuplicates: true,
        activeJudgeIds: [],
        activeArenaIds: []
    },
    currentViewPromptId: null,
    judgeInFlightByPrompt: {},
    floating: {
        observer: null,
        rows: new Map(),
        activePromptId: null
    }
};

const ui = {
    chatContainer: document.getElementById('chatContainer'),
    emptyState: document.getElementById('emptyState'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    apiStatus: document.getElementById('apiStatus'),
    historyBtn: document.getElementById('historyBtn'),
    terminalToggleBtn: document.getElementById('terminalToggleBtn'),

    floatingActions: document.getElementById('floatingActions'),
    floatingPerfBtn: document.getElementById('floatingPerfBtn'),
    floatingCopyBtn: document.getElementById('floatingCopyBtn'),

    manageModelsBtn: document.getElementById('manageModelsBtn'),
    newChatBtn: document.getElementById('newChatBtn'),

    arenaModalBtn: document.getElementById('arenaModalBtn'),
    arenaModal: document.getElementById('arenaModal'),
    closeArenaModalBtn: document.getElementById('closeArenaModalBtn'),
    globalSystemPrompt: document.getElementById('globalSystemPrompt'),
    dynamicModelList: document.getElementById('dynamicModelList'),
    dynamicJudgeList: document.getElementById('dynamicJudgeList'),
    contextToggle: document.getElementById('contextToggle'),
    selectAllModelsBtn: document.getElementById('selectAllModelsBtn'),
    deselectAllModelsBtn: document.getElementById('deselectAllModelsBtn'),

    manageModelsModal: document.getElementById('manageModelsModal'),
    closeManageModalBtn: document.getElementById('closeManageModalBtn'),
    savedModelsList: document.getElementById('savedModelsList'),
    addNewModelTrigger: document.getElementById('addNewModelTrigger'),
    allowDuplicatesToggle: document.getElementById('allowDuplicatesToggle'),
    importJsonFile: document.getElementById('importJsonFile'),
    importModelsBtn: document.getElementById('importModelsBtn'),
    exportModelsBtn: document.getElementById('exportModelsBtn'),

    modelConfigForm: document.getElementById('modelConfigForm'),
    formTitle: document.getElementById('formTitle'),
    editModelInternalId: document.getElementById('editModelInternalId'),
    configModelName: document.getElementById('configModelName'),
    configArchitecture: document.getElementById('configArchitecture'),
    configModelId: document.getElementById('configModelId'),
    configApiKey: document.getElementById('configApiKey'),
    configCustomUrl: document.getElementById('configCustomUrl'),
    configSystemPrompt: document.getElementById('configSystemPrompt'),
    configUseAsActive: document.getElementById('configUseAsActive'),
    configUseAsJudge: document.getElementById('configUseAsJudge'),
    customEndpointGroup: document.getElementById('customEndpointGroup'),
    saveModelBtn: document.getElementById('saveModelBtn'),
    deleteModelBtn: document.getElementById('deleteModelBtn'),

    performanceModal: document.getElementById('performanceModal'),
    closePerfModalBtn: document.getElementById('closePerfModalBtn'),
    perfTabs: document.getElementById('perfTabs'),
    perfPromptIdDisplay: document.getElementById('perfPromptIdDisplay'),
    exportPerfJsonBtn: document.getElementById('exportPerfJsonBtn'),
    retryJudgeSelect: document.getElementById('retryJudgeSelect'),
    retryJudgeBtn: document.getElementById('retryJudgeBtn'),
    judgeExecutionState: document.getElementById('judgeExecutionState'),
    judgeLoadingOverlay: document.getElementById('judgeLoadingOverlay'),
    judgeReportSwitcher: document.getElementById('judgeReportSwitcher'),
    judgeMissingWarning: document.getElementById('judgeMissingWarning'),
    qualityScoreboardContainer: document.getElementById('qualityScoreboardContainer'),
    qualityTableBody: document.getElementById('qualityTableBody'),
    failureGrid: document.getElementById('failureGrid'),
    perfSpeedChart: document.getElementById('perfSpeedChart'),
    perfLatencyChart: document.getElementById('perfLatencyChart'),
    aiSummaryContent: document.getElementById('aiSummaryContent'),

    globalHistoryModal: document.getElementById('globalHistoryModal'),
    closeHistoryModalBtn: document.getElementById('closeHistoryModalBtn'),
    globalHistoryList: document.getElementById('globalHistoryList'),

    terminalPanel: document.getElementById('terminalPanel'),
    closeTerminalBtn: document.getElementById('closeTerminalBtn'),
    terminalOutput: document.getElementById('terminalOutput'),

    clickModal: document.getElementById('clickModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalBody: document.getElementById('modalBody'),
    modalModelName: document.getElementById('modalModelName'),
    modalStatus: document.getElementById('modalStatus'),

    newChatWarningModal: document.getElementById('newChatWarningModal'),
    cancelNewChatBtn: document.getElementById('cancelNewChatBtn'),
    confirmNewChatBtn: document.getElementById('confirmNewChatBtn'),

    killSwitchModal: document.getElementById('killSwitchModal'),
    killSwitchInput: document.getElementById('killSwitchInput'),
    cancelKillSwitchBtn: document.getElementById('cancelKillSwitchBtn'),
    confirmKillSwitchBtn: document.getElementById('confirmKillSwitchBtn')
};

function deepClone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function setSavedModels(nextOrUpdater) {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(state.savedModels) : nextOrUpdater;
    state.savedModels = Array.isArray(next) ? [...next] : [];
    return state.savedModels;
}

function setModelHistories(nextOrUpdater) {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(state.modelHistories) : nextOrUpdater;
    state.modelHistories = next && typeof next === 'object' ? { ...next } : {};
    return state.modelHistories;
}

function setSessionOutputs(nextOrUpdater) {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(state.sessionOutputs) : nextOrUpdater;
    state.sessionOutputs = next && typeof next === 'object' ? { ...next } : {};
    return state.sessionOutputs;
}

function updateSessionOutput(promptId, updater) {
    let updatedRecord = null;
    setSessionOutputs(prevOutputs => {
        const currentRecord = prevOutputs[promptId]
            ? deepClone(prevOutputs[promptId])
            : normalizePromptData(promptId, {});
        const nextRecord = updater(currentRecord) || currentRecord;
        updatedRecord = nextRecord;
        return { ...prevOutputs, [promptId]: nextRecord };
    });
    return updatedRecord;
}

function updateModelHistory(modelId, updater) {
    let updatedHistory = [];
    setModelHistories(prevHistories => {
        const currentHistory = Array.isArray(prevHistories[modelId]) ? [...prevHistories[modelId]] : [];
        const nextHistory = updater(currentHistory) || currentHistory;
        updatedHistory = nextHistory;
        return { ...prevHistories, [modelId]: nextHistory };
    });
    return updatedHistory;
}

function isAbortError(error) {
    return error?.name === 'AbortError' || /abort/i.test(String(error?.message || ''));
}

function hasActiveAbortSignal() {
    return Boolean(state.activeAbortController && state.activeAbortController.signal);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseMarkdownSafe(text) {
    const safeText = String(text || '');
    try {
        return marked.parse(safeText);
    } catch (error) {
        return escapeHtml(safeText).replace(/\n/g, '<br>');
    }
}

function extractApiErrorMessage(errorPayload, fallback = 'API request failed.') {
    if (!errorPayload) return fallback;
    if (typeof errorPayload === 'string' && errorPayload.trim()) return errorPayload.trim();

    const candidates = [
        errorPayload?.error?.message,
        errorPayload?.error?.details,
        errorPayload?.error?.detail,
        errorPayload?.message,
        errorPayload?.details,
        errorPayload?.detail,
        errorPayload?.error_description,
        errorPayload?.statusMessage
    ];

    const firstCandidate = candidates.find(value => typeof value === 'string' && value.trim());
    if (firstCandidate) return firstCandidate.trim();

    if (Array.isArray(errorPayload?.error?.errors) && errorPayload.error.errors.length > 0) {
        const nestedMessage = errorPayload.error.errors[0]?.message;
        if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage.trim();
    }

    return fallback;
}

function getPromptSortNumber(promptId) {
    const match = String(promptId || '').match(/prompt-(\d+)/);
    return match ? Number(match[1]) : 0;
}

function getSortedPromptIds() {
    return Object.keys(state.sessionOutputs).sort((a, b) => getPromptSortNumber(a) - getPromptSortNumber(b));
}

function toScore(value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
}

function nowIso() {
    return new Date().toISOString();
}

function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    requestAnimationFrame(() => modalEl.classList.add('modal-active'));
}

function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('modal-active');
    setTimeout(() => modalEl.classList.add('hidden'), 220);
}

function updateStatus(text, isPulse = false, isSuccess = false) {
    ui.apiStatus.textContent = text;
    ui.apiStatus.className = `text-xs font-mono font-medium transition-colors rounded-none ${isPulse ? 'text-brand animate-pulse' : (isSuccess ? 'text-brandGreen' : 'text-gray-400')}`;
}

function pushTerminalLog(type, message, payload = null) {
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    let line = `[${timestamp}] [${type}] ${message}`;
    if (payload) {
        try {
            line += `\n${JSON.stringify(payload, null, 2)}`;
        } catch (error) {
            line += `\n[Payload parse error: ${error.message}]`;
        }
    }
    ui.terminalOutput.textContent += `\n${line}\n`;
    ui.terminalOutput.scrollTop = ui.terminalOutput.scrollHeight;
}

function appendPromptLog(promptId, entry) {
    if (!state.sessionOutputs[promptId]) return;
    updateSessionOutput(promptId, record => {
        if (!Array.isArray(record.logs)) record.logs = [];
        record.logs.push({ timestamp: nowIso(), ...entry });
        return record;
    });
}

function ensurePromptRecord(promptId) {
    if (state.sessionOutputs[promptId]) return state.sessionOutputs[promptId];
    return updateSessionOutput(promptId, () => ({
        promptId,
        createdAt: nowIso(),
        userText: '',
        aiReplies: {},
        judgeReports: {},
        judgeFailures: {},
        judgeSummaries: {},
        initialJudgeIds: [],
        logs: [],
        summary: defaultSummaryState()
    }));
}

function sanitizeModel(raw, index) {
    const internalId = raw.internalId || `mod_${Date.now()}_${index}`;
    const isJudge = Boolean(raw.isJudge);
    const isActive = raw.isActive !== false;
    return {
        internalId,
        name: raw.name || `Model ${index + 1}`,
        provider: raw.provider || 'openai',
        modelId: raw.modelId || '',
        apiKey: raw.apiKey || '',
        customUrl: raw.customUrl || '',
        systemPrompt: raw.systemPrompt || '',
        isJudge,
        isActive
    };
}

function normalizePromptData(promptId, raw = {}) {
    return {
        promptId,
        createdAt: raw.createdAt || nowIso(),
        userText: raw.userText || '',
        aiReplies: raw.aiReplies || {},
        judgeReports: raw.judgeReports || {},
        judgeFailures: raw.judgeFailures || {},
        judgeSummaries: raw.judgeSummaries || {},
        initialJudgeIds: Array.isArray(raw.initialJudgeIds) ? raw.initialJudgeIds : [],
        logs: Array.isArray(raw.logs) ? raw.logs : [],
        summary: raw.summary ? { ...defaultSummaryState(), ...raw.summary } : defaultSummaryState()
    };
}

function loadSettingsFromStorage() {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return;
    try {
        const parsed = JSON.parse(data);
        const globalJudgePrompt = (parsed.globalJudgePrompt || '').trim();
        const useUpgradedPrompt = !globalJudgePrompt || globalJudgePrompt === LEGACY_DEFAULT_JUDGE_PROMPT;
        state.settings = {
            ...state.settings,
            ...parsed,
            globalJudgePrompt: useUpgradedPrompt ? DEFAULT_JUDGE_PROMPT : parsed.globalJudgePrompt,
            activeJudgeIds: Array.isArray(parsed.activeJudgeIds) ? parsed.activeJudgeIds : [],
            activeArenaIds: Array.isArray(parsed.activeArenaIds) ? parsed.activeArenaIds : []
        };
    } catch (error) {
        console.error('Settings parse error:', error);
    }
}

function saveSettingsToStorage() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadModelsFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        setSavedModels([]);
        return;
    }

    try {
        const parsed = JSON.parse(data);
        const nextModels = Array.isArray(parsed) ? parsed.map(sanitizeModel) : [];
        setSavedModels(nextModels);
        setModelHistories(prev => {
            const next = { ...prev };
            nextModels.forEach(model => {
                if (!Array.isArray(next[model.internalId])) next[model.internalId] = [];
            });
            return next;
        });
        enforceGlobalJudgeModelLimit();
    } catch (error) {
        console.error('Model parse error:', error);
        setSavedModels([]);
    }
}

function saveModelsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedModels));
    sanitizeSelectionSettings();
    saveSettingsToStorage();
    buildActiveArenaList();
    buildActiveJudgeList();
    buildManageModelsSidebar();
}

function enforceGlobalJudgeModelLimit() {
    const judges = state.savedModels.filter(model => model.isJudge);
    if (judges.length <= MAX_GLOBAL_JUDGES) return;

    const overflowJudgeIds = new Set(judges.slice(MAX_GLOBAL_JUDGES).map(model => model.internalId));
    setSavedModels(prevModels => prevModels.map(model => {
        if (!overflowJudgeIds.has(model.internalId)) return model;
        return { ...model, isJudge: false };
    }));
    state.settings = {
        ...state.settings,
        activeJudgeIds: state.settings.activeJudgeIds.filter(id => !overflowJudgeIds.has(id))
    };
    pushTerminalLog('SYSTEM', `Judge model limit enforced at ${MAX_GLOBAL_JUDGES}. Extra judge assignments were disabled.`);
}

function sanitizeSelectionSettings() {
    const activeCapableIds = new Set(state.savedModels.filter(m => m.isActive).map(m => m.internalId));
    const judgeCapableIds = new Set(state.savedModels.filter(m => m.isJudge).map(m => m.internalId));

    let nextArenaIds = (state.settings.activeArenaIds || []).filter(id => activeCapableIds.has(id));
    if (nextArenaIds.length === 0) nextArenaIds = Array.from(activeCapableIds);

    let nextJudgeIds = (state.settings.activeJudgeIds || []).filter(id => judgeCapableIds.has(id));
    if (nextJudgeIds.length > MAX_GLOBAL_JUDGES) nextJudgeIds = nextJudgeIds.slice(0, MAX_GLOBAL_JUDGES);

    state.settings = {
        ...state.settings,
        activeArenaIds: nextArenaIds,
        activeJudgeIds: nextJudgeIds
    };
}

function loadChatsFromStorage() {
    const chatData = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!chatData) {
        setSessionOutputs({});
        state.promptCounter = 0;
        return;
    }

    try {
        const parsed = JSON.parse(chatData);
        const rawOutputs = parsed.sessionOutputs || {};
        const normalizedOutputs = {};

        Object.keys(rawOutputs).forEach(promptId => {
            normalizedOutputs[promptId] = normalizePromptData(promptId, rawOutputs[promptId]);
        });

        setSessionOutputs(normalizedOutputs);
        if (parsed.modelHistories && typeof parsed.modelHistories === 'object') {
            setModelHistories(parsed.modelHistories);
        }

        const highestPrompt = getSortedPromptIds().reduce((acc, promptId) => {
            return Math.max(acc, getPromptSortNumber(promptId));
        }, -1);

        state.promptCounter = Math.max(parsed.promptCounter || 0, highestPrompt + 1);
    } catch (error) {
        console.error('Failed to parse chat data:', error);
        setSessionOutputs({});
        state.promptCounter = 0;
    }
}

function saveChatsToStorage() {
    const chatData = {
        promptCounter: state.promptCounter,
        sessionOutputs: state.sessionOutputs,
        modelHistories: state.modelHistories
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatData));
}

function getModelById(internalId) {
    return state.savedModels.find(model => model.internalId === internalId);
}

function getCurrentActiveJudgeModels() {
    return state.settings.activeJudgeIds
        .map(id => getModelById(id))
        .filter(model => model && model.isJudge);
}

function hydrateSettingsUI() {
    ui.globalSystemPrompt.value = state.settings.globalJudgePrompt;
    ui.allowDuplicatesToggle.checked = Boolean(state.settings.allowDuplicates);
}

function resetModelForm() {
    ui.modelConfigForm.reset();
    ui.editModelInternalId.value = '';
    ui.formTitle.textContent = 'Add New Model';
    ui.deleteModelBtn.classList.add('hidden');
    ui.customEndpointGroup.classList.add('hidden');
    ui.configCustomUrl.removeAttribute('required');
    ui.configUseAsActive.checked = true;
    ui.configUseAsJudge.checked = false;
}

function loadModelIntoForm(model) {
    ui.formTitle.textContent = 'Edit Model';
    ui.editModelInternalId.value = model.internalId;
    ui.configModelName.value = model.name;
    ui.configArchitecture.value = model.provider;
    ui.configModelId.value = model.modelId;
    ui.configApiKey.value = model.apiKey;
    ui.configSystemPrompt.value = model.systemPrompt || '';
    ui.configUseAsActive.checked = model.isActive !== false;
    ui.configUseAsJudge.checked = Boolean(model.isJudge);

    if (model.provider === 'custom') {
        ui.customEndpointGroup.classList.remove('hidden');
        ui.configCustomUrl.value = model.customUrl || '';
        ui.configCustomUrl.setAttribute('required', 'true');
    } else {
        ui.customEndpointGroup.classList.add('hidden');
        ui.configCustomUrl.removeAttribute('required');
        ui.configCustomUrl.value = '';
    }

    ui.deleteModelBtn.classList.remove('hidden');
}

function buildManageModelsSidebar() {
    ui.savedModelsList.innerHTML = '';
    if (state.savedModels.length === 0) {
        ui.savedModelsList.innerHTML = `<div class="p-4 text-xs text-gray-500 text-center">No models configured.</div>`;
        return;
    }

    state.savedModels.forEach(model => {
        const item = document.createElement('button');
        const tags = [];
        if (model.isActive) tags.push('<span class="text-gray-600">ACTIVE</span>');
        if (model.isJudge) tags.push('<span class="text-brand font-bold">JUDGE</span>');

        item.className = 'w-full text-left p-3 bg-white border border-gray-200 hover:border-brand transition-colors rounded-none mb-2 relative';
        item.innerHTML = `
            <div class="font-display font-bold text-sm text-darkText truncate pr-6">${escapeHtml(model.name)}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mt-1">${escapeHtml(model.provider)} ${tags.length ? ` - ${tags.join(' / ')}` : ''}</div>
        `;
        item.addEventListener('click', () => loadModelIntoForm(model));
        ui.savedModelsList.appendChild(item);
    });
}

function buildActiveArenaList() {
    const activeModels = state.savedModels.filter(model => model.isActive);
    if (activeModels.length === 0) {
        ui.dynamicModelList.innerHTML = `<p class="text-xs text-gray-400 italic">No active models available. Mark at least one model as "Use as Active Model".</p>`;
        return;
    }

    const html = activeModels.map(model => {
        const checked = state.settings.activeArenaIds.includes(model.internalId) ? 'checked' : '';
        return `
            <li class="flex items-center justify-between">
                <label class="cursor-pointer flex items-center gap-3 w-full">
                    <input type="checkbox" value="${model.internalId}" ${checked} class="sharp-checkbox arena-checkbox">
                    <span class="truncate max-w-[280px] text-sm text-gray-700">${escapeHtml(model.name)}</span>
                </label>
            </li>
        `;
    }).join('');

    ui.dynamicModelList.innerHTML = `<ul class="space-y-2">${html}</ul>`;
    ui.dynamicModelList.querySelectorAll('.arena-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', onArenaSelectionChange);
    });
}

function onArenaSelectionChange() {
    const selectedIds = Array.from(ui.dynamicModelList.querySelectorAll('.arena-checkbox:checked')).map(cb => cb.value);
    state.settings.activeArenaIds = selectedIds;
    saveSettingsToStorage();
}

function toggleJudgeSelection(judgeId, isChecked) {
    if (isChecked) {
        if (!state.settings.activeJudgeIds.includes(judgeId)) {
            state.settings.activeJudgeIds.push(judgeId);
        }
    } else {
        state.settings.activeJudgeIds = state.settings.activeJudgeIds.filter(id => id !== judgeId);
    }
    saveSettingsToStorage();
    updateRetryControls(state.currentViewPromptId);
}

function buildActiveJudgeList() {
    const judges = state.savedModels.filter(model => model.isJudge);
    if (judges.length === 0) {
        ui.dynamicJudgeList.innerHTML = `<p class="text-[11px] text-gray-400 italic">No Judge AI configured.</p>`;
        return;
    }

    const html = judges.map(judge => {
        const isChecked = state.settings.activeJudgeIds.includes(judge.internalId) ? 'checked' : '';
        return `
            <li>
                <label class="cursor-pointer flex items-center gap-3 text-xs text-gray-800 font-medium">
                    <input type="checkbox" value="${judge.internalId}" ${isChecked} class="sharp-checkbox active-judge-checkbox">
                    <span class="truncate">${escapeHtml(judge.name)}</span>
                </label>
            </li>
        `;
    }).join('');

    ui.dynamicJudgeList.innerHTML = `<ul class="space-y-2">${html}</ul>`;
    ui.dynamicJudgeList.querySelectorAll('.active-judge-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', event => {
            toggleJudgeSelection(event.target.value, event.target.checked);
        });
    });
}

function canAssignJudgeRole(editingId = '') {
    const judgeCountExcludingCurrent = state.savedModels.filter(model => model.isJudge && model.internalId !== editingId).length;
    return judgeCountExcludingCurrent < MAX_GLOBAL_JUDGES;
}

function saveModelFromForm() {
    if (!ui.modelConfigForm.checkValidity()) {
        ui.modelConfigForm.reportValidity();
        return;
    }

    const useAsActive = ui.configUseAsActive.checked;
    const useAsJudge = ui.configUseAsJudge.checked;
    const editingId = ui.editModelInternalId.value;

    if (!useAsActive && !useAsJudge) {
        alert('At least one capability must be checked: Use as Active Model or Use as Judge AI.');
        return;
    }

    if (useAsJudge && !canAssignJudgeRole(editingId)) {
        alert(`Maximum ${MAX_GLOBAL_JUDGES} models can be checked as \"Use as Judge AI\".`);
        return;
    }

    const newName = ui.configModelName.value.trim();
    if (!state.settings.allowDuplicates && !editingId) {
        const duplicate = state.savedModels.some(model => model.name.toLowerCase() === newName.toLowerCase());
        if (duplicate) {
            alert('A model with this display name already exists. Enable Allow Duplicates if needed.');
            return;
        }
    }

    const internalId = editingId || `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const updatedModel = {
        internalId,
        name: newName,
        provider: ui.configArchitecture.value,
        modelId: ui.configModelId.value.trim(),
        apiKey: ui.configApiKey.value.trim(),
        customUrl: ui.configArchitecture.value === 'custom' ? ui.configCustomUrl.value.trim() : '',
        systemPrompt: ui.configSystemPrompt.value.trim(),
        isActive: useAsActive,
        isJudge: useAsJudge
    };

    const existingIndex = state.savedModels.findIndex(model => model.internalId === internalId);
    if (existingIndex >= 0) {
        setSavedModels(prevModels => prevModels.map(model => {
            if (model.internalId !== internalId) return model;
            return updatedModel;
        }));
    } else {
        setSavedModels(prevModels => [...prevModels, updatedModel]);
        setModelHistories(prevHistories => ({ ...prevHistories, [internalId]: [] }));
    }

    let nextJudgeIds = [...state.settings.activeJudgeIds];
    if (!updatedModel.isJudge) {
        nextJudgeIds = nextJudgeIds.filter(id => id !== internalId);
    } else if (!nextJudgeIds.includes(internalId)) {
        nextJudgeIds.push(internalId);
    }

    let nextArenaIds = [...state.settings.activeArenaIds];
    if (!updatedModel.isActive) {
        nextArenaIds = nextArenaIds.filter(id => id !== internalId);
    } else if (!nextArenaIds.includes(internalId)) {
        nextArenaIds.push(internalId);
    }

    state.settings = {
        ...state.settings,
        activeJudgeIds: nextJudgeIds,
        activeArenaIds: nextArenaIds
    };

    enforceGlobalJudgeModelLimit();
    saveModelsToStorage();
    saveSettingsToStorage();
    resetModelForm();
    updateStatus('Model Saved', false, true);
    setTimeout(() => updateStatus('Ready', false, false), 2000);
}

function deleteModelFromForm() {
    const internalId = ui.editModelInternalId.value;
    if (!internalId) return;
    if (!confirm('Delete this model permanently?')) return;

    setSavedModels(prevModels => prevModels.filter(model => model.internalId !== internalId));
    state.settings = {
        ...state.settings,
        activeJudgeIds: state.settings.activeJudgeIds.filter(id => id !== internalId),
        activeArenaIds: state.settings.activeArenaIds.filter(id => id !== internalId)
    };
    setModelHistories(prevHistories => {
        const next = { ...prevHistories };
        delete next[internalId];
        return next;
    });

    saveModelsToStorage();
    saveSettingsToStorage();
    resetModelForm();
}

function exportModelsAsJson() {
    if (state.savedModels.length === 0) {
        alert('No models to export.');
        return;
    }
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state.savedModels, null, 2))}`;
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataStr);
    downloadLink.setAttribute('download', `Arena_Models_${new Date().toISOString().split('T')[0]}.json`);
    downloadLink.click();
}

function importModelsFromJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = loadEvent => {
        try {
            const imported = JSON.parse(loadEvent.target.result);
            if (!Array.isArray(imported)) throw new Error('Invalid format');

            let addedCount = 0;
            let judgeSkippedCount = 0;

            let nextModels = [...state.savedModels];
            let nextHistories = { ...state.modelHistories };

            imported.forEach((rawModel, index) => {
                const normalized = sanitizeModel(rawModel, index);
                if (!normalized.isActive && !normalized.isJudge) normalized.isActive = true;

                const exists = nextModels.some(model => model.name === normalized.name && model.modelId === normalized.modelId);
                if (exists && !state.settings.allowDuplicates) return;

                normalized.internalId = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                if (normalized.isJudge && !canAssignJudgeRole()) {
                    normalized.isJudge = false;
                    judgeSkippedCount += 1;
                }

                nextModels = [...nextModels, normalized];
                if (!Array.isArray(nextHistories[normalized.internalId])) {
                    nextHistories = { ...nextHistories, [normalized.internalId]: [] };
                }
                addedCount += 1;
            });

            setSavedModels(nextModels);
            setModelHistories(nextHistories);
            saveModelsToStorage();
            let resultMessage = `Successfully imported ${addedCount} model(s).`;
            if (judgeSkippedCount > 0) {
                resultMessage += ` ${judgeSkippedCount} judge assignment(s) skipped due to max limit ${MAX_GLOBAL_JUDGES}.`;
            }
            alert(resultMessage);
        } catch (error) {
            alert('Error importing JSON file.');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function renderGlobalHistoryList() {
    const sortedIds = getSortedPromptIds();
    if (sortedIds.length === 0) {
        ui.globalHistoryList.innerHTML = `<p class="text-sm text-gray-400 italic">No prompt history yet.</p>`;
        return;
    }

    ui.globalHistoryList.innerHTML = sortedIds.map(promptId => {
        const record = state.sessionOutputs[promptId];
        const line = `${promptId} - ${String(record.userText || '').replace(/\s+/g, ' ').slice(0, 120)}`;
        return `<button class="history-row" data-history-prompt-id="${promptId}" title="${escapeHtml(line)}">${escapeHtml(line)}</button>`;
    }).join('');
}

function openTerminalPanel() {
    ui.terminalPanel.classList.add('open');
    ui.terminalPanel.setAttribute('aria-hidden', 'false');
}

function closeTerminalPanel() {
    ui.terminalPanel.classList.remove('open');
    ui.terminalPanel.setAttribute('aria-hidden', 'true');
}

function updateKillSwitchValidation() {
    const isConfirmed = ui.killSwitchInput.value.trim() === 'CONFIRM';
    ui.confirmKillSwitchBtn.disabled = !isConfirmed;
    if (isConfirmed) {
        ui.confirmKillSwitchBtn.classList.remove('bg-brand/50', 'cursor-not-allowed');
        ui.confirmKillSwitchBtn.classList.add('bg-brand', 'hover:bg-brandLight');
    } else {
        ui.confirmKillSwitchBtn.classList.add('bg-brand/50', 'cursor-not-allowed');
        ui.confirmKillSwitchBtn.classList.remove('bg-brand', 'hover:bg-brandLight');
    }
}

function openKillSwitchModal() {
    ui.killSwitchInput.value = '';
    updateKillSwitchValidation();
    openModal(ui.killSwitchModal);
    setTimeout(() => ui.killSwitchInput.focus(), 20);
}

function resetGenerationVisualsAfterAbort() {
    state.isGenerating = false;
    state.judgeInFlightByPrompt = {};
    ui.judgeLoadingOverlay.classList.add('hidden');
    ui.judgeExecutionState.classList.add('hidden');
    ui.judgeExecutionState.classList.remove('flex');
    updateStatus('Execution Aborted', false, false);
}

function abortActiveExecution() {
    if (!state.isGenerating) return;
    if (state.activeAbortController && !state.activeAbortController.signal.aborted) {
        state.activeAbortController.abort();
    }
    pushTerminalLog('SYSTEM', 'Kill switch activated. All pending requests aborted.');
    resetGenerationVisualsAfterAbort();
    closeModal(ui.killSwitchModal);
}

function registerPromptRow(promptId, rowElement) {
    if (!state.floating.observer) return;
    state.floating.rows.set(promptId, { rowElement, isIntersecting: true, ratio: 1 });
    state.floating.observer.observe(rowElement);
}

function clearFloatingRowRegistry() {
    if (state.floating.observer) {
        state.floating.rows.forEach(value => {
            state.floating.observer.unobserve(value.rowElement);
        });
    }
    state.floating.rows.clear();
    state.floating.activePromptId = null;
    ui.floatingActions.classList.remove('active');
    ui.floatingActions.classList.add('hidden');
}

function appendUserRow(text, promptId, isRestore = false) {
    const row = document.createElement('div');
    row.className = `prompt-row flex flex-col gap-1 w-full ${isRestore ? '' : 'animate-[fadeIn_0.3s_ease-out]'}`;
    row.dataset.promptId = promptId;
    row.innerHTML = `
        <div class="self-end bg-white border border-gray-200 px-4 py-3 md:px-5 md:py-3 rounded-none shadow-sm max-w-[85vw] md:max-w-2xl text-[14px] md:text-[15px] text-gray-800 break-words mb-1">
            ${escapeHtml(text).replace(/\n/g, '<br>')}
        </div>
        <div class="prompt-action-bar">
            <button class="prompt-icon-btn copy-btn" data-prompt-id="${promptId}" title="Copy Outputs">
                <i class="ri-file-copy-line"></i>
            </button>
            <button class="prompt-icon-btn performance performance-btn" data-prompt-id="${promptId}" title="View Performance">
                <i class="ri-bar-chart-box-line"></i>
            </button>
        </div>
    `;

    const copyBtn = row.querySelector('.copy-btn');
    const performanceBtn = row.querySelector('.performance-btn');
    copyBtn.addEventListener('click', () => copyAllOutputs(promptId, copyBtn));
    performanceBtn.addEventListener('click', () => openGodDashboard(promptId));

    ui.chatContainer.appendChild(row);
    registerPromptRow(promptId, row);
}

function createAIChip(model, container, promptId) {
    const chip = document.createElement('div');
    chip.className = 'ai-chip bg-white rounded-none animate-[fadeIn_0.4s_ease-out]';
    chip.innerHTML = `
        <div class="chip-header rounded-none">
            <span class="font-display font-semibold text-[13px] text-gray-800 tracking-wide">${escapeHtml(model.name)}</span>
            <span class="chip-status text-xs"><div class="typing-dots"><span>.</span><span>.</span><span>.</span></div></span>
        </div>
        <div class="chip-body prose prose-sm max-w-none text-gray-700 rounded-none">
            <div class="chip-body-text"></div>
            <div class="chip-fade rounded-none"></div>
        </div>
    `;

    chip.addEventListener('click', () => {
        const outputData = state.sessionOutputs[promptId]?.aiReplies?.[model.internalId];
        ui.modalModelName.textContent = model.name;
        ui.modalStatus.textContent = outputData ? 'Completed' : 'Generating...';
        ui.modalBody.innerHTML = outputData ? parseMarkdownSafe(outputData.text) : 'Loading...';
        openModal(ui.clickModal);
    });

    container.appendChild(chip);
    return chip;
}

function setChipCompletionState(chipDom, headerStatus, isError) {
    chipDom.classList.remove('chip-generating');
    if (isError) {
        chipDom.classList.add('chip-error');
        headerStatus.innerHTML = `<i class="ri-error-warning-line text-red-500"></i>`;
    } else {
        chipDom.classList.add('chip-completed');
        headerStatus.innerHTML = `<i class="ri-check-double-line text-brandGreen font-bold"></i>`;
    }
}

async function streamTextToUI(fullText, domElement, chipDom, headerStatus, isError) {
    let currentText = '';
    const chunkSize = isError ? fullText.length : 4;

    for (let index = 0; index < fullText.length; index += chunkSize) {
        currentText += fullText.substring(index, index + chunkSize);
        domElement.innerHTML = parseMarkdownSafe(currentText);
        if (!isError) await new Promise(resolve => setTimeout(resolve, 5));
    }
}

function copyAllOutputs(promptId, buttonElement = null) {
    const data = state.sessionOutputs[promptId];
    if (!data) return;

    let clipboardText = `PROMPT:\n${data.userText}\n\n=========================================\n\n`;
    Object.values(data.aiReplies).forEach(reply => {
        clipboardText += `[ MODEL: ${reply.name} ]\n${reply.text}\n\n-----------------------------------------\n\n`;
    });

    navigator.clipboard.writeText(clipboardText).then(() => {
        if (!buttonElement) return;
        const originalHtml = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="ri-check-line text-brandGreen"></i>`;
        setTimeout(() => {
            buttonElement.innerHTML = originalHtml;
        }, 1200);
    }).catch(error => {
        pushTerminalLog('SYSTEM', `Clipboard write failed: ${error.message}`);
    });
}

function rebuildChatUI() {
    Array.from(ui.chatContainer.children).forEach(child => {
        if (child.id !== 'emptyState') child.remove();
    });
    clearFloatingRowRegistry();

    const promptIds = getSortedPromptIds();
    if (promptIds.length === 0) {
        ui.emptyState.style.display = 'block';
        return;
    }

    ui.emptyState.style.display = 'none';
    promptIds.forEach(promptId => {
        const record = state.sessionOutputs[promptId];
        appendUserRow(record.userText, promptId, true);

        const gridRow = document.createElement('div');
        gridRow.className = 'ai-grid';
        ui.chatContainer.appendChild(gridRow);

        Object.entries(record.aiReplies).forEach(([modelId, reply]) => {
            const modelStub = { internalId: modelId, name: reply.name || modelId };
            const chip = createAIChip(modelStub, gridRow, promptId);
            const contentBody = chip.querySelector('.chip-body-text');
            const headerStatus = chip.querySelector('.chip-status');
            contentBody.innerHTML = parseMarkdownSafe(reply.text || '');

            const isError = String(reply.text || '').startsWith('**Error:**');
            setChipCompletionState(chip, headerStatus, isError);
        });
    });

    renderGlobalHistoryList();
    updateFloatingActionContext();
}

function initFloatingObserver() {
    if (state.floating.observer) return;
    state.floating.observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const promptId = entry.target.dataset.promptId;
            const row = state.floating.rows.get(promptId);
            if (!row) return;
            row.isIntersecting = entry.isIntersecting;
            row.ratio = entry.intersectionRatio;
        });
        updateFloatingActionContext();
    }, {
        root: ui.chatContainer,
        threshold: [0, 0.1, 0.5, 1]
    });

    ui.chatContainer.addEventListener('scroll', () => updateFloatingActionContext());
}

function updateFloatingActionContext() {
    const rowEntries = Array.from(state.floating.rows.entries());
    if (rowEntries.length === 0) {
        ui.floatingActions.classList.remove('active');
        ui.floatingActions.classList.add('hidden');
        state.floating.activePromptId = null;
        return;
    }

    rowEntries.sort((a, b) => getPromptSortNumber(a[0]) - getPromptSortNumber(b[0]));
    const containerRect = ui.chatContainer.getBoundingClientRect();

    let candidatePromptId = null;
    for (const [promptId, rowMeta] of rowEntries) {
        const rowRect = rowMeta.rowElement.getBoundingClientRect();
        if (rowRect.top <= containerRect.top + 6) {
            candidatePromptId = promptId;
        }
    }

    if (!candidatePromptId) {
        ui.floatingActions.classList.remove('active');
        ui.floatingActions.classList.add('hidden');
        state.floating.activePromptId = null;
        return;
    }

    state.floating.activePromptId = candidatePromptId;
    ui.floatingPerfBtn.dataset.promptId = candidatePromptId;
    ui.floatingCopyBtn.dataset.promptId = candidatePromptId;
    ui.floatingActions.classList.remove('hidden');
    ui.floatingActions.classList.add('active');
}

function getSelectedActiveModels() {
    const selectedIds = Array.from(ui.dynamicModelList.querySelectorAll('.arena-checkbox:checked')).map(cb => cb.value);
    const activeModels = selectedIds
        .map(id => getModelById(id))
        .filter(model => model && model.isActive);
    return activeModels;
}

function buildPayloadHistory(model, text) {
    const isContextOn = ui.contextToggle.checked;
    const historyArray = Array.isArray(state.modelHistories[model.internalId]) ? [...state.modelHistories[model.internalId]] : [];
    let payloadHistory = [];

    if (model.systemPrompt) payloadHistory.push({ role: 'system', content: model.systemPrompt });

    if (isContextOn) {
        const nextHistory = [...historyArray, { role: 'user', content: text }].slice(-6);
        updateModelHistory(model.internalId, () => nextHistory);
        payloadHistory = payloadHistory.concat(nextHistory);
    } else {
        const nextHistory = [{ role: 'user', content: text }];
        updateModelHistory(model.internalId, () => nextHistory);
        payloadHistory = payloadHistory.concat(nextHistory);
    }

    return payloadHistory;
}

async function processModelRequest(model, text, gridRow, promptId) {
    const chipDom = createAIChip(model, gridRow, promptId);
    const contentBody = chipDom.querySelector('.chip-body-text');
    const headerStatus = chipDom.querySelector('.chip-status');
    chipDom.classList.add('chip-generating');

    const reqStartTime = performance.now();
    const rawDevLogs = { reqUrl: '', payload: null, response: null, headers: {} };
    const payloadHistory = buildPayloadHistory(model, text);
    const requestSignal = hasActiveAbortSignal() ? state.activeAbortController.signal : undefined;

    let aiResponse = '';
    let isError = false;

    try {
        const result = await fetchAIAdapter(model, payloadHistory, rawDevLogs, { signal: requestSignal });
        aiResponse = String(result.text || '');

        if (ui.contextToggle.checked) {
            updateModelHistory(model.internalId, history => [...history, { role: 'assistant', content: aiResponse }].slice(-6));
        }

        const reqEndTime = performance.now();
        const latencyMs = reqEndTime - reqStartTime;
        const approxTokens = aiResponse.split(/\s+/).filter(Boolean).length * 1.33;
        const tokensPerSec = latencyMs > 0 ? (approxTokens / (latencyMs / 1000)).toFixed(1) : '0.0';

        updateSessionOutput(promptId, record => {
            record.aiReplies = {
                ...(record.aiReplies || {}),
                [model.internalId]: {
                    name: model.name,
                    text: aiResponse,
                    metrics: {
                        latency: latencyMs.toFixed(0),
                        tps: tokensPerSec,
                        approxTokens: Math.floor(approxTokens)
                    },
                    devLogs: rawDevLogs
                }
            };
            return record;
        });

        appendPromptLog(promptId, { type: 'model_success', modelId: model.internalId, latency: latencyMs.toFixed(0) });
        pushTerminalLog('MODEL', `[${promptId}] ${model.name} completed`, rawDevLogs);
    } catch (error) {
        isError = true;
        if (isAbortError(error)) {
            aiResponse = '**Aborted:** Request cancelled by kill switch.';
            appendPromptLog(promptId, { type: 'model_aborted', modelId: model.internalId });
            pushTerminalLog('MODEL', `[${promptId}] ${model.name} aborted by kill switch.`);
        } else {
            aiResponse = `**Error:** ${error.message}`;
            appendPromptLog(promptId, { type: 'model_error', modelId: model.internalId, error: error.message });
            pushTerminalLog('MODEL', `[${promptId}] ${model.name} failed: ${error.message}`, rawDevLogs);
        }

        updateSessionOutput(promptId, record => {
            record.aiReplies = {
                ...(record.aiReplies || {}),
                [model.internalId]: {
                    name: model.name,
                    text: aiResponse,
                    metrics: { latency: 0, tps: 0, approxTokens: 0 },
                    devLogs: rawDevLogs
                }
            };
            return record;
        });
    }

    await streamTextToUI(aiResponse, contentBody, chipDom, headerStatus, isError);
    setChipCompletionState(chipDom, headerStatus, isError);
}

async function handleSend() {
    const text = ui.userInput.value.trim();
    if (!text || state.isGenerating) return;

    const activeModels = getSelectedActiveModels();
    if (activeModels.length === 0) {
        alert('Select at least one active model in Active Arena.');
        return;
    }

    state.isGenerating = true;
    state.activeAbortController = new AbortController();
    ui.emptyState.style.display = 'none';
    ui.userInput.value = '';
    ui.userInput.style.height = 'auto';

    const promptId = `prompt-${state.promptCounter++}`;
    ensurePromptRecord(promptId);
    updateSessionOutput(promptId, record => {
        record.userText = text;
        record.createdAt = nowIso();
        record.initialJudgeIds = [...state.settings.activeJudgeIds];
        record.summary = defaultSummaryState();
        record.judgeSummaries = {};
        return record;
    });

    appendUserRow(text, promptId);
    const gridRow = document.createElement('div');
    gridRow.className = 'ai-grid';
    ui.chatContainer.appendChild(gridRow);
    ui.chatContainer.scrollTop = ui.chatContainer.scrollHeight;

    updateStatus(`Computing (${activeModels.length} models)...`, true);
    pushTerminalLog('SYSTEM', `[${promptId}] Prompt sent to ${activeModels.length} active model(s).`);

    try {
        await Promise.allSettled(activeModels.map(model => processModelRequest(model, text, gridRow, promptId)));
        saveChatsToStorage();
        renderGlobalHistoryList();
        updateStatus('All Models Complete', false, true);
        if (!state.activeAbortController?.signal.aborted) {
            await runAutoJudgePipeline(promptId);
        }
    } finally {
        state.isGenerating = false;
        if (!state.activeAbortController?.signal.aborted) {
            setTimeout(() => updateStatus('Ready', false, false), 1200);
        } else {
            updateStatus('Execution Aborted', false, false);
        }
        closeModal(ui.killSwitchModal);
        state.activeAbortController = null;
        saveChatsToStorage();
    }
}

function setJudgeLoadingState(promptId, isLoading) {
    if (isLoading) {
        state.judgeInFlightByPrompt[promptId] = (state.judgeInFlightByPrompt[promptId] || 0) + 1;
    } else {
        state.judgeInFlightByPrompt[promptId] = Math.max(0, (state.judgeInFlightByPrompt[promptId] || 0) - 1);
    }

    const inFlight = state.judgeInFlightByPrompt[promptId] || 0;
    const viewingSamePrompt = state.currentViewPromptId === promptId && !ui.performanceModal.classList.contains('hidden');
    if (viewingSamePrompt) {
        if (inFlight > 0) {
            ui.judgeLoadingOverlay.classList.remove('hidden');
            ui.judgeExecutionState.classList.remove('hidden');
            ui.judgeExecutionState.classList.add('flex');
        } else {
            ui.judgeLoadingOverlay.classList.add('hidden');
            ui.judgeExecutionState.classList.add('hidden');
            ui.judgeExecutionState.classList.remove('flex');
        }
    }
}

function autoHealJSON(text) {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Bad JSON: empty judge response.');
    }

    let cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/^\s*`+/, '')
        .replace(/`+\s*$/, '')
        .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('Bad JSON: no valid object boundaries found.');
    }

    cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    return JSON.parse(cleaned);
}

function normalizeJudgeScores(rawScores, aiReplies) {
    const normalized = {};
    const modelIds = Object.keys(aiReplies);

    modelIds.forEach(modelId => {
        const score = rawScores?.[modelId] || {};
        normalized[modelId] = {
            accuracy: toScore(score.accuracy),
            clarity: toScore(score.clarity),
            relevance: toScore(score.relevance),
            creativity: toScore(score.creativity),
            hallucination: Boolean(score.hallucination),
            unsafe: Boolean(score.unsafe),
            fact_error: Boolean(score.fact_error)
        };
    });

    return normalized;
}

function buildJudgeEvaluationPrompt(promptData) {
    let evalPrompt = `Evaluate the following AI responses against the exact human prompt.\n`;
    evalPrompt += `You MUST output ONLY valid JSON format. No markdown, no backticks, no explanations.\n`;
    evalPrompt += `Use exact Model IDs as keys. Scoring must be strict, fair, and unbiased.\n`;
    evalPrompt += `Penalize hallucinations, refusals, evasive answers, or missing requirements aggressively.\n`;
    evalPrompt += `Avoid unnecessary score ties. Rank outputs with clear separation using industry benchmarking standards.\n\n`;
    evalPrompt += `Exact Human Prompt: \"${promptData.userText}\"\n\nResponses to evaluate:\n`;

    Object.keys(promptData.aiReplies).forEach(modelId => {
        evalPrompt += `\n[Model ID: ${modelId}]\n${promptData.aiReplies[modelId].text}\n`;
    });

    evalPrompt += `\nOutput strictly in this JSON format:\n`;
    evalPrompt += `{\n`;
    evalPrompt += `  \"model_id_1\": { \"accuracy\": 0-100, \"clarity\": 0-100, \"relevance\": 0-100, \"creativity\": 0-100, \"hallucination\": true/false, \"unsafe\": true/false, \"fact_error\": true/false },\n`;
    evalPrompt += `  \"model_id_2\": { ... }\n`;
    evalPrompt += `}`;
    return evalPrompt;
}

async function runJudgeEvaluation(promptId, judgeId, options = { trigger: 'auto' }) {
    const promptData = state.sessionOutputs[promptId];
    const judgeModel = getModelById(judgeId);
    if (!promptData || !judgeModel) return { ok: false, error: 'Judge or prompt not found.' };

    setJudgeLoadingState(promptId, true);
    updateStatus(`Judge AI (${judgeModel.name}) evaluating...`, true);

    const isolatedJudgePrompt = state.settings.globalJudgePrompt;

    const rawJudgeLogs = {};
    try {
        const payloadHistory = [
            { role: 'system', content: isolatedJudgePrompt },
            { role: 'user', content: buildJudgeEvaluationPrompt(promptData) }
        ];

        const judgeResponse = await fetchAIAdapter(
            judgeModel,
            payloadHistory,
            rawJudgeLogs,
            { signal: hasActiveAbortSignal() ? state.activeAbortController.signal : undefined }
        );
        const healedJson = autoHealJSON(judgeResponse.text);
        const normalizedScores = normalizeJudgeScores(healedJson, promptData.aiReplies);

        updateSessionOutput(promptId, record => {
            record.judgeReports = {
                ...(record.judgeReports || {}),
                [judgeId]: {
                    judgeName: judgeModel.name,
                    scores: normalizedScores,
                    status: 'success',
                    parsedAt: nowIso(),
                    rawResponse: judgeResponse.text
                }
            };
            if (record.judgeFailures && record.judgeFailures[judgeId]) {
                const nextFailures = { ...record.judgeFailures };
                delete nextFailures[judgeId];
                record.judgeFailures = nextFailures;
            }
            return record;
        });

        appendPromptLog(promptId, { type: 'judge_success', judgeId, judgeName: judgeModel.name, trigger: options.trigger });
        pushTerminalLog('JUDGE', `[${promptId}] ${judgeModel.name} evaluation completed.`, rawJudgeLogs);
        saveChatsToStorage();
        return { ok: true };
    } catch (error) {
        if (isAbortError(error)) {
            updateSessionOutput(promptId, record => {
                record.judgeFailures = {
                    ...(record.judgeFailures || {}),
                    [judgeId]: {
                        judgeName: judgeModel.name,
                        status: 'Aborted',
                        error: 'Execution aborted by kill switch.',
                        failedAt: nowIso()
                    }
                };
                return record;
            });
            appendPromptLog(promptId, { type: 'judge_aborted', judgeId, judgeName: judgeModel.name, trigger: options.trigger });
            pushTerminalLog('JUDGE', `[${promptId}] ${judgeModel.name} evaluation aborted.`);
            saveChatsToStorage();
            return { ok: false, error: 'aborted' };
        }

        const readableError = extractApiErrorMessage(error?.responseData || error, error.message || 'Judge evaluation failed.');
        const isBadJson = /json|object|token/i.test(readableError);
        const failureStatus = isBadJson ? 'Failed (Bad JSON)' : 'Failed';
        updateSessionOutput(promptId, record => {
            record.judgeFailures = {
                ...(record.judgeFailures || {}),
                [judgeId]: {
                    judgeName: judgeModel.name,
                    status: failureStatus,
                    error: readableError,
                    failedAt: nowIso()
                }
            };
            record.judgeReports = {
                ...(record.judgeReports || {}),
                [judgeId]: {
                    judgeName: judgeModel.name,
                    status: 'failed',
                    failureType: failureStatus,
                    error: readableError,
                    parsedAt: nowIso(),
                    scores: {}
                }
            };
            return record;
        });
        appendPromptLog(promptId, { type: 'judge_failure', judgeId, judgeName: judgeModel.name, error: readableError, trigger: options.trigger });
        pushTerminalLog('JUDGE', `[${promptId}] ${judgeModel.name} evaluation failed: ${readableError}`, rawJudgeLogs);
        saveChatsToStorage();
        return { ok: false, error: readableError };
    } finally {
        setJudgeLoadingState(promptId, false);
        if (state.currentViewPromptId === promptId) {
            refreshPerformanceModal(promptId);
        }
    }
}

async function runAutoJudgePipeline(promptId) {
    const judges = getCurrentActiveJudgeModels();
    if (judges.length === 0) {
        updateSessionOutput(promptId, record => {
            record.summary = {
                ...defaultSummaryState(),
                status: 'idle',
                text: 'No active judges configured. Add at least one judge to generate scorecards and summary.'
            };
            return record;
        });
        saveChatsToStorage();
        return;
    }

    updateStatus(`Judge AI running (${judges.length})...`, true);
    await Promise.allSettled(judges.map(judge => runJudgeEvaluation(promptId, judge.internalId, { trigger: 'auto' })));
    if (state.activeAbortController?.signal.aborted) return;
    await generateAISummary(promptId, true);
    saveChatsToStorage();
}

function getRetryCandidates(promptId) {
    if (!promptId) return [];
    const promptData = state.sessionOutputs[promptId];
    if (!promptData) return [];

    const candidatesById = new Map();
    const activeJudgeIds = getCurrentActiveJudgeModels().map(model => model.internalId);

    activeJudgeIds.forEach(judgeId => {
        const hasSuccess = Boolean(promptData.judgeReports[judgeId]);
        const failure = promptData.judgeFailures[judgeId];
        const addedLater = !promptData.initialJudgeIds.includes(judgeId);

        if (failure?.status === 'Failed (Bad JSON)') {
            candidatesById.set(judgeId, 'Failed (Bad JSON)');
            return;
        }

        if (!hasSuccess && addedLater) {
            candidatesById.set(judgeId, 'Added After Initial Run');
            return;
        }

        if (!hasSuccess && !promptData.initialJudgeIds.includes(judgeId)) {
            candidatesById.set(judgeId, 'Not Evaluated');
        }
    });

    Object.entries(promptData.judgeFailures || {}).forEach(([judgeId, failure]) => {
        if (failure.status === 'Failed (Bad JSON)') {
            candidatesById.set(judgeId, 'Failed (Bad JSON)');
        }
    });

    return Array.from(candidatesById.entries()).map(([judgeId, reason]) => {
        const judgeModel = getModelById(judgeId);
        return {
            judgeId,
            reason,
            name: judgeModel ? judgeModel.name : judgeId
        };
    });
}

function updateRetryControls(promptId) {
    const candidates = getRetryCandidates(promptId);
    if (candidates.length === 0) {
        ui.retryJudgeSelect.innerHTML = `<option value="">No retry required</option>`;
        ui.retryJudgeBtn.disabled = true;
        ui.retryJudgeBtn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    ui.retryJudgeSelect.innerHTML = candidates.map(candidate => {
        return `<option value="${candidate.judgeId}">${escapeHtml(candidate.name)} - ${escapeHtml(candidate.reason)}</option>`;
    }).join('');

    ui.retryJudgeBtn.disabled = false;
    ui.retryJudgeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

async function handleRetryJudge() {
    const promptId = state.currentViewPromptId;
    const judgeId = ui.retryJudgeSelect.value;
    if (!promptId || !judgeId) return;

    const originalHtml = ui.retryJudgeBtn.innerHTML;
    ui.retryJudgeBtn.disabled = true;
    ui.retryJudgeBtn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Retrying...`;
    try {
        await runJudgeEvaluation(promptId, judgeId, { trigger: 'retry' });
        await generateAISummary(promptId, true);
        refreshPerformanceModal(promptId);
    } finally {
        ui.retryJudgeBtn.innerHTML = originalHtml;
        updateRetryControls(promptId);
    }
}

function renderBenchmarkTab(promptData) {
    ui.perfSpeedChart.innerHTML = '';
    ui.perfLatencyChart.innerHTML = '';

    const modelsData = Object.values(promptData.aiReplies);
    if (modelsData.length === 0) return;

    const maxTps = Math.max(...modelsData.map(item => Number(item.metrics?.tps) || 0), 0);
    const maxLatency = Math.max(...modelsData.map(item => Number(item.metrics?.latency) || 0), 0);

    modelsData.forEach(item => {
        const tps = Number(item.metrics?.tps) || 0;
        const latency = Number(item.metrics?.latency) || 0;
        const speedPercent = maxTps > 0 ? (tps / maxTps) * 100 : 0;
        const latencyPercent = maxLatency > 0 ? (latency / maxLatency) * 100 : 0;

        ui.perfSpeedChart.innerHTML += `
            <div>
                <div class="flex justify-between text-[11px] font-bold text-gray-700 mb-1">
                    <span class="truncate">${escapeHtml(item.name)}</span><span>${tps} TPS</span>
                </div>
                <div class="perf-bar-container"><div class="perf-bar-fill" style="width:0%" data-target-width="${speedPercent}%"></div></div>
            </div>
        `;

        ui.perfLatencyChart.innerHTML += `
            <div>
                <div class="flex justify-between text-[11px] font-bold text-gray-700 mb-1">
                    <span class="truncate">${escapeHtml(item.name)}</span><span>${(latency / 1000).toFixed(2)}s</span>
                </div>
                <div class="perf-bar-container"><div class="perf-bar-fill bg-gray-600" style="width:0%" data-target-width="${latencyPercent}%"></div></div>
            </div>
        `;
    });

    setTimeout(() => {
        document.querySelectorAll('.perf-bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-target-width');
        });
    }, 80);
}

function clearJudgeTabs() {
    ui.qualityTableBody.innerHTML = '';
    ui.failureGrid.innerHTML = '';
}

function renderJudgeTabs(judgeData, promptData) {
    clearJudgeTabs();
    Object.keys(judgeData.scores).forEach(modelId => {
        const scores = judgeData.scores[modelId];
        const modelName = promptData.aiReplies[modelId]?.name || 'Unknown Model';

        ui.qualityTableBody.innerHTML += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-3 font-bold text-darkText border-r border-gray-200">${escapeHtml(modelName)}</td>
                <td class="p-3 font-mono text-center border-r border-gray-200 ${scores.accuracy > 80 ? 'text-brandGreen' : (scores.accuracy < 60 ? 'text-brand' : 'text-orange-500')}">${scores.accuracy}</td>
                <td class="p-3 font-mono text-center border-r border-gray-200">${scores.clarity}</td>
                <td class="p-3 font-mono text-center border-r border-gray-200">${scores.relevance}</td>
                <td class="p-3 font-mono text-center">${scores.creativity}</td>
            </tr>
        `;

        const hasFailure = scores.hallucination || scores.unsafe || scores.fact_error;
        ui.failureGrid.innerHTML += `
            <div class="border ${hasFailure ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'} p-4 rounded-none">
                <h4 class="font-bold text-sm text-darkText mb-3 border-b pb-2 ${hasFailure ? 'border-red-200' : 'border-gray-100'}">${escapeHtml(modelName)}</h4>
                <div class="space-y-2 text-xs font-mono">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Hallucination:</span>
                        <span class="px-2 py-0.5 ${scores.hallucination ? 'bg-red-200 text-red-800 font-bold' : 'bg-green-100 text-green-700'}">${scores.hallucination ? 'DETECTED' : 'PASS'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Unsafe Output:</span>
                        <span class="px-2 py-0.5 ${scores.unsafe ? 'bg-red-200 text-red-800 font-bold' : 'bg-green-100 text-green-700'}">${scores.unsafe ? 'DETECTED' : 'PASS'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Fact Error:</span>
                        <span class="px-2 py-0.5 ${scores.fact_error ? 'bg-orange-200 text-orange-800 font-bold' : 'bg-green-100 text-green-700'}">${scores.fact_error ? 'DETECTED' : 'PASS'}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

function renderJudgeFailureBox(judgeName, errorMessage, statusLabel = 'Failed') {
    clearJudgeTabs();
    ui.qualityTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="p-2">
                <div class="border-2 border-red-300 bg-red-50 p-4">
                    <p class="text-[11px] uppercase tracking-wider font-bold text-red-700 mb-1">Judge API Failure</p>
                    <p class="text-sm font-semibold text-red-800 mb-2">${escapeHtml(judgeName)} - ${escapeHtml(statusLabel)}</p>
                    <p class="text-sm font-mono text-red-900 break-words">${escapeHtml(errorMessage || 'No error details returned by API.')}</p>
                </div>
            </td>
        </tr>
    `;
    ui.failureGrid.innerHTML = `
        <div class="border border-red-300 bg-red-50 p-4">
            <h4 class="font-bold text-sm text-red-800 mb-2">Judge API Error</h4>
            <p class="text-xs font-mono text-red-900 break-words">${escapeHtml(errorMessage || 'No error details returned by API.')}</p>
        </div>
    `;
}

function renderSummaryTab(promptData) {
    const selectedJudgeId = ui.judgeReportSwitcher.value;
    if (!selectedJudgeId) {
        ui.aiSummaryContent.innerHTML = `<div class="border border-gray-200 bg-white p-4 text-sm text-gray-500 italic">Select a judge from the global switcher to view its AI Summary.</div>`;
        return;
    }

    const selectedJudge = getModelById(selectedJudgeId);
    const selectedJudgeName = selectedJudge?.name || selectedJudgeId;
    const selectedSummary = promptData.judgeSummaries?.[selectedJudgeId];

    if (!selectedSummary) {
        ui.aiSummaryContent.innerHTML = `<div class="border border-gray-200 bg-white p-4 text-sm text-gray-500 italic">No AI summary generated yet for ${escapeHtml(selectedJudgeName)}.</div>`;
        return;
    }

    if (selectedSummary.status === 'loading') {
        ui.aiSummaryContent.innerHTML = `<div class="flex items-center gap-2 text-xs font-mono text-brand"><span class="premium-spinner-small inline-flex w-4 h-4"></span><span>Generating AI Summary for ${escapeHtml(selectedJudgeName)}...</span></div>`;
        return;
    }

    if (selectedSummary.status === 'failed' || selectedSummary.status === 'aborted') {
        const errorText = selectedSummary.error || 'AI Summary generation failed.';
        ui.aiSummaryContent.innerHTML = `
            <div class="border-2 border-red-300 bg-red-50 p-4">
                <p class="text-[11px] uppercase tracking-wider font-bold text-red-700 mb-1">AI Summary Error</p>
                <p class="text-sm font-semibold text-red-800 mb-2">Judge: ${escapeHtml(selectedJudgeName)}</p>
                <p class="text-sm font-mono text-red-900 break-words">${escapeHtml(errorText)}</p>
            </div>
        `;
        return;
    }

    if (selectedSummary.status === 'ready' && selectedSummary.text) {
        ui.aiSummaryContent.innerHTML = `
            <article class="border border-gray-200 bg-white p-3">
                <h4 class="font-display font-bold text-sm text-darkText mb-2">Verdict by ${escapeHtml(selectedJudgeName)}</h4>
                <div class="prose prose-sm max-w-none text-gray-700">${parseMarkdownSafe(selectedSummary.text)}</div>
            </article>
        `;
        return;
    }

    ui.aiSummaryContent.innerHTML = `<div class="border border-gray-200 bg-white p-4 text-sm text-gray-500 italic">AI Summary for ${escapeHtml(selectedJudgeName)} is not ready yet.</div>`;
}

async function generateAISummary(promptId, force = false) {
    const promptData = state.sessionOutputs[promptId];
    if (!promptData) return;

    const successfulJudgeIds = Object.keys(promptData.judgeReports || {});
    if (successfulJudgeIds.length === 0) {
        updateSessionOutput(promptId, record => {
            record.judgeSummaries = {};
            record.summary = {
                ...defaultSummaryState(),
                status: 'idle',
                text: 'No successful judge reports available yet.'
            };
            return record;
        });
        return;
    }

    const existingSummaries = promptData.judgeSummaries || {};
    if (!force) {
        const allAlreadyReady = successfulJudgeIds.every(judgeId => {
            const summary = existingSummaries[judgeId];
            return summary && summary.status === 'ready' && summary.text;
        });
        if (allAlreadyReady) return;
    }

    updateSessionOutput(promptId, record => {
        const nextSummaries = { ...(record.judgeSummaries || {}) };
        successfulJudgeIds.forEach(judgeId => {
            if (!force && nextSummaries[judgeId]?.status === 'ready' && nextSummaries[judgeId]?.text) return;
            nextSummaries[judgeId] = {
                ...(nextSummaries[judgeId] || {}),
                status: 'loading',
                text: '',
                error: '',
                updatedAt: nowIso()
            };
        });
        record.judgeSummaries = nextSummaries;
        record.summary = { ...defaultSummaryState(), status: 'loading' };
        return record;
    });

    if (state.currentViewPromptId === promptId) renderSummaryTab(state.sessionOutputs[promptId]);

    await Promise.allSettled(successfulJudgeIds.map(async judgeId => {
        const judgeModel = getModelById(judgeId);
        if (!judgeModel) {
            updateSessionOutput(promptId, record => {
                record.judgeSummaries = {
                    ...(record.judgeSummaries || {}),
                    [judgeId]: {
                        status: 'failed',
                        text: '',
                        error: 'Judge model not found.',
                        updatedAt: nowIso(),
                        judgeName: judgeId
                    }
                };
                return record;
            });
            return;
        }

        const scorePayload = state.sessionOutputs[promptId]?.judgeReports?.[judgeId]?.scores || {};
        const mentionTargets = Object.keys(scorePayload).map(modelInternalId => {
            const mappedModel = getModelById(modelInternalId);
            const resolvedName = mappedModel?.modelId || mappedModel?.name || promptData.aiReplies?.[modelInternalId]?.modelId || promptData.aiReplies?.[modelInternalId]?.name || modelInternalId;
            return {
                modelInternalId,
                resolvedName,
                mentionToken: `@[${resolvedName}]`
            };
        });
        if (mentionTargets.length === 0) {
            updateSessionOutput(promptId, record => {
                record.judgeSummaries = {
                    ...(record.judgeSummaries || {}),
                    [judgeId]: {
                        status: 'failed',
                        text: '',
                        error: 'No scorecard rows available for summary generation.',
                        updatedAt: nowIso(),
                        judgeName: judgeModel.name
                    }
                };
                return record;
            });
            return;
        }

        const modelMentionList = mentionTargets.map(item => item.mentionToken).join(', ');
        const normalizedScorecard = mentionTargets.reduce((acc, item) => ({
            ...acc,
            [item.resolvedName]: scorePayload[item.modelInternalId]
        }), {});
        const rawLog = {};

        try {
            const summaryPrompt = [
                {
                    role: 'system',
                    content: `${state.settings.globalJudgePrompt}\n\nYou are a strict, objective AI evaluator.`
                },
                {
                    role: 'user',
                    content: `You are a strict, objective AI evaluator. Based strictly on the provided JSON scorecard for the prompt '${promptData.userText}', write a short 3-line evaluation. \nRULES:\n1. You MUST start every point with exactly '@[Model_ID]'.\n2. Do NOT invent information, topics, or talk about irrelevant concepts. Keep it strictly about accuracy, clarity, and relevance.\n3. Do not output any intro or outro text. Just the '@[Model_ID]' followed by its 1-line review.\n\nAllowed Model_ID values: ${modelMentionList}\n\nJSON scorecard:\n${JSON.stringify(normalizedScorecard)}`
                }
            ];

            const response = await fetchAIAdapter(
                judgeModel,
                summaryPrompt,
                rawLog,
                { signal: hasActiveAbortSignal() ? state.activeAbortController.signal : undefined }
            );

            updateSessionOutput(promptId, record => {
                record.judgeSummaries = {
                    ...(record.judgeSummaries || {}),
                    [judgeId]: {
                        status: 'ready',
                        text: String(response.text || '').trim(),
                        error: '',
                        updatedAt: nowIso(),
                        judgeName: judgeModel.name
                    }
                };
                return record;
            });
            appendPromptLog(promptId, { type: 'summary_success', modelId: judgeModel.internalId });
            pushTerminalLog('SUMMARY', `[${promptId}] Judge summary generated by ${judgeModel.name}.`, rawLog);
        } catch (error) {
            const status = isAbortError(error) ? 'aborted' : 'failed';
            updateSessionOutput(promptId, record => {
                record.judgeSummaries = {
                    ...(record.judgeSummaries || {}),
                    [judgeId]: {
                        status,
                        text: '',
                        error: isAbortError(error) ? 'Execution aborted by kill switch.' : error.message,
                        updatedAt: nowIso(),
                        judgeName: judgeModel.name
                    }
                };
                return record;
            });
            if (!isAbortError(error)) {
                appendPromptLog(promptId, { type: 'summary_failure', error: error.message, modelId: judgeModel.internalId });
                pushTerminalLog('SUMMARY', `[${promptId}] Judge summary failed for ${judgeModel.name}: ${error.message}`, rawLog);
            } else {
                pushTerminalLog('SUMMARY', `[${promptId}] Judge summary aborted for ${judgeModel.name}.`);
            }
        }
    }));

    updateSessionOutput(promptId, record => {
        record.summary = {
            ...defaultSummaryState(),
            status: 'ready',
            text: 'Judge summaries generated.',
            updatedAt: nowIso()
        };
        return record;
    });
    saveChatsToStorage();
    if (state.currentViewPromptId === promptId) {
        refreshPerformanceModal(promptId);
    }
}

function refreshJudgeReportSwitcher(promptData) {
    const reportIds = Object.keys(promptData.judgeReports || {});
    const activeJudgeIds = getCurrentActiveJudgeModels().map(model => model.internalId);
    const uniqueIds = Array.from(new Set([...reportIds, ...activeJudgeIds]));

    if (uniqueIds.length === 0) {
        ui.judgeMissingWarning.classList.remove('hidden');
        ui.qualityScoreboardContainer.classList.add('hidden');
        ui.judgeReportSwitcher.innerHTML = `<option value="">No judges available</option>`;
        clearJudgeTabs();
        return;
    }

    ui.judgeMissingWarning.classList.add('hidden');
    ui.qualityScoreboardContainer.classList.remove('hidden');

    const currentSelected = ui.judgeReportSwitcher.value;
    ui.judgeReportSwitcher.innerHTML = uniqueIds.map(judgeId => {
        const judgeModel = getModelById(judgeId);
        const judgeName = judgeModel ? judgeModel.name : judgeId;
        return `<option value="${judgeId}">${escapeHtml(judgeName)}</option>`;
    }).join('');

    if (uniqueIds.includes(currentSelected)) {
        ui.judgeReportSwitcher.value = currentSelected;
    } else {
        ui.judgeReportSwitcher.value = uniqueIds[0];
    }
}

function syncSelectedJudgeViews(promptData) {
    const selectedJudgeId = ui.judgeReportSwitcher.value;
    const selectedReport = selectedJudgeId ? promptData.judgeReports?.[selectedJudgeId] : null;
    if (selectedReport?.status === 'failed') {
        const selectedJudgeName = getModelById(selectedJudgeId)?.name || selectedReport.judgeName || selectedJudgeId;
        renderJudgeFailureBox(selectedJudgeName, selectedReport.error, selectedReport.failureType || 'Failed');
    } else {
        renderSelectedJudgeReport(promptData);
    }
    renderSummaryTab(promptData);
}

function renderSelectedJudgeReport(promptData) {
    const selectedJudgeId = ui.judgeReportSwitcher.value;
    if (!selectedJudgeId) {
        clearJudgeTabs();
        return;
    }

    const report = promptData.judgeReports?.[selectedJudgeId];
    const failure = promptData.judgeFailures?.[selectedJudgeId];
    const selectedJudgeModel = getModelById(selectedJudgeId);
    const selectedJudgeName = selectedJudgeModel?.name || report?.judgeName || failure?.judgeName || selectedJudgeId;

    if (report?.status === 'failed') {
        renderJudgeFailureBox(selectedJudgeName, report.error, report.failureType || 'Failed');
        return;
    }

    if (report && report.status !== 'failed') {
        renderJudgeTabs(report, promptData);
        return;
    }

    clearJudgeTabs();
    if (failure) {
        renderJudgeFailureBox(selectedJudgeName, failure.error, failure.status || 'Failed');
        return;
    }

    const message = 'No report found for this judge yet.';
    ui.qualityTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">${escapeHtml(message)}</td></tr>`;
}

function setPerformanceTab(tabId) {
    document.querySelectorAll('#perfTabs .tab-btn').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('block');
        content.classList.add('hidden');
    });

    const targetButton = document.querySelector(`#perfTabs .tab-btn[data-tab="${tabId}"]`);
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (!targetButton || !targetTab) return;

    targetButton.classList.add('active');
    targetTab.classList.remove('hidden');
    targetTab.classList.add('block');
}

function refreshPerformanceModal(promptId) {
    const promptData = state.sessionOutputs[promptId];
    if (!promptData) return;

    renderBenchmarkTab(promptData);
    refreshJudgeReportSwitcher(promptData);
    syncSelectedJudgeViews(promptData);
    updateRetryControls(promptId);
}

function openGodDashboard(promptId) {
    const promptData = state.sessionOutputs[promptId];
    if (!promptData) return;

    state.currentViewPromptId = promptId;
    ui.perfPromptIdDisplay.textContent = `Prompt ID: ${promptId}`;
    openModal(ui.performanceModal);
    setPerformanceTab('benchmark');
    refreshPerformanceModal(promptId);

    const inFlight = state.judgeInFlightByPrompt[promptId] || 0;
    if (inFlight > 0) {
        ui.judgeLoadingOverlay.classList.remove('hidden');
        ui.judgeExecutionState.classList.remove('hidden');
        ui.judgeExecutionState.classList.add('flex');
    } else {
        ui.judgeLoadingOverlay.classList.add('hidden');
        ui.judgeExecutionState.classList.add('hidden');
        ui.judgeExecutionState.classList.remove('flex');
    }

    ui.exportPerfJsonBtn.onclick = () => {
        const exportData = JSON.stringify(promptData, null, 2);
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(exportData)}`;
        const downloadLink = document.createElement('a');
        downloadLink.setAttribute('href', dataStr);
        downloadLink.setAttribute('download', `Arena_Report_${promptId}.json`);
        downloadLink.click();
    };
}

function clearArenaChat() {
    Array.from(ui.chatContainer.children).forEach(child => {
        if (child.id !== 'emptyState') child.remove();
    });
    ui.emptyState.style.display = 'block';
    state.promptCounter = 0;
    setSessionOutputs({});
    setModelHistories(prevHistories => {
        const next = {};
        Object.keys(prevHistories).forEach(key => {
            next[key] = [];
        });
        return next;
    });
    saveChatsToStorage();
    renderGlobalHistoryList();
    clearFloatingRowRegistry();
    updateStatus('Arena Cleared', false, true);
}

function handleOutsideModalClose(modal, event) {
    if (event.target === modal) closeModal(modal);
}

function setupEventListeners() {
    ui.manageModelsBtn.addEventListener('click', () => openModal(ui.manageModelsModal));
    ui.closeManageModalBtn.addEventListener('click', () => closeModal(ui.manageModelsModal));
    ui.addNewModelTrigger.addEventListener('click', () => resetModelForm());
    ui.saveModelBtn.addEventListener('click', event => {
        event.preventDefault();
        saveModelFromForm();
    });
    ui.deleteModelBtn.addEventListener('click', event => {
        event.preventDefault();
        deleteModelFromForm();
    });

    ui.importModelsBtn.addEventListener('click', () => ui.importJsonFile.click());
    ui.importJsonFile.addEventListener('change', importModelsFromJson);
    ui.exportModelsBtn.addEventListener('click', exportModelsAsJson);

    ui.allowDuplicatesToggle.addEventListener('change', event => {
        state.settings.allowDuplicates = event.target.checked;
        saveSettingsToStorage();
    });

    ui.configArchitecture.addEventListener('change', event => {
        const provider = event.target.value;
        if (provider === 'custom') {
            ui.customEndpointGroup.classList.remove('hidden');
            ui.configCustomUrl.setAttribute('required', 'true');
            return;
        }
        ui.customEndpointGroup.classList.add('hidden');
        ui.configCustomUrl.removeAttribute('required');
    });

    ui.configUseAsJudge.addEventListener('change', event => {
        if (!event.target.checked) return;
        const editingId = ui.editModelInternalId.value;
        if (!canAssignJudgeRole(editingId)) {
            alert(`Maximum ${MAX_GLOBAL_JUDGES} models can be checked as "Use as Judge AI".`);
            event.target.checked = false;
        }
    });

    ui.arenaModalBtn.addEventListener('click', () => openModal(ui.arenaModal));
    ui.closeArenaModalBtn.addEventListener('click', () => closeModal(ui.arenaModal));

    ui.globalSystemPrompt.addEventListener('input', event => {
        state.settings.globalJudgePrompt = event.target.value;
        saveSettingsToStorage();
    });

    ui.selectAllModelsBtn.addEventListener('click', () => {
        ui.dynamicModelList.querySelectorAll('.arena-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        onArenaSelectionChange();
    });

    ui.deselectAllModelsBtn.addEventListener('click', () => {
        ui.dynamicModelList.querySelectorAll('.arena-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        onArenaSelectionChange();
    });

    ui.sendBtn.addEventListener('click', () => handleSend());
    ui.userInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    });
    ui.userInput.addEventListener('input', function onInputResize() {
        this.style.height = 'auto';
        this.style.height = `${this.scrollHeight}px`;
        if (this.value.trim() === '') this.style.height = 'auto';
    });

    ui.closeModalBtn.addEventListener('click', () => closeModal(ui.clickModal));
    ui.closePerfModalBtn.addEventListener('click', () => closeModal(ui.performanceModal));
    ui.closeHistoryModalBtn.addEventListener('click', () => closeModal(ui.globalHistoryModal));

    ui.historyBtn.addEventListener('click', () => {
        renderGlobalHistoryList();
        openModal(ui.globalHistoryModal);
    });

    ui.globalHistoryList.addEventListener('click', event => {
        const button = event.target.closest('[data-history-prompt-id]');
        if (!button) return;
        const promptId = button.dataset.historyPromptId;
        closeModal(ui.globalHistoryModal);
        setTimeout(() => openGodDashboard(promptId), 230);
    });

    ui.retryJudgeBtn.addEventListener('click', () => handleRetryJudge());
    ui.judgeReportSwitcher.addEventListener('change', () => {
        if (!state.currentViewPromptId) return;
        const promptData = state.sessionOutputs[state.currentViewPromptId];
        if (!promptData) return;
        syncSelectedJudgeViews(promptData);
    });

    ui.perfTabs.addEventListener('click', event => {
        const button = event.target.closest('[data-tab]');
        if (!button) return;
        setPerformanceTab(button.dataset.tab);
    });

    ui.performanceModal.addEventListener('click', event => {
        if (event.target.closest('.addJudgeShortcutBtn')) {
            closeModal(ui.performanceModal);
            setTimeout(() => openModal(ui.manageModelsModal), 200);
        }
    });

    ui.newChatBtn.addEventListener('click', () => openModal(ui.newChatWarningModal));
    ui.cancelNewChatBtn.addEventListener('click', () => closeModal(ui.newChatWarningModal));
    ui.confirmNewChatBtn.addEventListener('click', () => {
        clearArenaChat();
        closeModal(ui.newChatWarningModal);
    });

    ui.killSwitchInput.addEventListener('input', () => updateKillSwitchValidation());
    ui.cancelKillSwitchBtn.addEventListener('click', () => closeModal(ui.killSwitchModal));
    ui.confirmKillSwitchBtn.addEventListener('click', () => abortActiveExecution());

    ui.terminalToggleBtn.addEventListener('click', () => {
        if (ui.terminalPanel.classList.contains('open')) closeTerminalPanel();
        else openTerminalPanel();
    });
    ui.closeTerminalBtn.addEventListener('click', () => closeTerminalPanel());

    ui.floatingPerfBtn.addEventListener('click', () => {
        const promptId = ui.floatingPerfBtn.dataset.promptId;
        if (promptId) openGodDashboard(promptId);
    });
    ui.floatingCopyBtn.addEventListener('click', () => {
        const promptId = ui.floatingCopyBtn.dataset.promptId;
        if (promptId) copyAllOutputs(promptId, ui.floatingCopyBtn);
    });

    ui.manageModelsModal.addEventListener('click', event => handleOutsideModalClose(ui.manageModelsModal, event));
    ui.arenaModal.addEventListener('click', event => handleOutsideModalClose(ui.arenaModal, event));
    ui.performanceModal.addEventListener('click', event => handleOutsideModalClose(ui.performanceModal, event));
    ui.globalHistoryModal.addEventListener('click', event => handleOutsideModalClose(ui.globalHistoryModal, event));
    ui.newChatWarningModal.addEventListener('click', event => handleOutsideModalClose(ui.newChatWarningModal, event));
    ui.clickModal.addEventListener('click', event => handleOutsideModalClose(ui.clickModal, event));
    ui.killSwitchModal.addEventListener('click', event => handleOutsideModalClose(ui.killSwitchModal, event));

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!state.isGenerating) return;
        if (!ui.killSwitchModal.classList.contains('hidden')) return;
        openKillSwitchModal();
    });
}

async function fetchAIAdapter(modelConfig, history, rawLogData = {}, requestOptions = {}) {
    rawLogData.reqUrl = modelConfig.customUrl || 'Provider Default';
    const finalHistory = [...history];

    switch (modelConfig.provider) {
        case 'google':
            return fetchGoogle(modelConfig, finalHistory, rawLogData, requestOptions);
        case 'openai':
            return fetchOpenAICompatible(modelConfig, finalHistory, 'https://api.openai.com/v1/chat/completions', rawLogData, requestOptions);
        case 'anthropic':
            return fetchAnthropic(modelConfig, finalHistory, rawLogData, requestOptions);
        case 'custom':
            return fetchOpenAICompatible(modelConfig, finalHistory, modelConfig.customUrl, rawLogData, requestOptions);
        default:
            throw new Error('Unknown Architecture selected.');
    }
}

async function fetchGoogle(modelData, history, rawLogData, requestOptions = {}) {
    const apiVersion = modelData.modelId.includes('3.1') ? 'v1alpha' : 'v1beta';
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelData.modelId}:generateContent?key=${modelData.apiKey}`;

    let systemInstruction = null;
    const userContents = [];
    history.forEach(message => {
        if (message.role === 'system') {
            systemInstruction = { parts: [{ text: message.content }] };
            return;
        }
        userContents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] });
    });

    const payload = { contents: userContents };
    if (systemInstruction) payload.system_instruction = systemInstruction;

    rawLogData.reqUrl = url;
    rawLogData.payload = payload;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: requestOptions.signal
    });

    rawLogData.headers = Object.fromEntries(response.headers.entries());
    const data = await response.json();
    rawLogData.response = data;

    if (!response.ok) {
        const apiError = new Error(extractApiErrorMessage(data, 'Google API Error'));
        apiError.responseData = data;
        apiError.status = response.status;
        throw apiError;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Google response did not include text.');
    return { text };
}

async function fetchOpenAICompatible(modelData, history, defaultUrl, rawLogData, requestOptions = {}) {
    let endpoint = defaultUrl;
    if (modelData.provider === 'openai' && modelData.apiKey.startsWith('gsk_')) {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    }

    rawLogData.reqUrl = endpoint;
    const messages = history.map(message => ({
        role: message.role === 'assistant' ? 'assistant' : message.role,
        content: message.content
    }));
    const payload = { model: modelData.modelId, messages, max_tokens: 2000 };
    rawLogData.payload = payload;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${modelData.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: requestOptions.signal
    });

    rawLogData.headers = Object.fromEntries(response.headers.entries());
    const data = await response.json();
    rawLogData.response = data;

    if (!response.ok) {
        const apiError = new Error(extractApiErrorMessage(data, 'OpenAI-compatible API Error'));
        apiError.responseData = data;
        apiError.status = response.status;
        throw apiError;
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI-compatible response did not include text.');
    return { text };
}

async function fetchAnthropic(modelData, history, rawLogData, requestOptions = {}) {
    const url = 'https://api.anthropic.com/v1/messages';
    let systemPrompt = '';
    const userContents = [];

    history.forEach(message => {
        if (message.role === 'system') {
            systemPrompt += `${message.content}\n`;
            return;
        }
        userContents.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content });
    });

    const payload = { model: modelData.modelId, messages: userContents, max_tokens: 2000 };
    if (systemPrompt.trim()) payload.system = systemPrompt.trim();

    rawLogData.reqUrl = url;
    rawLogData.payload = payload;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': modelData.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerously-allow-browser': 'true'
        },
        body: JSON.stringify(payload),
        signal: requestOptions.signal
    });

    rawLogData.headers = Object.fromEntries(response.headers.entries());
    const data = await response.json();
    rawLogData.response = data;

    if (!response.ok) {
        const apiError = new Error(extractApiErrorMessage(data, 'Anthropic API Error'));
        apiError.responseData = data;
        apiError.status = response.status;
        throw apiError;
    }
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error('Anthropic response did not include text.');
    return { text };
}

function init() {
    loadSettingsFromStorage();
    loadModelsFromStorage();
    sanitizeSelectionSettings();
    saveSettingsToStorage();
    loadChatsFromStorage();
    hydrateSettingsUI();
    buildActiveArenaList();
    buildActiveJudgeList();
    buildManageModelsSidebar();
    initFloatingObserver();
    rebuildChatUI();
    renderGlobalHistoryList();
    resetModelForm();
    setupEventListeners();
    pushTerminalLog('SYSTEM', 'Engine initialized.');
    if (Object.keys(state.sessionOutputs).length > 0) ui.emptyState.style.display = 'none';
}

window.copyAllOutputs = copyAllOutputs;
window.openGodDashboard = openGodDashboard;
window.autoHealJSON = autoHealJSON;

init();


// --- FOUNDER HOVER EFFECT LOGIC ---
const brandHover = document.getElementById('brandLogoHover');
const founderOverlay = document.getElementById('founderOverlay');
const founderImage = document.getElementById('founderImage');

if (brandHover && founderOverlay) {
    brandHover.addEventListener('mouseenter', () => {
        founderOverlay.classList.remove('opacity-0', 'pointer-events-none');
        founderOverlay.classList.add('opacity-100');
        founderImage.classList.remove('scale-95');
        founderImage.classList.add('scale-100');
    });

    brandHover.addEventListener('mouseleave', () => {
        founderOverlay.classList.add('opacity-0', 'pointer-events-none');
        founderOverlay.classList.remove('opacity-100');
        founderImage.classList.add('scale-95');
        founderImage.classList.remove('scale-100');
    });
}
