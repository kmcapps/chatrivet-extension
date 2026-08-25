(() => {
  'use strict';
  const ROOT_ID = 'chatdock-root';
  const STORAGE_KEY = 'chatdockState';
  const STATE_VERSION = 1;
  const TITLE_LIMIT = 120;
  let renderTimer;
  let renderGeneration = 0;
  let lastUrl = location.href;

  const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function getChatId(pathname = location.pathname) {
    const match = pathname.match(/^\/c\/([^/?#]+)/);
    if (!match || match[1].length > 200) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  function getChatUrl(id) {
    return `${location.origin}/c/${encodeURIComponent(id)}`;
  }

  function normalizePin(value, seen) {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string') return null;
    const id = value.id.trim();
    if (!id || id.length > 200 || seen.has(id)) return null;
    seen.add(id);
    return { id, title: normalizeText(value.title).slice(0, TITLE_LIMIT) || '無題のチャット', pinnedAt: Number.isFinite(value.pinnedAt) ? value.pinnedAt : Date.now() };
  }

  function normalizeState(raw) {
    const source = Array.isArray(raw) ? raw : raw?.pins;
    const seen = new Set();
    return { version: STATE_VERSION, pins: Array.isArray(source) ? source.map((value) => normalizePin(value, seen)).filter(Boolean) : [] };
  }

  async function getState() {
    const result = await chrome.storage.local.get([STORAGE_KEY, 'pinnedChats']);
    return normalizeState(result[STORAGE_KEY] ?? result.pinnedChats);
  }

  async function saveState(state) {
    await chrome.storage.local.set({ [STORAGE_KEY]: normalizeState(state) });
  }

  async function updatePins(updater) {
    const state = await getState();
    await saveState({ version: STATE_VERSION, pins: updater(state.pins.slice()) });
  }

  function findChatHistoryNav() {
    const navs = [...document.querySelectorAll('nav')];
    return navs.find((nav) => /チャット履歴|chat history/i.test(nav.getAttribute('aria-label') || '')) || navs.find((nav) => nav.querySelector('a[href^="/c/"]')) || null;
  }

  function findSectionButton(nav, names) {
    return [...nav.querySelectorAll('button')].find((button) => {
      const heading = button.querySelector('h1, h2, h3');
      return heading && names.test(normalizeText(heading.textContent));
    }) || null;
  }

  function getMountTarget() {
    const nav = findChatHistoryNav();
    if (!nav) return null;
    const officialPins = findSectionButton(nav, /^(ピン留め|pinned)$/i);
    const recent = findSectionButton(nav, /^(最近|recent)$/i);
    const findTopLevelSection = (button) => {
      let section = button?.parentElement;
      while (section?.parentElement && section.parentElement !== nav) section = section.parentElement;
      return section?.parentElement === nav ? section : null;
    };
    const officialPinsSection = findTopLevelSection(officialPins);
    const recentSection = findTopLevelSection(recent);
    if (!officialPins || !recent || !officialPinsSection || !recentSection || officialPinsSection === recentSection || officialPinsSection.compareDocumentPosition(recentSection) & Node.DOCUMENT_POSITION_PRECEDING) return null;
    return { parent: nav, before: recentSection, recentSection };
  }

  function clearHiddenRecentDuplicates() {
    for (const row of document.querySelectorAll('.chatdock-hide-recent-duplicate')) {
      row.classList.remove('chatdock-hide-recent-duplicate');
    }
  }

  function syncRecentDuplicates(recentSection, pins) {
    clearHiddenRecentDuplicates();
    const pinnedIds = new Set(pins.map((pin) => pin.id));
    const rows = [...recentSection.querySelectorAll('li, [role="listitem"]')];
    for (const row of rows) {
      const link = row.querySelector('a[href^="/c/"]');
      const id = link ? getChatId(link.getAttribute('href') || '') : null;
      row.classList.toggle('chatdock-hide-recent-duplicate', Boolean(id && pinnedIds.has(id)));
    }
  }

  function getSidebarTitle(id) {
    const link = [...document.querySelectorAll('a[href^="/c/"]')].find((candidate) => getChatId(candidate.getAttribute('href') || '') === id);
    return normalizeText(link?.textContent).slice(0, TITLE_LIMIT) || '無題のチャット';
  }

  function handleAsyncError(error) {
    if (String(error?.message ?? error) === 'Extension context invalidated.') return;
    console.error('ChatRivet: unexpected asynchronous error.', error);
  }

  function createButton(label, className, onClick, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', (event) => {
      try {
        const result = onClick(event);
        if (result && typeof result.then === 'function') result.catch(handleAsyncError);
      } catch (error) {
        handleAsyncError(error);
      }
    });
    return button;
  }

  async function removePin(id) {
    await updatePins((pins) => pins.filter((pin) => pin.id !== id));
    scheduleRender();
  }

  async function render() {
    const generation = ++renderGeneration;
    const target = getMountTarget();
    const existing = document.getElementById(ROOT_ID);
    if (!target) {
      clearHiddenRecentDuplicates();
      existing?.remove();
      return;
    }
    const root = existing || document.createElement('section');
    root.id = ROOT_ID;
    root.className = 'chatdock-root';
    root.setAttribute('aria-label', 'ChatRivet のピン留めチャット');
    if (root.parentElement !== target.parent || root.nextElementSibling !== target.before) target.parent.insertBefore(root, target.before);

    const currentChatId = getChatId();
    const { pins } = await getState();
    if (generation !== renderGeneration) return;
    root.replaceChildren();
    const header = document.createElement('div');
    header.className = 'chatdock-header';
    const heading = document.createElement('span');
    heading.className = 'chatdock-heading';
    heading.textContent = 'ChatRivet';
    header.appendChild(heading);
    if (currentChatId && !pins.some((pin) => pin.id === currentChatId)) {
      header.appendChild(createButton('＋', 'chatdock-add', async () => {
        const id = getChatId();
        if (!id) return;
        await updatePins((latest) => latest.some((pin) => pin.id === id) ? latest : [...latest, { id, title: getSidebarTitle(id), pinnedAt: Date.now() }]);
        scheduleRender();
      }, '現在のチャットをピン留め'));
    }
    root.appendChild(header);

    const list = document.createElement('div');
    list.className = 'chatdock-list';
    for (const pin of pins) {
      const row = document.createElement('div');
      row.className = `chatdock-row${pin.id === currentChatId ? ' chatdock-current' : ''}`;
      const link = document.createElement('a');
      link.className = 'chatdock-link';
      link.href = getChatUrl(pin.id);
      link.textContent = pin.title;
      link.title = pin.title;
      row.appendChild(link);
      row.appendChild(createButton('×', 'chatdock-remove', () => removePin(pin.id), 'ピン留めを解除'));
      list.appendChild(row);
    }
    root.appendChild(list);
    syncRecentDuplicates(target.recentSection, pins);
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      lastUrl = location.href;
      render().catch(handleAsyncError);
    }, 120);
  }

  function observeNavigation() {
    const notify = () => { if (location.href !== lastUrl) scheduleRender(); };
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        notify();
        return result;
      };
    }
    window.addEventListener('popstate', notify);
  }

  new MutationObserver((mutations) => {
    const root = document.getElementById(ROOT_ID);
    if (mutations.some((mutation) => !root || !root.contains(mutation.target))) scheduleRender();
  }).observe(document.documentElement, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes[STORAGE_KEY] || changes.pinnedChats)) scheduleRender();
  });
  observeNavigation();
  scheduleRender();
})();
