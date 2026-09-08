import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const contentPath = new URL('../content.js', import.meta.url);

function makeAnchor(href, textContent, insideChatRivet = false) {
  return {
    textContent,
    getAttribute(name) {
      return name === 'href' ? href : null;
    },
    closest(selector) {
      return insideChatRivet && selector === '#chatdock-root' ? {} : null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function makeProjectAnchor(href, title, projectName) {
  const anchor = makeAnchor(href, `${title}${projectName}`);
  const makeTextElement = (textContent, classes) => ({
    textContent,
    classList: {
      contains(name) { return classes.includes(name); },
    },
  });
  const titleElement = makeTextElement(title, ['min-w-0', 'flex-1', 'truncate']);
  const projectElement = makeTextElement(projectName, ['text-token-text-tertiary', 'min-w-0', 'flex-1', 'truncate', 'text-xs']);
  anchor.querySelectorAll = (selector) => selector === '*' ? [titleElement, projectElement] : [];
  anchor.setProjectTitle = (value) => {
    titleElement.textContent = value;
    anchor.textContent = `${value}${projectName}`;
  };
  return anchor;
}

function makeCurrentRecentAnchor(href, title) {
  const anchor = makeAnchor(href, title);
  const makeTextElement = (textContent, classes) => ({
    textContent,
    classList: {
      contains(name) { return classes.includes(name); },
    },
  });
  const titleWrapper = makeTextElement(title, [
    'truncate',
    '[&:has([data-marquee-text])]:min-w-0',
    '[&:has([data-marquee-text])]:flex-1',
  ]);
  const titleText = makeTextElement(title, []);
  const trailingActions = makeTextElement('', ['text-token-text-tertiary']);
  anchor.querySelectorAll = (selector) => selector === '*' ? [titleWrapper, titleText, trailingActions] : [];
  return anchor;
}

function selectAnchors(anchors, selector) {
  if (selector === 'a[href]') return anchors;
  if (selector === 'a[href^="/c/"]') return anchors.filter((anchor) => (anchor.getAttribute('href') || '').startsWith('/c/'));
  return [];
}

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(name) { values.add(name); },
    contains(name) { return values.has(name); },
    remove(name) { values.delete(name); },
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
    },
  };
}

function makeRecentRow(anchor) {
  return {
    anchor,
    classList: makeClassList(),
    querySelector(selector) {
      return selector === 'a[href^="/c/"]' ? anchor : null;
    },
    querySelectorAll(selector) {
      return selector === 'a[href]' ? [anchor] : [];
    },
  };
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.title = '';
    this.type = '';
    this.href = '';
    this.eventListeners = new Map();
    this.clickCount = 0;
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this._classes.add(name)),
      contains: (name) => this._classes.has(name),
      remove: (...names) => names.forEach((name) => this._classes.delete(name)),
      toggle: (name, force) => {
        if (force) this._classes.add(name);
        else this._classes.delete(name);
      },
    };
  }

  get className() { return [...this._classes].join(' '); }
  set className(value) { this._classes = new Set(String(value || '').split(/\s+/).filter(Boolean)); }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] || null;
  }
  get isConnected() {
    let current = this;
    while (current.parentElement) current = current.parentElement;
    return current.tagName === 'HTML';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'href') this.href = String(value);
  }

  getAttribute(name) {
    if (name === 'href' && this.href) return this.href;
    return this.attributes.get(name) ?? null;
  }

  appendChild(child) {
    return this.insertBefore(child, null);
  }

  insertBefore(child, before) {
    child.remove();
    const index = before ? this.children.indexOf(before) : -1;
    if (index >= 0) this.children.splice(index, 0, child);
    else this.children.push(child);
    child.parentElement = this;
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    for (const child of children) this.appendChild(child);
  }

  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    this.eventListeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  contains(candidate) {
    return candidate === this || this.children.some((child) => child.contains(candidate));
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const descendants = [];
    const visit = (element) => {
      for (const child of element.children) {
        descendants.push(child);
        visit(child);
      }
    };
    visit(this);
    return descendants.filter((element) => matchesSelector(element, selector));
  }

  getBoundingClientRect() {
    return { bottom: 20, height: 20, top: 0 };
  }

  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}

  click(options = {}) {
    this.clickCount += 1;
    const event = {
      altKey: false,
      button: 0,
      ctrlKey: false,
      defaultPrevented: false,
      detail: 0,
      metaKey: false,
      shiftKey: false,
      stopPropagation() {},
      preventDefault() { this.defaultPrevented = true; },
      target: this,
      ...options,
    };
    for (const listener of this.eventListeners.get('click') || []) listener(event);
    return event;
  }
}

function matchesSelector(element, selector) {
  return selector.split(',').some((part) => {
    const value = part.trim();
    if (value.startsWith('#')) return element.id === value.slice(1);
    if (value.startsWith('.')) return element.classList.contains(value.slice(1));
    if (value === '[role="listitem"]') return element.getAttribute('role') === 'listitem';
    const hrefPrefix = value.match(/^a\[href\^="([^"]+)"\]$/);
    if (hrefPrefix) return element.tagName === 'A' && (element.getAttribute('href') || '').startsWith(hrefPrefix[1]);
    if (value === 'a[href]') return element.tagName === 'A' && element.getAttribute('href') !== null;
    return element.tagName === value.toUpperCase();
  });
}

function makeRenderedDocument({ historyHref = '/c/history-chat', historyHrefs = null, includeRecent = true, navAriaLabel = 'Chat history' } = {}) {
  const documentElement = new FakeElement('html');
  const nav = new FakeElement('nav');
  if (navAriaLabel) nav.setAttribute('aria-label', navAriaLabel);
  documentElement.appendChild(nav);
  const historySection = new FakeElement('section');
  if (includeRecent) {
    const recentButton = new FakeElement('button');
    const recentHeading = new FakeElement('h2');
    recentHeading.textContent = 'Recent';
    recentButton.appendChild(recentHeading);
    historySection.appendChild(recentButton);
  }
  const officialHrefs = historyHrefs || [historyHref];
  const historyLinks = officialHrefs.map((href, index) => {
    const link = new FakeElement('a');
    link.setAttribute('href', href);
    link.textContent = `History chat ${index + 1}`;
    return link;
  });
  const historyLink = historyLinks[0];
  const historyRow = new FakeElement('li');
  historyRow.setAttribute('role', 'listitem');
  for (const link of historyLinks) historyRow.appendChild(link);
  const historyMenu = new FakeElement('button');
  historyMenu.setAttribute('aria-label', 'History chat options');
  historyRow.appendChild(historyMenu);
  historySection.appendChild(historyRow);
  nav.appendChild(historySection);
  const documentListeners = new Map();
  return {
    dispatchDocumentEvent(type, target = documentElement) {
      documentListeners.get(type)?.({ target, type });
    },
    document: {
      addEventListener(type, listener) { documentListeners.set(type, listener); },
      createElement(tagName) { return new FakeElement(tagName); },
      documentElement,
      getElementById(id) { return documentElement.querySelector(`#${id}`); },
      querySelector(selector) { return documentElement.querySelector(selector); },
      querySelectorAll(selector) {
        const own = matchesSelector(documentElement, selector) ? [documentElement] : [];
        return [...own, ...documentElement.querySelectorAll(selector)];
      },
    },
    historyMenu,
    historyLinks,
    historyRow,
    nav,
    recentSection: includeRecent ? historySection : null,
  };
}

async function loadRenderedContent({
  historyHref = '/c/history-chat',
  historyHrefs = null,
  holdStorageGetCalls = [],
  includeRecent = true,
  navAriaLabel = 'Chat history',
  pathname = '/c/current',
  pins = [],
} = {}) {
  const source = await readFile(contentPath, 'utf8');
  let storageState = { chatdockState: { version: 1, pins } };
  const timers = new Map();
  let nextTimerId = 1;
  let now = 0;
  let storageGetCalls = 0;
  let storageSetCalls = 0;
  const heldStorageGets = [];
  const heldCallNumbers = new Set(holdStorageGetCalls);
  let mutationCallback = null;
  const windowListeners = new Map();
  const storageListeners = [];
  const renderedDocument = makeRenderedDocument({ historyHref, historyHrefs, includeRecent, navAriaLabel });
  const location = {
    href: `https://chatgpt.com${pathname}`,
    origin: 'https://chatgpt.com',
    pathname,
  };
  const history = {
    pushState(_state, _unused, url) { setLocation(url); },
    replaceState(_state, _unused, url) { setLocation(url); },
  };
  const setLocation = (url) => {
    const parsed = new URL(url, location.origin);
    location.href = parsed.href;
    location.pathname = parsed.pathname;
  };
  const context = {
    chrome: {
      storage: {
        local: {
          async get() {
            storageGetCalls += 1;
            const snapshot = structuredClone(storageState);
            if (heldCallNumbers.has(storageGetCalls)) {
              await new Promise((resolve) => heldStorageGets.push(resolve));
            }
            return snapshot;
          },
          async set(value) {
            storageSetCalls += 1;
            storageState = { ...storageState, ...structuredClone(value) };
            for (const listener of storageListeners) {
              listener({ chatdockState: { newValue: structuredClone(storageState.chatdockState) } }, 'local');
            }
          },
        },
        onChanged: { addListener(listener) { storageListeners.push(listener); } },
      },
    },
    console,
    document: renderedDocument.document,
    Element: FakeElement,
    history,
    location,
    MutationObserver: class {
      constructor(callback) { mutationCallback = callback; }
      observe() {}
    },
    Node: { DOCUMENT_POSITION_PRECEDING: 2, ELEMENT_NODE: 1 },
    structuredClone,
    URL,
    window: {
      addEventListener(type, listener) {
        const listeners = windowListeners.get(type) || [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
      },
      clearTimeout(id) { timers.delete(id); },
      setTimeout(callback, delay = 0) {
        const id = nextTimerId++;
        timers.set(id, { callback, dueAt: now + delay });
        return id;
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'content.js' });

  const flushMicrotasks = async () => {
    for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
  };

  const runDueTimers = async () => {
    const due = [...timers.entries()].filter(([, timer]) => timer.dueAt <= now);
    for (const [id, timer] of due) {
      if (!timers.has(id)) continue;
      timers.delete(id);
      timer.callback();
    }
    await flushMicrotasks();
  };

  const flushRender = async () => {
    for (let pass = 0; pass < 10 && timers.size; pass += 1) {
      now = Math.max(now, ...[...timers.values()].map((timer) => timer.dueAt));
      await runDueTimers();
    }
  };

  const getUiSnapshot = () => {
    const root = renderedDocument.document.getElementById('chatdock-root');
    if (!root) return null;
    return {
      addVisible: Boolean(root.querySelector('.chatdock-add')),
      rootCount: renderedDocument.document.querySelectorAll('#chatdock-root').length,
      rows: root.querySelectorAll('.chatdock-row').map((row) => ({
        color: row.querySelector('.chatdock-color-button')?.dataset.color || null,
        current: row.classList.contains('chatdock-current'),
        id: row.dataset.chatdockPinId,
        title: row.querySelector('.chatdock-link')?.textContent || '',
      })),
    };
  };

  const emitMutation = (target = renderedDocument.nav) => {
    mutationCallback?.([{ addedNodes: [], removedNodes: [], target }]);
  };

  const navigatePageWorld = (url, { target = renderedDocument.document.documentElement } = {}) => {
    setLocation(url);
    emitMutation(target);
  };

  return {
    advanceTime: async (milliseconds) => {
      now += milliseconds;
      await runDueTimers();
    },
    dispatchWindowEvent(type) {
      for (const listener of windowListeners.get(type) || []) listener({ type });
    },
    dispatchDocumentEvent: renderedDocument.dispatchDocumentEvent,
    appendDuplicateRoot() {
      const duplicate = new FakeElement('section');
      duplicate.id = 'chatdock-root';
      renderedDocument.nav.appendChild(duplicate);
    },
    clickAdd() {
      renderedDocument.document.querySelector('.chatdock-add')?.click();
    },
    clickRemove(id) {
      const row = renderedDocument.document.querySelectorAll('.chatdock-row').find((candidate) => candidate.dataset.chatdockPinId === id);
      row?.querySelector('.chatdock-remove')?.click();
    },
    emitNavMutation: () => emitMutation(renderedDocument.nav),
    emitRootMutation: () => emitMutation(renderedDocument.document.getElementById('chatdock-root')),
    flushRender,
    flushMicrotasks,
    getAddButton: () => renderedDocument.document.querySelector('.chatdock-add'),
    getHistoryMenu: () => renderedDocument.historyMenu,
    getHistoryLinks: () => renderedDocument.historyLinks,
    getHistoryRow: () => renderedDocument.historyRow,
    getRoot: () => renderedDocument.document.getElementById('chatdock-root'),
    getPinLink(id) {
      const row = renderedDocument.document.querySelectorAll('.chatdock-row').find((candidate) => candidate.dataset.chatdockPinId === id);
      return row?.querySelector('.chatdock-link') || null;
    },
    getSetCalls: () => storageSetCalls,
    getStoredPins: () => structuredClone(storageState.chatdockState.pins),
    getTimerCount: () => timers.size,
    getUiSnapshot,
    history,
    navigatePageWorld,
    releaseStorageGet: () => heldStorageGets.shift()?.(),
    runNextTimer: async () => {
      if (!timers.size) return;
      const [id, timer] = [...timers.entries()].sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      timers.delete(id);
      now = Math.max(now, timer.dueAt);
      timer.callback();
      await flushMicrotasks();
    },
    setLocationOnly: setLocation,
    setStoredPins(pinsValue) {
      storageState = { chatdockState: { version: 1, pins: structuredClone(pinsValue) } };
      for (const listener of storageListeners) {
        listener({ chatdockState: { newValue: structuredClone(storageState.chatdockState) } }, 'local');
      }
    },
  };
}

async function loadContent({ anchors = [], offNavAnchors = [], pathname = '/c/current', pauseGetBatch = 0, pins = [], recentRows = [] } = {}) {
  const source = await readFile(contentPath, 'utf8');
  const instrumented = source.replace(
    /  scheduleRender\(\);\r?\n\}\)\(\);\s*$/,
    '  globalThis.__chatdockTest = { addCurrentPin: typeof addCurrentPin === "function" ? addCurrentPin : undefined, getChatId, getSyncedPins, movePinBefore, removePin, setPinColor, syncOfficialTitles, updatePins };\n})();',
  );
  assert.notEqual(instrumented, source, 'test export hook must be installed');

  let setCalls = 0;
  let observerOptions = null;
  let storageState = { chatdockState: { version: 1, pins } };
  let pausedGets = 0;
  const recentAnchors = recentRows.map((row) => row.anchor);
  const recentSection = {
    querySelectorAll(selector) {
      if (selector === 'a[href]') return recentAnchors;
      if (selector === 'a[href^="/c/"]') return recentAnchors;
      if (selector === 'li, [role="listitem"]') return recentRows;
      return [];
    },
  };
  const nav = {
    getAttribute(name) {
      return name === 'aria-label' ? 'Chat history' : null;
    },
    querySelector() { return null; },
    querySelectorAll(selector) {
      return selectAnchors([...anchors, ...recentAnchors], selector);
    },
  };
  const context = {
    chrome: {
      storage: {
        local: {
          async get() {
            const snapshot = structuredClone(storageState);
            if (pausedGets < pauseGetBatch) {
              pausedGets += 1;
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
            return snapshot;
          },
          async set(value) {
            setCalls += 1;
            storageState = { ...storageState, ...structuredClone(value) };
          },
        },
        onChanged: { addListener() {} },
      },
    },
    console,
    document: {
      addEventListener() {},
      documentElement: {},
      getElementById() { return null; },
      querySelectorAll(selector) {
        if (selector === 'a[href]' || selector === 'a[href^="/c/"]') {
          return selectAnchors([...anchors, ...recentAnchors, ...offNavAnchors], selector);
        }
        if (selector === 'nav') return [nav];
        return [];
      },
    },
    history: { pushState() {}, replaceState() {} },
    location: {
      href: `https://chatgpt.com${pathname}`,
      origin: 'https://chatgpt.com',
      pathname,
    },
    MutationObserver: class {
      observe(_target, options) {
        observerOptions = options;
      }
    },
    Node: { DOCUMENT_POSITION_PRECEDING: 2, ELEMENT_NODE: 1 },
    structuredClone,
    URL,
    window: {
      addEventListener() {},
      clearTimeout() {},
      setTimeout() { return 1; },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(instrumented, context, { filename: 'content.js' });

  return {
    api: context.__chatdockTest,
    getSetCalls: () => setCalls,
    getStoredPins: () => structuredClone(storageState.chatdockState.pins),
    getObserverOptions: () => structuredClone(observerOptions),
    recentSection,
  };
}

test('uses only consistent official links and preserves pin metadata and order', async () => {
  const original = [
    { id: 'chat-a', title: 'Old A', pinnedAt: 10, color: 'blue', customLabel: 'Future label' },
    { id: 'chat-b', title: 'Old B', pinnedAt: 20 },
  ];
  const { api } = await loadContent({
    anchors: [
      makeAnchor('/c/chat-a', 'Old A', true),
      makeAnchor('/c/chat-a', 'New A'),
      makeAnchor('/c/chat-a', '  New   A  '),
      makeAnchor('/c/chat-b', 'New B'),
    ],
    offNavAnchors: [makeAnchor('/c/chat-a', 'Unrelated page link')],
    pins: original,
  });

  const synced = api.getSyncedPins(original);

  assert.deepEqual(Array.from(synced, (pin) => ({ ...pin })), [
    { id: 'chat-a', title: 'New A', pinnedAt: 10, color: 'blue', customLabel: 'Future label' },
    { id: 'chat-b', title: 'New B', pinnedAt: 20 },
  ]);
});

test('keeps the saved title when official candidates are missing, empty, or conflicting', async () => {
  const original = [
    { id: 'missing', title: 'Keep missing', pinnedAt: 1 },
    { id: 'empty', title: 'Keep empty', pinnedAt: 2 },
    { id: 'conflict', title: 'Keep conflict', pinnedAt: 3 },
  ];
  const { api } = await loadContent({
    anchors: [
      makeAnchor('/c/empty', '   '),
      makeAnchor('/c/conflict', 'Candidate one'),
      makeAnchor('/c/conflict', 'Candidate two'),
    ],
    pins: original,
  });

  assert.equal(api.getSyncedPins(original), original);
});

test('recognizes standard and Project conversation URLs without accepting unrelated routes', async () => {
  const { api } = await loadContent();

  assert.equal(api.getChatId('/c/chat-a'), 'chat-a');
  assert.equal(api.getChatId('/g/g-p-project/c/chat-b'), 'chat-b');
  assert.equal(api.getChatId('/g/g-p-project/project'), null);
});

test('F5-style initialization renders the add button for an unpinned Project conversation', async () => {
  const harness = await loadRenderedContent({ pathname: '/g/project123/c/chat456' });

  await harness.flushRender();

  assert.ok(harness.getRoot(), 'ChatRivet must mount');
  assert.ok(harness.getAddButton(), 'the Project conversation must show the add button');
});

test('F5-style initialization keeps the normal unpinned conversation add button working', async () => {
  const harness = await loadRenderedContent({ pathname: '/c/normal-chat' });

  await harness.flushRender();

  assert.ok(harness.getAddButton(), 'the normal conversation must show the add button');
});

test('F5-style initialization does not show the add button for an already pinned Project conversation', async () => {
  const harness = await loadRenderedContent({
    pathname: '/g/project123/c/chat456',
    pins: [{ id: 'chat456', title: 'Project chat', pinnedAt: 1 }],
  });

  await harness.flushRender();

  assert.equal(harness.getAddButton(), null);
});

test('F5-style rendering keeps a registered Recent row and its official actions visible', async () => {
  const harness = await loadRenderedContent({
    pathname: '/c/other-chat',
    pins: [{ id: 'history-chat', title: 'History chat', pinnedAt: 1 }],
  });

  await harness.flushRender();

  assert.equal(harness.getHistoryRow().classList.contains('chatdock-hide-recent-duplicate'), false);
  assert.equal(harness.getHistoryMenu().getAttribute('aria-label'), 'History chat options');
});

test('F5-style Project-only history mounts ChatRivet and renders the add button without Pinned or Recent', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/g/project123/c/history-chat',
    includeRecent: false,
    navAriaLabel: '',
    pathname: '/g/project123/c/chat456',
  });

  await harness.flushRender();

  assert.ok(harness.getRoot(), 'Project history must be a safe mount anchor');
  assert.ok(harness.getAddButton(), 'the unpinned Project conversation must show the add button');
});

test('SPA navigation renders the add button after moving from a pinned normal chat to an unpinned Project conversation', async () => {
  const harness = await loadRenderedContent({
    pathname: '/c/normal-chat',
    pins: [{ id: 'normal-chat', title: 'Normal chat', pinnedAt: 1 }],
  });
  await harness.flushRender();
  assert.equal(harness.getAddButton(), null);

  harness.history.pushState({}, '', '/g/project123/c/chat456');
  await harness.flushRender();

  assert.ok(harness.getAddButton(), 'the unpinned Project conversation must show the add button after SPA navigation');
});

test('adds a Project conversation once with its official title and removes it through the existing path', async () => {
  const harness = await loadContent({
    anchors: [makeAnchor('/g/project123/c/chat456', 'Project conversation title')],
    pathname: '/g/project123/c/chat456',
  });

  assert.equal(typeof harness.api.addCurrentPin, 'function');
  assert.equal(await harness.api.addCurrentPin(), true);
  assert.deepEqual(harness.getStoredPins().map(({ pinnedAt, ...pin }) => ({ ...pin, pinnedAt: Number.isFinite(pinnedAt) })), [
    { id: 'chat456', title: 'Project conversation title', pinnedAt: true },
  ]);

  assert.equal(await harness.api.addCurrentPin(), false);
  assert.equal(harness.getStoredPins().length, 1);

  await harness.api.removePin('chat456');
  assert.deepEqual(harness.getStoredPins(), []);
});

test('adds a Project conversation using only its dedicated chat title element', async () => {
  const projectAnchor = makeProjectAnchor('/g/project123/c/chat456', '開発ログを整理', '開発ログ');
  const harness = await loadContent({
    anchors: [projectAnchor],
    pathname: '/g/project123/c/chat456',
  });

  assert.equal(await harness.api.addCurrentPin(), true);
  assert.deepEqual(harness.getStoredPins().map(({ pinnedAt, ...pin }) => ({ ...pin, pinnedAt: Number.isFinite(pinnedAt) })), [
    { id: 'chat456', title: '開発ログを整理', pinnedAt: true },
  ]);
});

test('syncs a Project conversation from its dedicated title element without appending the Project name', async () => {
  const projectAnchor = makeProjectAnchor('/c/chat456', 'Research Work Notes', 'Work');
  const original = [{ id: 'chat456', title: 'Old Project title', pinnedAt: 10, color: 'blue' }];
  const harness = await loadContent({ anchors: [projectAnchor], pins: original });

  projectAnchor.setProjectTitle('Updated Work Notes');
  await harness.api.syncOfficialTitles(original);

  assert.deepEqual(harness.getStoredPins(), [
    { id: 'chat456', title: 'Updated Work Notes', pinnedAt: 10, color: 'blue' },
  ]);
});

test('keeps the saved title when a structured Project link has no separable title element', async () => {
  const projectAnchor = makeAnchor('/c/chat456', 'Updated title · Project Alpha');
  projectAnchor.querySelectorAll = (selector) => selector === '*' ? [{
    textContent: 'Updated title · Project Alpha',
    classList: { contains() { return false; } },
  }] : [];
  const original = [{ id: 'chat456', title: 'Updated title', pinnedAt: 10, color: 'green' }];
  const harness = await loadContent({ anchors: [projectAnchor], pins: original });

  assert.equal(harness.api.getSyncedPins(original), original);
  assert.equal(harness.getSetCalls(), 0);
});

test('uses the fallback when adding a structured Project link with no separable title element', async () => {
  const projectAnchor = makeAnchor('/g/project123/c/chat456', 'Updated title · Project Alpha');
  const projectWrapper = {
    textContent: 'Updated title · Project Alpha',
    classList: { contains(name) { return name === 'truncate'; } },
  };
  const projectMetadata = {
    textContent: 'Project Alpha',
    classList: { contains(name) { return name === 'text-token-text-tertiary'; } },
  };
  projectAnchor.querySelectorAll = (selector) => selector === '*' ? [projectWrapper, projectMetadata] : [];
  const harness = await loadContent({
    anchors: [projectAnchor],
    pathname: '/g/project123/c/chat456',
  });

  assert.equal(await harness.api.addCurrentPin(), true);
  assert.equal(harness.getStoredPins()[0].title, '無題のチャット');
});

test('keeps the existing title limit when extracting a long Project chat title', async () => {
  const longTitle = `長いProject title ${'A'.repeat(140)}`;
  const projectAnchor = makeProjectAnchor('/g/project123/c/chat456', longTitle, 'Project Alpha');
  const harness = await loadContent({
    anchors: [projectAnchor],
    pathname: '/g/project123/c/chat456',
  });

  assert.equal(await harness.api.addCurrentPin(), true);
  assert.equal(harness.getStoredPins()[0].title, longTitle.slice(0, 120));
  assert.equal(harness.getStoredPins()[0].title.includes('Project Alpha'), false);
});

test('keeps the normal conversation add path working', async () => {
  const harness = await loadContent({
    anchors: [makeAnchor('/c/chat-normal', 'Normal conversation title')],
    pathname: '/c/chat-normal',
  });

  assert.equal(typeof harness.api.addCurrentPin, 'function');
  assert.equal(await harness.api.addCurrentPin(), true);
  assert.deepEqual(harness.getStoredPins().map(({ pinnedAt, ...pin }) => ({ ...pin, pinnedAt: Number.isFinite(pinnedAt) })), [
    { id: 'chat-normal', title: 'Normal conversation title', pinnedAt: true },
  ]);
});

test('adds a normal Recent conversation from the current structured title element', async () => {
  const harness = await loadContent({
    recentRows: [makeRecentRow(makeCurrentRecentAnchor('/c/chat-normal', '違いを比較'))],
    pathname: '/c/chat-normal',
  });

  assert.equal(await harness.api.addCurrentPin(), true);
  assert.deepEqual(harness.getStoredPins().map(({ pinnedAt, ...pin }) => ({ ...pin, pinnedAt: Number.isFinite(pinnedAt) })), [
    { id: 'chat-normal', title: '違いを比較', pinnedAt: true },
  ]);
});

test('syncs a saved pin from the current structured Recent title element', async () => {
  const original = [{ id: 'chat-normal', title: '無題のチャット', pinnedAt: 10, color: 'blue' }];
  const harness = await loadContent({
    pins: original,
    recentRows: [makeRecentRow(makeCurrentRecentAnchor('/c/chat-normal', '違いを比較'))],
  });

  await harness.api.syncOfficialTitles(original, harness.recentSection);

  assert.deepEqual(harness.getStoredPins(), [
    { id: 'chat-normal', title: '違いを比較', pinnedAt: 10, color: 'blue' },
  ]);
});

test('adding and removing a normal pin leaves its official Recent row visible', async () => {
  const recentRow = makeRecentRow(makeAnchor('/c/chat-normal', 'Normal conversation title'));
  const harness = await loadContent({
    pathname: '/c/chat-normal',
    recentRows: [recentRow],
  });

  assert.equal(await harness.api.addCurrentPin(), true);
  assert.equal(recentRow.classList.contains('chatdock-hide-recent-duplicate'), false);

  await harness.api.removePin('chat-normal');

  assert.equal(recentRow.classList.contains('chatdock-hide-recent-duplicate'), false);
  assert.deepEqual(harness.getStoredPins(), []);
});

test('serializes a Project add with a concurrent official-title update without losing either change', async () => {
  const original = [{ id: 'existing', title: 'Old title', pinnedAt: 1, color: 'blue' }];
  const harness = await loadContent({
    anchors: [
      makeAnchor('/c/existing', 'New title'),
      makeAnchor('/g/project123/c/chat456', 'Project conversation title'),
    ],
    pathname: '/g/project123/c/chat456',
    pauseGetBatch: 2,
    pins: original,
  });

  const addProjectPin = harness.api.addCurrentPin();
  const syncTitle = harness.api.syncOfficialTitles(original);
  await Promise.all([addProjectPin, syncTitle]);

  assert.deepEqual(harness.getStoredPins().map(({ pinnedAt, ...pin }) => ({ ...pin, pinnedAt: pin.id === 'chat456' ? Number.isFinite(pinnedAt) : pinnedAt })), [
    { id: 'existing', title: 'New title', pinnedAt: 1, color: 'blue' },
    { id: 'chat456', title: 'Project conversation title', pinnedAt: true },
  ]);
});

test('can read a visible Recent row when it is the only official candidate', async () => {
  const original = [{ id: 'chat-a', title: 'Old A', pinnedAt: 10 }];
  const recentRow = makeRecentRow(makeAnchor('/c/chat-a', 'New A'));
  const harness = await loadContent({ pins: original, recentRows: [recentRow] });

  const synced = harness.api.getSyncedPins(original, harness.recentSection);

  assert.equal(synced[0].title, 'New A');
});

test('does not fall back to another section when Recent has an empty or conflicting match', async () => {
  const original = [
    { id: 'empty', title: 'Keep empty', pinnedAt: 1 },
    { id: 'conflict', title: 'Keep conflict', pinnedAt: 2 },
  ];
  const harness = await loadContent({
    anchors: [
      makeAnchor('/c/empty', 'Other section title'),
      makeAnchor('/c/conflict', 'Other section title'),
    ],
    pins: original,
    recentRows: [
      makeRecentRow(makeAnchor('/c/empty', '   ')),
      makeRecentRow(makeAnchor('/c/conflict', 'Recent title one')),
      makeRecentRow(makeAnchor('/c/conflict', 'Recent title two')),
    ],
  });

  assert.equal(harness.api.getSyncedPins(original, harness.recentSection), original);
});

test('prefers the visible Recent row when another official copy still has a stale title', async () => {
  const original = [{ id: 'chat-a', title: 'Old A', pinnedAt: 10, color: 'green' }];
  const recentRow = makeRecentRow(makeAnchor('/c/chat-a', 'New A'));
  const harness = await loadContent({
    anchors: [makeAnchor('/c/chat-a', 'Old A')],
    pins: original,
    recentRows: [recentRow],
  });

  const synced = harness.api.getSyncedPins(original, harness.recentSection);

  assert.deepEqual(Array.from(synced, (pin) => ({ ...pin })), [
    { id: 'chat-a', title: 'New A', pinnedAt: 10, color: 'green' },
  ]);
});

test('title synchronization keeps a registered Recent row visible while persisting its latest title', async () => {
  const original = [{ id: 'chat-a', title: 'Old A', pinnedAt: 10, color: 'purple' }];
  const recentRow = makeRecentRow(makeAnchor('/c/chat-a', 'New A'));
  const harness = await loadContent({
    anchors: [makeAnchor('/c/chat-a', 'Old A')],
    pins: original,
    recentRows: [recentRow],
  });

  assert.equal(recentRow.classList.contains('chatdock-hide-recent-duplicate'), false);

  await harness.api.syncOfficialTitles(original, harness.recentSection);

  assert.equal(harness.getSetCalls(), 1);
  assert.deepEqual(harness.getStoredPins(), [
    { id: 'chat-a', title: 'New A', pinnedAt: 10, color: 'purple' },
  ]);
});

test('writes through the existing pin update path only when a title changed', async () => {
  const original = [
    { id: 'chat-a', title: 'Old A', pinnedAt: 10, color: 'purple' },
    { id: 'chat-b', title: 'Stable B', pinnedAt: 20 },
  ];
  const harness = await loadContent({
    anchors: [
      makeAnchor('/c/chat-a', 'New A'),
      makeAnchor('/c/chat-b', 'Stable B'),
    ],
    pins: original,
  });

  const first = await harness.api.syncOfficialTitles(original);
  assert.equal(harness.getSetCalls(), 1);
  assert.deepEqual(harness.getStoredPins(), [
    { id: 'chat-a', title: 'New A', pinnedAt: 10, color: 'purple' },
    { id: 'chat-b', title: 'Stable B', pinnedAt: 20 },
  ]);

  const second = await harness.api.syncOfficialTitles(first);
  assert.equal(harness.getSetCalls(), 1);
  assert.deepEqual(Array.from(second, (pin) => ({ ...pin })), harness.getStoredPins());
});

test('observes sidebar text-node changes so official title edits can schedule a render', async () => {
  const harness = await loadContent();

  assert.equal(harness.getObserverOptions().characterData, true);
});

test('F5 initialization and page-world SPA navigation derive the same final UI', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1, color: 'blue' },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2, color: 'green' },
  ];
  const initialized = await loadRenderedContent({ pathname: '/c/chat-b', pins });
  await initialized.flushRender();

  const navigated = await loadRenderedContent({ pathname: '/c/chat-a', pins });
  await navigated.flushRender();
  navigated.navigatePageWorld('/c/chat-b');
  await navigated.flushRender();

  assert.deepEqual(navigated.getUiSnapshot(), initialized.getUiSnapshot());
});

test('does not repaint an old route after a newer route was recognized during storage read', async () => {
  const harness = await loadRenderedContent({
    holdStorageGetCalls: [1],
    pathname: '/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.runNextTimer();

  harness.navigatePageWorld('/c/chat-b');
  harness.emitNavMutation();
  harness.releaseStorageGet();
  await harness.flushMicrotasks();

  const snapshot = harness.getUiSnapshot();
  assert.equal(Boolean(snapshot?.rows.some((row) => row.id === 'chat-a' && row.current)), false);
});

test('does not save a title collected from a route invalidated during queued storage work', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/history-chat',
    holdStorageGetCalls: [2],
    pathname: '/c/chat-a',
    pins: [{ id: 'history-chat', title: 'Saved title', pinnedAt: 1 }],
  });
  await harness.runNextTimer();

  harness.navigatePageWorld('/c/chat-b');
  harness.emitNavMutation();
  harness.releaseStorageGet();
  await harness.flushMicrotasks();

  assert.equal(harness.getStoredPins()[0].title, 'Saved title');
});

test('does not save a title collected before a same-route DOM title change', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/history-chat',
    holdStorageGetCalls: [2],
    pathname: '/c/chat-a',
    pins: [{ id: 'history-chat', title: 'Saved title', pinnedAt: 1 }],
  });
  await harness.runNextTimer();

  harness.getHistoryRow().querySelector('a').textContent = 'Latest title';
  harness.emitNavMutation();
  harness.releaseStorageGet();
  await harness.flushMicrotasks();
  await harness.flushRender();

  assert.equal(harness.getStoredPins()[0].title, 'Latest title');
  assert.equal(harness.getSetCalls(), 1, 'only the fresh DOM title may be persisted');
});

test('mutation storms cannot postpone the first reconcile indefinitely', async () => {
  const harness = await loadRenderedContent({ pathname: '/c/chat-a' });

  for (let index = 0; index < 10; index += 1) {
    harness.emitNavMutation();
    await harness.advanceTime(100);
  }

  assert.ok(harness.getRoot(), 'a bounded scheduler must render while mutations continue');
});

test('sidebar mutations during a delayed storage read do not starve that reconcile', async () => {
  const harness = await loadRenderedContent({
    holdStorageGetCalls: [1],
    pathname: '/c/chat-a',
  });
  await harness.runNextTimer();

  for (let index = 0; index < 20; index += 1) harness.emitNavMutation();
  harness.releaseStorageGet();
  await harness.flushMicrotasks();

  assert.ok(harness.getRoot(), 'DOM-only notifications must not invalidate an awaited storage snapshot');
});

test('popstate reconciles browser back and forward destinations from the current URL', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
  ];
  const harness = await loadRenderedContent({ pathname: '/c/chat-a', pins });
  await harness.flushRender();

  harness.setLocationOnly('/c/chat-b');
  harness.dispatchWindowEvent('popstate');
  await harness.flushRender();
  assert.equal(harness.getUiSnapshot().rows.find((row) => row.id === 'chat-b').current, true);

  harness.setLocationOnly('/c/chat-a');
  harness.dispatchWindowEvent('popstate');
  await harness.flushRender();
  assert.equal(harness.getUiSnapshot().rows.find((row) => row.id === 'chat-a').current, true);
});

test('conversation ID assignment after a new-chat route shows the correct add action', async () => {
  const harness = await loadRenderedContent({ pathname: '/' });
  await harness.flushRender();
  assert.equal(harness.getAddButton(), null);

  harness.navigatePageWorld('/c/new-chat');
  await harness.flushRender();

  assert.ok(harness.getAddButton());
});

test('a bounded post-interaction probe detects a delayed page-world URL-only change', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
  ];
  const harness = await loadRenderedContent({ pathname: '/c/chat-a', pins });
  await harness.flushRender();

  harness.dispatchDocumentEvent('click');
  await harness.advanceTime(0);
  harness.setLocationOnly('/c/chat-b');
  await harness.advanceTime(500);
  await harness.flushRender();

  assert.equal(harness.getUiSnapshot().rows.find((row) => row.id === 'chat-b').current, true);
});

test('a later interaction refreshes the bounded URL probe window', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
  ];
  const harness = await loadRenderedContent({ pathname: '/c/chat-a', pins });
  await harness.flushRender();

  harness.dispatchDocumentEvent('click');
  await harness.advanceTime(1400);
  harness.dispatchDocumentEvent('click');
  await harness.advanceTime(200);
  harness.setLocationOnly('/c/chat-b');
  await harness.advanceTime(400);
  await harness.flushRender();

  assert.equal(harness.getUiSnapshot().rows.find((row) => row.id === 'chat-b').current, true);
  assert.equal(harness.getTimerCount(), 0, 'the refreshed probe window must still stop');
});

test('an interaction still probes after immediately discovering an earlier URL change', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
    { id: 'chat-c', title: 'Gamma', pinnedAt: 3 },
  ];
  const harness = await loadRenderedContent({ pathname: '/c/chat-a', pins });
  await harness.flushRender();

  harness.setLocationOnly('/c/chat-b');
  harness.dispatchDocumentEvent('click');
  await harness.advanceTime(200);
  harness.setLocationOnly('/c/chat-c');
  await harness.advanceTime(400);
  await harness.flushRender();

  assert.equal(harness.getUiSnapshot().rows.find((row) => row.id === 'chat-c').current, true);
  assert.equal(harness.getTimerCount(), 0, 'the interaction probe must remain finite');
});

test('rapid page-world navigation coalesces to the latest A destination', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
    { id: 'chat-c', title: 'Gamma', pinnedAt: 3 },
  ];
  const harness = await loadRenderedContent({ pathname: '/c/chat-a', pins });
  await harness.flushRender();

  harness.navigatePageWorld('/c/chat-b');
  harness.navigatePageWorld('/c/chat-c');
  harness.navigatePageWorld('/c/chat-a');
  await harness.flushRender();

  assert.deepEqual(harness.getUiSnapshot().rows.filter((row) => row.current).map((row) => row.id), ['chat-a']);
});

test('sidebar redraw remounts one root and removes duplicate roots', async () => {
  const harness = await loadRenderedContent({ pathname: '/c/chat-a' });
  await harness.flushRender();
  harness.getRoot().remove();
  harness.appendDuplicateRoot();
  harness.appendDuplicateRoot();

  harness.emitNavMutation();
  await harness.flushRender();

  assert.equal(harness.getUiSnapshot().rootCount, 1);
  assert.ok(harness.getAddButton());
});

test('storage changes reconcile pin order, color, and current state without a route change', async () => {
  const harness = await loadRenderedContent({ pathname: '/c/chat-b' });
  await harness.flushRender();

  harness.setStoredPins([
    { id: 'chat-b', title: 'Beta', pinnedAt: 2, color: 'purple' },
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1, color: 'orange' },
  ]);
  await harness.flushRender();

  assert.deepEqual(harness.getUiSnapshot().rows, [
    { color: 'purple', current: true, id: 'chat-b', title: 'Beta' },
    { color: 'orange', current: false, id: 'chat-a', title: 'Alpha' },
  ]);
});

test('remove action keeps its clicked pin ID when the route changes during storage read', async () => {
  const harness = await loadRenderedContent({
    holdStorageGetCalls: [2],
    pathname: '/c/chat-a',
    pins: [
      { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
      { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
    ],
  });
  await harness.flushRender();

  harness.clickRemove('chat-a');
  await harness.flushMicrotasks();
  harness.navigatePageWorld('/c/chat-b');
  harness.releaseStorageGet();
  await harness.flushMicrotasks();

  assert.deepEqual(harness.getStoredPins().map((pin) => pin.id), ['chat-b']);
});

test('add action keeps its clicked conversation ID when the route changes during storage read', async () => {
  const harness = await loadRenderedContent({
    holdStorageGetCalls: [2],
    pathname: '/c/chat-a',
  });
  await harness.flushRender();

  harness.clickAdd();
  await harness.flushMicrotasks();
  harness.navigatePageWorld('/c/chat-b');
  harness.releaseStorageGet();
  await harness.flushMicrotasks();

  assert.deepEqual(harness.getStoredPins().map((pin) => pin.id), ['chat-a']);
});

test('add action reads the URL at click time when navigation is recognized before rerender', async () => {
  const harness = await loadRenderedContent({ pathname: '/c/chat-a' });
  await harness.flushRender();

  harness.navigatePageWorld('/c/chat-b');
  harness.clickAdd();
  await harness.flushMicrotasks();

  assert.deepEqual(harness.getStoredPins().map((pin) => pin.id), ['chat-b']);
});

test('ChatRivet root mutations do not schedule self-reentry', async () => {
  const harness = await loadRenderedContent({ pathname: '/c/chat-a' });
  await harness.flushRender();
  assert.equal(harness.getTimerCount(), 0);

  harness.emitRootMutation();

  assert.equal(harness.getTimerCount(), 0);
});

test('color and reorder paths preserve pin metadata while changing only their target property', async () => {
  const original = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1, color: 'blue' },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
    { id: 'chat-c', title: 'Gamma', pinnedAt: 3, color: 'green' },
  ];
  const harness = await loadContent({ pins: original });

  await harness.api.setPinColor('chat-b', 'purple');
  const reordered = harness.api.movePinBefore(harness.getStoredPins(), 'chat-c', 'chat-a');

  assert.deepEqual(Array.from(reordered, (pin) => ({ ...pin })), [
    { id: 'chat-c', title: 'Gamma', pinnedAt: 3, color: 'green' },
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1, color: 'blue' },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2, color: 'purple' },
  ]);
});

test('adding an already pinned current chat does not write unchanged storage', async () => {
  const harness = await loadContent({
    pathname: '/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });

  assert.equal(await harness.api.addCurrentPin(), false);
  assert.equal(harness.getSetCalls(), 0);
});

test('plain pin click delegates once to the unique matching official Recent link', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 1);
});

test('pin click keeps native href fallback when official Recent has no match', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/other-chat',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, false);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 0);
});

test('pin click rejects a cross-origin lookalike and keeps native href fallback', async () => {
  const harness = await loadRenderedContent({
    historyHref: 'https://example.com/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, false);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 0);
});

test('pin click keeps native href fallback when official Recent match is ambiguous', async () => {
  const harness = await loadRenderedContent({
    historyHrefs: ['/c/chat-a', '/c/chat-a'],
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(harness.getHistoryLinks().map((link) => link.clickCount), [0, 0]);
});

test('project conversation delegates only to its exact official conversation anchor', async () => {
  const harness = await loadRenderedContent({
    historyHrefs: ['/g/project-a/c/chat-a', '/g/project-a/c/chat-b'],
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(harness.getHistoryLinks().map((link) => link.clickCount), [1, 0]);
});

test('project conversation keeps native fallback when exact official anchors are ambiguous', async () => {
  const harness = await loadRenderedContent({
    historyHrefs: ['/g/project-a/c/chat-a', '/g/project-b/c/chat-a'],
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(harness.getHistoryLinks().map((link) => link.clickCount), [0, 0]);
});

for (const [name, options] of [
  ['Ctrl click', { ctrlKey: true }],
  ['Cmd click', { metaKey: true }],
  ['middle click', { button: 1 }],
  ['Shift click', { shiftKey: true }],
]) {
  test(`${name} keeps native multi-tab navigation behavior`, async () => {
    const harness = await loadRenderedContent({
      historyHref: '/c/chat-a',
      pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
    });
    await harness.flushRender();

    const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100, ...options });

    assert.equal(event.defaultPrevented, false);
    assert.equal(harness.getHistoryLinks()[0].clickCount, 0);
  });
}

test('keyboard-generated pin activation keeps native anchor accessibility behavior', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();

  const event = harness.getPinLink('chat-a').click({ detail: 0, timeStamp: 100 });

  assert.equal(event.defaultPrevented, false);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 0);
});

test('disconnected official candidate safely falls back without double navigation', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();
  const official = harness.getHistoryLinks()[0];
  let connectedReads = 0;
  Object.defineProperty(official, 'isConnected', {
    configurable: true,
    get() {
      connectedReads += 1;
      return connectedReads === 1;
    },
  });

  const event = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });

  assert.equal(event.defaultPrevented, false);
  assert.equal(official.clickCount, 0);
});

test('rapid repeated pin clicks delegate only once and reconciliation still converges', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
  ];
  const harness = await loadRenderedContent({ historyHref: '/c/chat-a', pathname: '/c/chat-b', pins });
  await harness.flushRender();
  const pinLink = harness.getPinLink('chat-a');

  const first = pinLink.click({ detail: 1, timeStamp: 100 });
  const second = pinLink.click({ detail: 1, timeStamp: 150 });
  harness.emitNavMutation();
  await harness.flushRender();

  assert.equal(first.defaultPrevented, true);
  assert.equal(second.defaultPrevented, true);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 1);
  assert.equal(harness.getUiSnapshot().rootCount, 1);
  assert.equal(harness.getTimerCount(), 0);
});

test('rapid repeat uses native fallback when the delegated official candidate disappears', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/chat-a',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();
  const pinLink = harness.getPinLink('chat-a');
  const official = harness.getHistoryLinks()[0];

  const first = pinLink.click({ detail: 1, timeStamp: 100 });
  official.remove();
  const second = pinLink.click({ detail: 1, timeStamp: 150 });

  assert.equal(first.defaultPrevented, true);
  assert.equal(second.defaultPrevented, false);
  assert.equal(official.clickCount, 1);
});

test('route change makes a rapid repeat eligible for fresh official delegation', async () => {
  const harness = await loadRenderedContent({
    historyHref: '/c/chat-a',
    pathname: '/c/chat-b',
    pins: [{ id: 'chat-a', title: 'Alpha', pinnedAt: 1 }],
  });
  await harness.flushRender();
  const pinLink = harness.getPinLink('chat-a');

  const first = pinLink.click({ detail: 1, timeStamp: 100 });
  harness.setLocationOnly('/c/chat-c');
  const second = pinLink.click({ detail: 1, timeStamp: 150 });

  assert.equal(first.defaultPrevented, true);
  assert.equal(second.defaultPrevented, true);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 2);
});

test('recognized round-trip navigation clears rapid-click suppression', async () => {
  const pins = [
    { id: 'chat-a', title: 'Alpha', pinnedAt: 1 },
    { id: 'chat-b', title: 'Beta', pinnedAt: 2 },
  ];
  const harness = await loadRenderedContent({ historyHref: '/c/chat-a', pathname: '/c/chat-b', pins });
  await harness.flushRender();

  const first = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 100 });
  harness.setLocationOnly('/c/chat-a');
  harness.dispatchWindowEvent('popstate');
  await harness.flushRender();
  harness.setLocationOnly('/c/chat-b');
  harness.dispatchWindowEvent('popstate');
  await harness.flushRender();
  const second = harness.getPinLink('chat-a').click({ detail: 1, timeStamp: 150 });

  assert.equal(first.defaultPrevented, true);
  assert.equal(second.defaultPrevented, true);
  assert.equal(harness.getHistoryLinks()[0].clickCount, 2);
});
