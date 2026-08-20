#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class DummyElement {
  constructor() {
    this.nodeType = 1;
    this.isConnected = true;
    this.style = {};
    this.dataset = {};
    this.className = "";
    this.value = "";
    this.type = "";
    this.checked = false;
    this.disabled = false;
    this.offsetWidth = 410;
    this.offsetHeight = 520;
    this.scrollHeight = 520;
    this.clientHeight = 520;
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }

  appendChild(child) { return child; }
  append() {}
  remove() {}
  addEventListener() {}
  setAttribute() {}
  getAttribute() { return ""; }
  hasAttribute() { return false; }
  removeAttribute() {}
  matches() { return false; }
  contains() { return false; }
  querySelector() { return new DummyElement(); }
  querySelectorAll() { return []; }
  closest() { return null; }
  insertAdjacentElement() {}
  getBoundingClientRect() { return { left: 100, top: 100, right: 510, bottom: 620, width: 410, height: 520 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  click() {}
  focus() {}
}

function makeStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function bootUserscript(store, gmRequest = () => ({ abort() {} }), windowOpen = () => undefined, locationHash = "", instrumentation = {}) {
  const document = new DummyElement();
  document.head = new DummyElement();
  document.body = new DummyElement();
  document.documentElement = new DummyElement();
  document.documentElement.clientWidth = 1280;
  document.documentElement.clientHeight = 800;
  document.fonts = { ready: Promise.resolve() };
  document.hidden = false;
  document.createElement = (tagName) => {
    const element = new DummyElement();
    if (String(tagName).toLowerCase() === "canvas") {
      element.getContext = () => ({
        createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
        putImageData() {},
        fillRect() {},
        fillText() {},
        set fillStyle(_) {},
        set font(_) {},
      });
      element.toBlob = (callback) => callback(new Blob([new Uint8Array(300 * 1024)], { type: "image/png" }));
    }
    return element;
  };
  document.querySelector = () => null;
  document.querySelectorAll = () => [];
  document.addEventListener = () => {};

  const windowObject = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 2,
    scrollX: 0,
    scrollY: 0,
    addEventListener() {},
    open: windowOpen,
    focus() {},
    close() {},
  };

  const context = {
    console: { log() {}, warn() {}, error() {} },
    document,
    window: windowObject,
    location: { origin: "https://www.nodeseek.com", pathname: "/", hash: locationHash },
    screen: { availWidth: 1440, availHeight: 900 },
    navigator: {},
    GM_getValue: (key, fallback) => {
      instrumentation.gmGetCount = (instrumentation.gmGetCount || 0) + 1;
      return store.has(key) ? store.get(key) : fallback;
    },
    GM_setValue: (key, value) => {
      instrumentation.gmSetCount = (instrumentation.gmSetCount || 0) + 1;
      store.set(key, value);
    },
    GM_deleteValue: (key) => store.delete(key),
    GM_listValues: () => {
      instrumentation.gmListCount = (instrumentation.gmListCount || 0) + 1;
      return [...store.keys()];
    },
    GM_addValueChangeListener(_key, callback) {
      (instrumentation.valueListeners ||= []).push(callback);
      return 1;
    },
    GM_registerMenuCommand() {},
    GM_setClipboard() {},
    GM_xmlhttpRequest: gmRequest,
    MutationObserver: class {
      constructor(callback) { instrumentation.mutationCallback = callback; }
      observe() { instrumentation.observerObserveCount = (instrumentation.observerObserveCount || 0) + 1; }
      disconnect() { instrumentation.observerDisconnectCount = (instrumentation.observerDisconnectCount || 0) + 1; }
    },
    sessionStorage: makeStorage(),
    localStorage: makeStorage(),
    requestAnimationFrame(callback) {
      (instrumentation.animationFrames ||= []).push(callback);
      return instrumentation.animationFrames.length;
    },
    cancelAnimationFrame() {},
    setInterval(callback, delay) {
      (instrumentation.intervals ||= []).push({ callback, delay });
      return instrumentation.intervals.length;
    },
    clearInterval() {},
    setTimeout() { return 0; },
    clearTimeout() {},
    confirm() { return true; },
    alert() {},
    getComputedStyle() { return { backgroundColor: "#fff" }; },
    URL,
    URLSearchParams,
    FormData,
    Blob,
    AbortController,
    DOMException,
    performance,
    crypto: globalThis.crypto,
  };
  context.globalThis = context;

  const scriptPath = path.join(__dirname, "..", "nodeseek-ai-profile.user.js");
  let source = fs.readFileSync(scriptPath, "utf8");
  const expose = `globalThis.__nsTest = {
    AI_SETTINGS, CONFIG, IS_TASK_WORKER, SHARE_PRIVACY_MESSAGE, makeDefaultSettings, sanitizeProviderSettings, sanitizeImageHosting, PROVIDER_DEFS, IMAGE_HOST_DEFS,
    buildFastUserPrompt, normalizeFastProfile, resolvePrimaryOpenMode, getUserState,
    calcJoinDays, normalizeAccountInfo, refreshAccountDerivedFields,
    configuredMaxTokens, configuredTimeoutMs, readUploadHistory, parse16HostResponse,
    imageHostCredential, configuredImageHostIds, chooseImageHostForShare,
    uploadImageToProvider, deleteUploadedImage, createImageHostTestBlob, runImageHostConnectivityTest,
    PROFILE_WAIT_HINTS, CUSTOM_WAIT_HINTS, TRADE_WAIT_HINTS, activeConfigFingerprint, rebuildActiveAi,
    openSettingsModal, renderAiPane, renderAnalysisPane, renderPromptPane, renderImagePane, renderEnhancementPane, settingsPaneEl,
    buildLocalCacheKey, readCache, writeCache, clearCache,
    createPersistentTaskRecord, readPersistentTask, writePersistentTask, deletePersistentTask, cleanupPersistentTasks, cleanupPersistentTaskRecord, isPersistentTaskActive, hasRunningTasks,
    externalTaskSnapshot, cancelTask,
    startPersistentAnalysis, taskWorkerUrl, wakeTaskWorker,
    updateUidButtons, registerProfileWrap, hydrateUidStorageState, handlePersistentTaskSignal, syncPersistentTasks,
    accountPreviewLevelClass, accountPreviewMetricTone, renderFullAccountPreview, accountPreviewEl,
    persistentProgressFingerprint
  };\n})();`;
  source = source.replace(/\}\)\(\);\s*$/, expose);
  vm.createContext(context);
  vm.runInContext(source, context, { filename: scriptPath });
  return context.__nsTest;
}

const store = new Map();
store.set("ns-ai-profile-v2.7-settings", {
  version: 8,
  activeProvider: "openai-compatible",
  includeModerationInDeep: false,
  imageHost: { authToken: "legacy-token" },
  providers: {
    deepseek: { apiKey: "deepseek-key-123", apiUrl: "https://api.deepseek.com/chat/completions", model: "deepseek-v4-flash", fastReasoning: "low", deepReasoning: "high" },
    openai: { apiKey: "openai-key-123", apiUrl: "https://api.openai.com/v1/chat/completions", model: "gpt-5.6", fastReasoning: "low", deepReasoning: "high" },
    "openai-compatible": { apiKey: "compat-key-123", apiUrl: "https://vendor.test/v1/chat/completions", model: "gpt-5.6", fastReasoning: "high", deepReasoning: "xhigh" },
  },
});
store.set("ns-ai-profile-image-host-history-v1", [{ id: "old-1", imageUrl: "https://i.111666.best/image/old.png", deleteUrl: "https://i.111666.best/image/old.png" }]);

const imageHostRequests = [];
function mockImageHostRequest(options) {
  imageHostRequests.push(options);
  const url = String(options.url || "");
  const method = String(options.method || "GET").toUpperCase();
  let responseText = "{}";
  if (url === "https://i.111666.best/image" && method === "POST") {
    responseText = JSON.stringify({ src: "/image/mock-sixteen.png" });
  } else if (url === "https://api.nodeimage.com/api/upload") {
    responseText = JSON.stringify({ data: { id: "node-1", url: "https://cdn.nodeimage.com/mock-node.png" } });
  } else if (url.startsWith("https://api.imgbb.com/1/upload?")) {
    responseText = JSON.stringify({ data: { id: "imgbb-1", url: "https://i.ibb.co/mock-imgbb.png", url_viewer: "https://ibb.co/imgbb-1", delete_url: "https://ibb.co/imgbb-1/delete-secret" } });
  } else if (url === "https://freeimage.host/api/1/upload") {
    responseText = JSON.stringify({ image: { id_encoded: "free-1", url: "https://iili.io/mock-free.png", url_viewer: "https://freeimage.host/i/free-1" } });
  } else if (url === "https://catbox.moe/user/api.php" && options.data?.get("reqtype") === "fileupload") {
    responseText = "https://files.catbox.moe/mock-cat.png";
  }
  queueMicrotask(() => options.onload?.({ status: 200, responseText }));
  return { abort() {} };
}

const api = bootUserscript(store, mockImageHostRequest);

// Performance regression guards: an idle NodeSeek page must not install a task polling interval
// or enumerate the complete Tampermonkey storage namespace.
const idlePerf = {};
const idleApi = bootUserscript(new Map(), mockImageHostRequest, () => undefined, "", idlePerf);
assert.deepEqual(idlePerf.intervals || [], [], "an idle page with GM value listeners must not install a polling interval");
assert.equal(idlePerf.gmListCount || 0, 0, "an idle page must not enumerate all GM values during startup");

const buttonAttributes = new Map();
let buttonText = "AI 画像";
let buttonTextWrites = 0;
const perfButton = {
  get textContent() { return buttonText; },
  set textContent(value) { buttonTextWrites += 1; buttonText = String(value); },
  getAttribute(name) { return buttonAttributes.has(name) ? buttonAttributes.get(name) : null; },
  setAttribute(name, value) { buttonAttributes.set(name, String(value)); },
  hasAttribute(name) { return buttonAttributes.has(name); },
  removeAttribute(name) { buttonAttributes.delete(name); },
};
const perfClasses = new Set();
const perfWrap = {
  isConnected: true,
  dataset: { uid: "900" },
  classList: {
    contains(name) { return perfClasses.has(name); },
    toggle(name, enabled) { if (enabled) perfClasses.add(name); else perfClasses.delete(name); },
  },
  querySelector(selector) { return selector === ".ns-ai-profile-tag" ? perfButton : null; },
};
idleApi.registerProfileWrap("900", perfWrap);
const idleButtonGmReads = idlePerf.gmGetCount || 0;
idleApi.updateUidButtons("900");
idleApi.updateUidButtons("900");
assert.equal(buttonTextWrites, 0, "idempotent button updates must not rewrite an unchanged text node");
assert.equal(idlePerf.gmGetCount || 0, idleButtonGmReads, "button rendering must not read GM storage");
idleApi.getUserState("900").fast.result = { oneLiner: "cached" };
idleApi.updateUidButtons("900");
idleApi.updateUidButtons("900");
assert.equal(buttonTextWrites, 1, "a changed button state must be written exactly once");

const ownMutationTarget = { nodeType: 1, closest() { return {}; } };
const frameCountBeforeOwnMutation = (idlePerf.animationFrames || []).length;
idlePerf.mutationCallback?.([{ target: ownMutationTarget, addedNodes: [{ nodeType: 3, parentElement: ownMutationTarget }] }]);
assert.equal((idlePerf.animationFrames || []).length, frameCountBeforeOwnMutation, "mutations inside the userscript UI must be ignored");
const outsideMutationTarget = { nodeType: 1, closest() { return null; } };
const addedAuthor = { nodeType: 1, closest() { return null; }, matches() { return true; }, querySelector() { return null; } };
idlePerf.mutationCallback?.([{ target: outsideMutationTarget, addedNodes: [addedAuthor] }]);
assert.equal((idlePerf.animationFrames || []).length, frameCountBeforeOwnMutation + 1, "a newly added author subtree must schedule one scoped injection");

const signalTask = { ...idleApi.createPersistentTaskRecord("900", "fast", false), status: "running", workerId: "worker-test" };
idleApi.writePersistentTask(signalTask);
const signalListCount = idlePerf.gmListCount || 0;
const signalGetCount = idlePerf.gmGetCount || 0;
idleApi.handlePersistentTaskSignal({ uid: "900", mode: "fast", id: signalTask.id });
assert.equal(idlePerf.gmListCount || 0, signalListCount, "a targeted task signal must not enumerate all GM values");
assert.equal((idlePerf.gmGetCount || 0) - signalGetCount, 1, "a targeted task signal should read only its task slot");
idleApi.deletePersistentTask("900", "fast");
idleApi.handlePersistentTaskSignal({ uid: "900", mode: "fast", id: signalTask.id, deleted: true });
assert.equal(idleApi.getUserState("900").fast.status, "done", "a targeted deletion signal should reveal an existing local result");
assert.equal(idleApi.getUserState("900").fast.task, null, "a targeted deletion signal must release the external running task");
const cleanupListCount = idlePerf.gmListCount || 0;
idleApi.syncPersistentTasks(false);
assert.equal((idlePerf.gmListCount || 0) - cleanupListCount, 1, "a full fallback sync must reuse one task enumeration");

const firstWaitFingerprint = idleApi.persistentProgressFingerprint({ uid:"900", progress:{ title:"等待", percent:50, hint:"提示", items:[{ state:"active", text:"等待模型返回 · 1.0s" }] } });
const laterWaitFingerprint = idleApi.persistentProgressFingerprint({ uid:"900", progress:{ title:"等待", percent:50, hint:"提示", items:[{ state:"active", text:"等待模型返回 · 9.5s" }] } });
assert.equal(firstWaitFingerprint, laterWaitFingerprint, "the local elapsed timer must not create a cross-tab progress revision");

const workerPerf = {};
bootUserscript(new Map(), mockImageHostRequest, () => undefined, "#ns-ai-profile-task-worker-v1", workerPerf);
assert.ok((workerPerf.intervals || []).some(({ delay }) => delay === 1000), "the worker must keep a lightweight one-second lifecycle tick");
assert.ok(!(workerPerf.intervals || []).some(({ delay }) => delay === 500), "the worker must not restore the old 500ms full-scan loop");

assert.equal(api.makeDefaultSettings().providers["openai-compatible"].model, "gpt-5.6-sol");
assert.equal(api.makeDefaultSettings().imageHosting.selectionMode, "fixed");
assert.equal(api.AI_SETTINGS.providers["openai-compatible"].model, "gpt-5.6", "existing model must be preserved");
const fifteenPointTwoDaysAgo = new Date(Date.now() - (15.2 * 24 * 60 * 60 * 1000)).toISOString();
assert.equal(api.calcJoinDays(fifteenPointTwoDaysAgo), 16, "join days must use NodeSeek's inclusive/ceil display convention");
const staleDerivedAccount = { createdAt: fifteenPointTwoDaysAgo, joinDays: 15 };
api.refreshAccountDerivedFields(staleDerivedAccount);
assert.equal(staleDerivedAccount.joinDays, 16, "old cached accounts must receive the corrected join-day value");
const socialAccount = api.normalizeAccountInfo("66", { detail: {
  member_name: "social-user", rank: 6, coin: 8200, stardust: 120,
  created_at: fifteenPointTwoDaysAgo, nPost: 8, nComment: 90,
  following_count: 12, follower_count: 345,
} });
assert.equal(socialAccount.following, 12, "following count should be reused when the existing account response contains it");
assert.equal(socialAccount.followers, 345, "follower count should be reused without another endpoint request");
const relationFlagsOnly = api.normalizeAccountInfo("67", { detail: { member_name:"flag-user", following:true, followers:false } });
assert.equal(relationFlagsOnly.following, null, "viewer relationship flags must not be mistaken for public following counts");
assert.equal(relationFlagsOnly.followers, null, "viewer relationship flags must not be mistaken for public follower counts");
assert.notEqual(api.accountPreviewLevelClass(1), api.accountPreviewLevelClass(6), "Lv1 and Lv6 must have visibly distinct level classes");
assert.notEqual(api.accountPreviewMetricTone("age", 6), api.accountPreviewMetricTone("age", 900), "new and established accounts must use different age tones");
assert.notEqual(api.accountPreviewMetricTone("coin", 50), api.accountPreviewMetricTone("coin", 8200), "low and high chicken-leg counts must use different tones");
assert.notEqual(api.accountPreviewMetricTone("stardust", 2), api.accountPreviewMetricTone("stardust", 120), "low and high stardust counts must use different tones");
api.renderFullAccountPreview(socialAccount, new DummyElement());
assert.match(api.accountPreviewEl.innerHTML, /ns-ai-rank-6/);
assert.match(api.accountPreviewEl.innerHTML, /注册天数/);
assert.match(api.accountPreviewEl.innerHTML, /关注[\s\S]*12/);
assert.match(api.accountPreviewEl.innerHTML, /粉丝[\s\S]*345/);
assert.match(api.accountPreviewEl.innerHTML, /href="\/space\/66#\/discussions"/);
assert.match(api.accountPreviewEl.innerHTML, /href="\/space\/66#\/comments"/);
assert.match(api.accountPreviewEl.innerHTML, /href="\/notification#\/message\?mode=talk&amp;to=66"/);
assert.equal((api.accountPreviewEl.innerHTML.match(/target="_blank"/g) || []).length, 3, "profile history and private-message links should preserve the current thread in a new tab");
assert.doesNotMatch(api.accountPreviewEl.innerHTML, /30 分钟账号缓存|仅使用公开账号资料|未调用 AI 或第三方服务/, "the compact preview must not repeat cache/source explanations");
api.openSettingsModal();
api.renderEnhancementPane();
assert.match(api.settingsPaneEl.innerHTML, /仅使用 NodeSeek 公开账号资料，不调用 AI 或第三方服务；账号资料缓存 30 分钟/);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.AI_SETTINGS.moderation)),
  { includeInProfile: true, includeInTrade: false },
);
assert.equal(api.AI_SETTINGS.imageHosting.providers.sixteen.authToken, "legacy-token");
assert.equal(api.AI_SETTINGS.imageHosting.selectionMode, "fixed", "legacy settings must migrate to fixed image-host mode");
assert.equal(api.configuredMaxTokens("profile"), 12000);
assert.equal(api.configuredMaxTokens("custom"), 16000);
assert.equal(api.configuredMaxTokens("trade"), 32000);
assert.equal(api.configuredTimeoutMs("trade"), 600000);
assert.match(api.SHARE_PRIVACY_MESSAGE, /分享可以帮助更多人了解插件/);
assert.match(api.SHARE_PRIVACY_MESSAGE, /明确表示不希望公开/);

api.writeCache(api.CONFIG.fastCachePrefix, "777", {
  profile: { oneLiner: "跨窗口缓存" },
  meta: { provider: "测试" },
  account: { uid: "777", name: "cache-user" },
});
const reloadedApi = bootUserscript(store, mockImageHostRequest);
const persistentCache = reloadedApi.readCache(reloadedApi.CONFIG.fastCachePrefix, "777", reloadedApi.CONFIG.fastCacheTtl);
assert.equal(persistentCache.profile.oneLiner, "跨窗口缓存", "completed result must survive a page reload");
api.clearCache(api.CONFIG.fastCachePrefix, "777");

const queuedTask = api.createPersistentTaskRecord("778", "fast", false);
api.writePersistentTask(queuedTask);
assert.equal(reloadedApi.readPersistentTask("778", "fast").id, queuedTask.id, "running task state must be shared across pages");
assert.equal(api.isPersistentTaskActive(queuedTask), true);
assert.equal(reloadedApi.hasRunningTasks(), true, "other pages must see the running task when protecting analysis settings");
api.cancelTask(api.externalTaskSnapshot(queuedTask));
assert.equal(api.readPersistentTask("778", "fast").status, "cancelled", "an unclaimed queued task must cancel immediately");
assert.match(api.readPersistentTask("778", "fast").error, /尚未被临时窗口接收/);
api.deletePersistentTask("778", "fast");
const orphanedCancellingTask = { ...api.createPersistentTaskRecord("778", "deep", false), status: "cancelling", cancelRequested: true };
api.writePersistentTask(orphanedCancellingTask);
api.cleanupPersistentTasks();
assert.equal(api.readPersistentTask("778", "deep").status, "cancelled", "refresh cleanup must release an unclaimed cancelling task");
api.deletePersistentTask("778", "deep");
const neverReceivedTask = { ...api.createPersistentTaskRecord("782", "fast", false), createdAt: Date.now() - 31000, updatedAt: Date.now() - 31000 };
api.writePersistentTask(neverReceivedTask);
api.cleanupPersistentTasks();
assert.equal(api.readPersistentTask("782", "fast").status, "error", "an unclaimed queue entry must not block the user for minutes");
assert.match(api.readPersistentTask("782", "fast").error, /尚未调用模型/);
api.deletePersistentTask("782", "fast");

let workerNavigation = "";
let workerOpenCalls = 0;
const workerMessages = [];
const fakeWorkerWindow = {
  closed: false,
  location: {
    hash: "",
    replace(url) { workerNavigation = url; this.hash = "#ns-ai-profile-task-worker-v1"; },
  },
  focus() {},
  blur() {},
  postMessage(message, origin) { workerMessages.push({ message, origin }); },
};
const popupApi = bootUserscript(store, mockImageHostRequest, () => { workerOpenCalls += 1; return fakeWorkerWindow; });
const queuedSnapshot = popupApi.startPersistentAnalysis("779", "fast", false);
assert.equal(queuedSnapshot.external, true);
assert.match(workerNavigation, /#ns-ai-profile-task-worker-v1$/);
assert.equal(popupApi.readPersistentTask("779", "fast").status, "queued");
workerNavigation = "reused-without-navigation";
popupApi.startPersistentAnalysis("780", "deep", false);
assert.equal(workerNavigation, "reused-without-navigation", "named worker window must be reused without reloading active jobs");
assert.equal(workerOpenCalls, 1, "the same page must reuse its worker reference without calling window.open again");
assert.equal(workerMessages.length, 2, "each queued job must explicitly notify the reusable worker");
assert.equal(workerMessages[1].message.uid, "780");
assert.equal(JSON.parse(store.get(popupApi.CONFIG.taskSignalKey)).uid, "780", "persistent wake signal must identify the new task directly");
popupApi.deletePersistentTask("779", "fast");
popupApi.deletePersistentTask("780", "deep");
const workerApi = bootUserscript(store, mockImageHostRequest, () => undefined, "#ns-ai-profile-task-worker-v1");
assert.equal(workerApi.IS_TASK_WORKER, true, "worker URL must enter the dedicated task-window runtime");
const concurrentFastTask = workerApi.createPersistentTaskRecord("784", "fast", false);
const concurrentDeepTask = workerApi.createPersistentTaskRecord("785", "deep", false);
workerApi.writePersistentTask(concurrentFastTask);
workerApi.writePersistentTask(concurrentDeepTask);
workerApi.wakeTaskWorker("784", "fast", concurrentFastTask.id);
workerApi.wakeTaskWorker("785", "deep", concurrentDeepTask.id);
assert.equal(workerApi.readPersistentTask("784", "fast").status, "running", "the reusable worker must claim the first concurrent task");
assert.equal(workerApi.readPersistentTask("785", "deep").status, "running", "a second task must not remain stuck while the first task is starting");
assert.equal(
  workerApi.readPersistentTask("784", "fast").workerId,
  workerApi.readPersistentTask("785", "deep").workerId,
  "both concurrent tasks should be owned by the reusable worker window",
);
workerApi.deletePersistentTask("784", "fast");
workerApi.deletePersistentTask("785", "deep");
const directlyWokenTask = workerApi.createPersistentTaskRecord("781", "fast", false);
workerApi.writePersistentTask(directlyWokenTask);
workerApi.wakeTaskWorker("781", "fast", directlyWokenTask.id);
assert.equal(workerApi.readPersistentTask("781", "fast").status, "running", "a direct wake must claim a newly queued task without waiting for key enumeration");
assert.ok(workerApi.readPersistentTask("781", "fast").workerId);
workerApi.deletePersistentTask("781", "fast");
const cancellationRaceTask = workerApi.createPersistentTaskRecord("783", "fast", false);
workerApi.writePersistentTask(cancellationRaceTask);
workerApi.cancelTask(workerApi.externalTaskSnapshot(cancellationRaceTask));
workerApi.writePersistentTask(cancellationRaceTask); // simulate a stale queued writer racing after cancellation
workerApi.wakeTaskWorker("783", "fast", cancellationRaceTask.id);
assert.equal(workerApi.readPersistentTask("783", "fast").status, "cancelled", "a durable cancel intent must prevent a stale queue record from resurrecting the task");
workerApi.deletePersistentTask("783", "fast");

const clampedProvider = api.sanitizeProviderSettings("openai-compatible", {
  apiKey: "key", apiUrl: "https://vendor.test/v1/chat/completions", model: "custom-model",
  maxTokens: { profile: 1, custom: 999999, trade: 32000 },
  timeoutSeconds: { profile: 1, custom: 9999, trade: 600 },
});
assert.equal(clampedProvider.maxTokens.profile, 2000);
assert.equal(clampedProvider.maxTokens.custom, 65536);
assert.equal(clampedProvider.timeoutSeconds.profile, 30);
assert.equal(clampedProvider.timeoutSeconds.custom, 900);

const oldFingerprint = api.activeConfigFingerprint("fast");
api.AI_SETTINGS.providers["openai-compatible"].maxTokens.profile = 18000;
api.rebuildActiveAi();
assert.notEqual(api.activeConfigFingerprint("fast"), oldFingerprint, "output budget must affect the cache fingerprint");

const prompt = api.buildFastUserPrompt(
  { uid: "30205", rank: 6, joinDays: 100, coin: 1, stardust: 1, nPost: 1, nComment: 1 },
  [], [], {}, null,
  { status: "ok", queriedAt: Date.now(), rows: [{ evidenceId: "M1", record_id: 9, action_points_delta: -1000, reason_text: "测试处罚", actions_text: "封禁1000天", post_url: "" }] },
);
assert.match(prompt, /"id": "M1"/);
assert.match(prompt, /封禁1000天/);

const normalized = api.normalizeFastProfile(
  { one_liner: "测试", one_liner_evidence: ["M1", "X1"], recent_focus: [], trade: {} },
  new Set(["M1"]),
);
assert.deepEqual(JSON.parse(JSON.stringify(normalized.oneLinerEvidence)), ["M1"]);

const state = api.getUserState("42");
state.deep.result = { verdict: "已有深度结果" };
state.deep.status = "done";
assert.equal(api.resolvePrimaryOpenMode("42"), "deep");

const history = api.readUploadHistory();
assert.equal(history[0].providerId, "sixteen");
assert.equal(history[0].deleteMode, "api");

const parsed16 = api.parse16HostResponse(JSON.stringify({ src: "/image/example.png" }));
assert.equal(parsed16.providerId, "sixteen");
assert.equal(parsed16.imageUrl, "https://i.111666.best/image/example.png");
assert.equal(parsed16.deleteMode, "api");
const parsed16DeleteUrl = api.parse16HostResponse(JSON.stringify({
  src: "/image/example-with-delete.png",
  delete_url: "/image/example-with-delete.png?delete-token=kept",
}));
assert.equal(parsed16DeleteUrl.deleteUrl, "https://i.111666.best/image/example-with-delete.png?delete-token=kept");

assert.deepEqual(Object.keys(api.IMAGE_HOST_DEFS), ["sixteen", "nodeimage", "imgbb", "freeimage", "catbox"]);
const rotationSettings = JSON.parse(JSON.stringify(api.makeDefaultSettings()));
rotationSettings.imageHosting.selectionMode = "rotation";
rotationSettings.imageHosting.providers.sixteen.authToken = "sixteen-token";
rotationSettings.imageHosting.providers.nodeimage.apiKey = "node-key";
rotationSettings.imageHosting.providers.imgbb.apiKey = "imgbb-key";
store.delete(api.CONFIG.imageHostRotationKey);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.configuredImageHostIds(rotationSettings))),
  ["sixteen", "nodeimage", "imgbb"],
  "only providers with explicit credentials belong to the rotation pool",
);
const rotationChoices = Array.from({ length: 6 }, () => api.chooseImageHostForShare(rotationSettings).providerId);
assert.deepEqual([...rotationChoices.slice(0, 3)].sort(), ["imgbb", "nodeimage", "sixteen"]);
assert.deepEqual([...rotationChoices.slice(3, 6)].sort(), ["imgbb", "nodeimage", "sixteen"]);
for (let i = 1; i < rotationChoices.length; i += 1) {
  assert.notEqual(rotationChoices[i], rotationChoices[i - 1], "balanced rotation should avoid consecutive repeats");
}
const fixedSettings = JSON.parse(JSON.stringify(rotationSettings));
fixedSettings.imageHosting.selectionMode = "fixed";
fixedSettings.imageHosting.activeProvider = "nodeimage";
assert.equal(api.chooseImageHostForShare(fixedSettings).providerId, "nodeimage");
const emptyRotationSettings = JSON.parse(JSON.stringify(api.makeDefaultSettings()));
emptyRotationSettings.imageHosting.selectionMode = "rotation";
emptyRotationSettings.imageHosting.activeProvider = "catbox";
const emptyRotationChoice = api.chooseImageHostForShare(emptyRotationSettings);
assert.equal(emptyRotationChoice.providerId, "catbox");
assert.equal(emptyRotationChoice.fallback, true);
api.openSettingsModal();
api.renderAiPane();
api.renderAnalysisPane();
api.renderPromptPane();
api.renderImagePane();
for (const hints of [api.PROFILE_WAIT_HINTS, api.CUSTOM_WAIT_HINTS, api.TRADE_WAIT_HINTS]) {
  assert.equal(hints.length, 20);
  for (const hint of hints) {
    assert.ok(hint.length >= 18 && hint.length <= 42, `wait hint length ${hint.length}: ${hint}`);
  }
}

async function testImageHostAdapters() {
  Object.assign(api.AI_SETTINGS.imageHosting.providers.nodeimage, { apiKey: "node-key" });
  Object.assign(api.AI_SETTINGS.imageHosting.providers.imgbb, { apiKey: "imgbb-key", expirationSeconds: 600 });
  Object.assign(api.AI_SETTINGS.imageHosting.providers.freeimage, { apiKey: "free-key" });
  Object.assign(api.AI_SETTINGS.imageHosting.providers.catbox, { userHash: "cat-user-hash" });
  const blob = new Blob(["png"], { type: "image/png" });
  const generated = await api.createImageHostTestBlob();
  assert.equal(generated.width, 360);
  assert.equal(generated.height, 280);
  assert.equal(generated.blob.size, 300 * 1024);

  const sixteen = await api.uploadImageToProvider("sixteen", blob, "test.png");
  assert.equal(sixteen.imageUrl, "https://i.111666.best/image/mock-sixteen.png");
  assert.equal(sixteen.deleteMode, "api");

  const nodeimage = await api.uploadImageToProvider("nodeimage", blob, "test.png");
  assert.equal(nodeimage.resourceId, "node-1");
  assert.equal(nodeimage.deleteMode, "api");
  const nodeUpload = imageHostRequests.find((request) => request.url === "https://api.nodeimage.com/api/upload");
  assert.equal(nodeUpload.headers["X-API-Key"], "node-key");
  assert.equal(nodeUpload.data.get("image").size, 3);

  const imgbb = await api.uploadImageToProvider("imgbb", blob, "test.png");
  assert.equal(imgbb.viewerUrl, "https://ibb.co/imgbb-1");
  assert.equal(imgbb.deleteMode, "page");
  const imgbbUpload = imageHostRequests.find((request) => String(request.url).startsWith("https://api.imgbb.com/1/upload?"));
  assert.match(imgbbUpload.url, /key=imgbb-key/);
  assert.match(imgbbUpload.url, /expiration=600/);
  await api.uploadImageToProvider("imgbb", blob, "test-mode.png", { settings: api.AI_SETTINGS, testMode: true });
  const imgbbTestUpload = imageHostRequests.filter((request) => String(request.url).startsWith("https://api.imgbb.com/1/upload?")).at(-1);
  assert.match(imgbbTestUpload.url, /expiration=60(?:&|$)/);
  assert.doesNotMatch(imgbbTestUpload.url, /expiration=600/);

  const freeimage = await api.uploadImageToProvider("freeimage", blob, "test.png");
  assert.equal(freeimage.imageUrl, "https://iili.io/mock-free.png");
  assert.equal(freeimage.deleteMode, "none");
  const freeUpload = imageHostRequests.find((request) => request.url === "https://freeimage.host/api/1/upload");
  assert.equal(freeUpload.data.get("action"), "upload");
  assert.equal(freeUpload.data.get("key"), "free-key");

  const catbox = await api.uploadImageToProvider("catbox", blob, "test.png");
  assert.equal(catbox.resourceId, "mock-cat.png");
  assert.equal(catbox.deleteMode, "api");
  const catUpload = imageHostRequests.find((request) => request.url === "https://catbox.moe/user/api.php" && request.data?.get("reqtype") === "fileupload");
  assert.equal(catUpload.data.get("userhash"), "cat-user-hash");
  assert.equal(catUpload.data.get("fileToUpload").size, 3);

  const nodeDelete = await api.deleteUploadedImage(nodeimage);
  assert.equal(nodeDelete.endpoint, "https://api.nodeimage.com/api/v1/delete/node-1");
  assert.ok(imageHostRequests.some((request) => request.method === "DELETE" && request.url === "https://api.nodeimage.com/api/v1/delete/node-1"));
  await api.deleteUploadedImage(catbox);
  const catDelete = imageHostRequests.find((request) => request.url === "https://catbox.moe/user/api.php" && request.data?.get("reqtype") === "deletefiles");
  assert.equal(catDelete.data.get("files"), "mock-cat.png");

  const testButton = new DummyElement();
  const testStatus = new DummyElement();
  await api.runImageHostConnectivityTest("sixteen", testButton, testStatus);
  assert.match(testStatus.textContent, /上传和凭据删除均通过/);
  assert.match(testStatus.className, /success/);
  assert.equal(testButton.disabled, false);
  assert.equal(imageHostRequests.filter((request) => String(request.method || "GET").toUpperCase() === "GET").length, 0, "image-host test must not download the uploaded image again");
}

testImageHostAdapters()
  .then(async () => {
    const fallbackRequests = [];
    const fallbackApi = bootUserscript(store, (options) => {
      fallbackRequests.push(options);
      const url = String(options.url || "");
      if (url === "https://api.nodeimage.com/api/v1/delete/node-fallback") {
        queueMicrotask(() => options.onload?.({ status:404, responseText:"Cannot DELETE /api/v1/delete/node-fallback" }));
      } else {
        queueMicrotask(() => options.onload?.({ status:200, responseText:"{}" }));
      }
      return { abort() {} };
    });
    const fallbackSettings = fallbackApi.makeDefaultSettings();
    fallbackSettings.imageHosting.providers.nodeimage.apiKey = "node-fallback-key";
    const fallbackDelete = await fallbackApi.deleteUploadedImage({ providerId:"nodeimage", resourceId:"node-fallback" }, fallbackSettings);
    assert.equal(fallbackDelete.endpoint, "https://api.nodeimage.com/api/images/node-fallback");
    assert.equal(fallbackDelete.fallbackUsed, true);
    assert.deepEqual(
      fallbackRequests.filter((request) => request.method === "DELETE").map((request) => request.url),
      [
        "https://api.nodeimage.com/api/v1/delete/node-fallback",
        "https://api.nodeimage.com/api/images/node-fallback",
      ],
    );

    const missingImageRequests = [];
    const missingImageApi = bootUserscript(store, (options) => {
      missingImageRequests.push(options);
      queueMicrotask(() => options.onload?.({ status:404, responseText:JSON.stringify({ error:"image not found" }) }));
      return { abort() {} };
    });
    const missingImageSettings = missingImageApi.makeDefaultSettings();
    missingImageSettings.imageHosting.providers.nodeimage.apiKey = "node-missing-key";
    await assert.rejects(
      missingImageApi.deleteUploadedImage({ providerId:"nodeimage", resourceId:"node-missing" }, missingImageSettings),
      /image not found/,
    );
    assert.deepEqual(
      missingImageRequests.filter((request) => request.method === "DELETE").map((request) => request.url),
      ["https://api.nodeimage.com/api/v1/delete/node-missing"],
      "a real missing-resource 404 must not trigger alternate deletion routes",
    );
    console.log("userscript smoke tests: PASS");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
