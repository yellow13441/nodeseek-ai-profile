#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class DummyElement {
  constructor() {
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

function bootUserscript(store, gmRequest = () => ({ abort() {} }), windowOpen = () => undefined, locationHash = "") {
  const document = new DummyElement();
  document.head = new DummyElement();
  document.body = new DummyElement();
  document.documentElement = new DummyElement();
  document.documentElement.clientWidth = 1280;
  document.documentElement.clientHeight = 800;
  document.fonts = { ready: Promise.resolve() };
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
    GM_getValue: (key, fallback) => store.has(key) ? store.get(key) : fallback,
    GM_setValue: (key, value) => store.set(key, value),
    GM_deleteValue: (key) => store.delete(key),
    GM_listValues: () => [...store.keys()],
    GM_addValueChangeListener() { return 1; },
    GM_registerMenuCommand() {},
    GM_setClipboard() {},
    GM_xmlhttpRequest: gmRequest,
    MutationObserver: class { observe() {} },
    sessionStorage: makeStorage(),
    localStorage: makeStorage(),
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
    setInterval() { return 0; },
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
    configuredMaxTokens, configuredTimeoutMs, readUploadHistory, parse16HostResponse,
    imageHostCredential, configuredImageHostIds, chooseImageHostForShare,
    uploadImageToProvider, deleteUploadedImage, createImageHostTestBlob, runImageHostConnectivityTest,
    PROFILE_WAIT_HINTS, CUSTOM_WAIT_HINTS, TRADE_WAIT_HINTS, activeConfigFingerprint, rebuildActiveAi,
    openSettingsModal, renderAiPane, renderAnalysisPane, renderPromptPane, renderImagePane,
    buildLocalCacheKey, readCache, writeCache, clearCache,
    createPersistentTaskRecord, readPersistentTask, writePersistentTask, deletePersistentTask, cleanupPersistentTasks, isPersistentTaskActive, hasRunningTasks,
    externalTaskSnapshot, cancelTask,
    startPersistentAnalysis, taskWorkerUrl, wakeTaskWorker
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

assert.equal(api.makeDefaultSettings().providers["openai-compatible"].model, "gpt-5.6-sol");
assert.equal(api.makeDefaultSettings().imageHosting.selectionMode, "fixed");
assert.equal(api.AI_SETTINGS.providers["openai-compatible"].model, "gpt-5.6", "existing model must be preserved");
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
