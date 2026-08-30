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
  };
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

function makeRecentRow(anchor, hidden = false) {
  return {
    anchor,
    classList: makeClassList(hidden ? ['chatdock-hide-recent-duplicate'] : []),
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

function makeRenderedDocument({ historyHref = '/c/history-chat', includeRecent = true, navAriaLabel = 'Chat history' } = {}) {
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
  const historyLink = new FakeElement('a');
  historyLink.setAttribute('href', historyHref);
  historyLink.textContent = 'History chat';
  historySection.appendChild(historyLink);
  nav.appendChild(historySection);
  const documentListeners = new Map();
  return {
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
    nav,
    recentSection: includeRecent ? historySection : null,
  };
}

async function loadRenderedContent({ historyHref = '/c/history-chat', includeRecent = true, navAriaLabel = 'Chat history', pathname = '/c/current', pins = [] } = {}) {
  const source = await readFile(contentPath, 'utf8');
  let storageState = { chatdockState: { version: 1, pins } };
  const timers = new Map();
  let nextTimerId = 1;
  const renderedDocument = makeRenderedDocument({ historyHref, includeRecent, navAriaLabel });
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
          async get() { return structuredClone(storageState); },
          async set(value) { storageState = { ...storageState, ...structuredClone(value) }; },
        },
        onChanged: { addListener() {} },
      },
    },
    console,
    document: renderedDocument.document,
    Element: FakeElement,
    history,
    location,
    MutationObserver: class { observe() {} },
    Node: { DOCUMENT_POSITION_PRECEDING: 2, ELEMENT_NODE: 1 },
    structuredClone,
    URL,
    window: {
      addEventListener() {},
      clearTimeout(id) { timers.delete(id); },
      setTimeout(callback) {
        const id = nextTimerId++;
        timers.set(id, callback);
        return id;
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'content.js' });

  const flushRender = async () => {
    for (let pass = 0; pass < 10 && timers.size; pass += 1) {
      const callbacks = [...timers.values()];
      timers.clear();
      for (const callback of callbacks) callback();
      for (let tick = 0; tick < 6; tick += 1) await Promise.resolve();
    }
  };

  return {
    flushRender,
    getAddButton: () => renderedDocument.document.querySelector('.chatdock-add'),
    getRoot: () => renderedDocument.document.getElementById('chatdock-root'),
    history,
  };
}

async function loadContent({ anchors = [], offNavAnchors = [], pathname = '/c/current', pauseGetBatch = 0, pins = [], recentRows = [] } = {}) {
  const source = await readFile(contentPath, 'utf8');
  const instrumented = source.replace(
    /  observeNavigation\(\);\r?\n  scheduleRender\(\);\r?\n\}\)\(\);\s*$/,
    '  observeNavigation();\n  globalThis.__chatdockTest = { addCurrentPin: typeof addCurrentPin === "function" ? addCurrentPin : undefined, getChatId, getSyncedPins, removePin, syncOfficialTitles, syncRecentDuplicates, updatePins };\n})();',
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
        if (selector === '.chatdock-hide-recent-duplicate') {
          return recentRows.filter((row) => row.classList.contains('chatdock-hide-recent-duplicate'));
        }
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

test('can read a hidden Recent duplicate when it is the only official candidate', async () => {
  const original = [{ id: 'chat-a', title: 'Old A', pinnedAt: 10 }];
  const recentRow = makeRecentRow(makeAnchor('/c/chat-a', 'New A'), true);
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
      makeRecentRow(makeAnchor('/c/empty', '   '), true),
      makeRecentRow(makeAnchor('/c/conflict', 'Recent title one'), true),
      makeRecentRow(makeAnchor('/c/conflict', 'Recent title two'), true),
    ],
  });

  assert.equal(harness.api.getSyncedPins(original, harness.recentSection), original);
});

test('prefers the hidden Recent duplicate when another official copy still has a stale title', async () => {
  const original = [{ id: 'chat-a', title: 'Old A', pinnedAt: 10, color: 'green' }];
  const recentRow = makeRecentRow(makeAnchor('/c/chat-a', 'New A'), true);
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

test('F5-style initialization can hide Recent first and still persist its latest title', async () => {
  const original = [{ id: 'chat-a', title: 'Old A', pinnedAt: 10, color: 'purple' }];
  const recentRow = makeRecentRow(makeAnchor('/c/chat-a', 'New A'));
  const harness = await loadContent({
    anchors: [makeAnchor('/c/chat-a', 'Old A')],
    pins: original,
    recentRows: [recentRow],
  });

  harness.api.syncRecentDuplicates(harness.recentSection, original);
  assert.equal(recentRow.classList.contains('chatdock-hide-recent-duplicate'), true);

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
