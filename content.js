(() => {
  'use strict';
  const ROOT_ID = 'chatdock-root';
  const STORAGE_KEY = 'chatdockState';
  const STATE_VERSION = 1;
  const TITLE_LIMIT = 120;
  const COLOR_OPTIONS = ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'purple', 'pink'];
  const COLOR_NAMES = { blue: '青', teal: '青緑', green: '緑', yellow: '黄', orange: '橙', red: '赤', purple: '紫', pink: '桃' };
  const COLOR_SET = new Set(COLOR_OPTIONS);
  let renderTimer;
  let renderGeneration = 0;
  let lastUrl = location.href;
  let activeColorPickerId = null;
  let dragState = null;
  let pinUpdateQueue = Promise.resolve();
  let renderPendingDuringDrag = false;

  const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function getChatId(pathname = location.pathname) {
    const match = pathname.match(/^\/(?:c|g\/[^/]+\/c)\/([^/?#]+)/);
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

  function getChatIdFromHref(href) {
    try {
      return getChatId(new URL(href, location.origin).pathname);
    } catch {
      return null;
    }
  }

  function findOfficialChatLink(container) {
    return [...container.querySelectorAll('a[href]')].find((link) => (
      !link.closest(`#${ROOT_ID}`) && getChatIdFromHref(link.getAttribute('href') || '')
    )) || null;
  }

  function normalizeColor(value) {
    return typeof value === 'string' && COLOR_SET.has(value) ? value : null;
  }

  function normalizePin(value, seen) {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string') return null;
    const id = value.id.trim();
    if (!id || id.length > 200 || seen.has(id)) return null;
    seen.add(id);
    const pin = { id, title: normalizeText(value.title).slice(0, TITLE_LIMIT) || '無題のチャット', pinnedAt: Number.isFinite(value.pinnedAt) ? value.pinnedAt : Date.now() };
    const color = normalizeColor(value.color);
    if (color) pin.color = color;
    return pin;
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

  function updatePins(updater) {
    const update = pinUpdateQueue.then(async () => {
      const state = await getState();
      await saveState({ version: STATE_VERSION, pins: updater(state.pins.slice()) });
    });
    pinUpdateQueue = update.catch(() => {});
    return update;
  }

  function findChatHistoryNav() {
    const navs = [...document.querySelectorAll('nav')];
    return navs.find((nav) => /チャット履歴|chat history/i.test(nav.getAttribute('aria-label') || '')) || navs.find((nav) => findOfficialChatLink(nav)) || null;
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
    const findTopLevelSection = (element) => {
      let section = element;
      while (section?.parentElement && section.parentElement !== nav) section = section.parentElement;
      return section?.parentElement === nav ? section : null;
    };
    const officialPinsSection = findTopLevelSection(officialPins);
    const recentSection = findTopLevelSection(recent);
    if ((officialPins && !officialPinsSection) || (recent && !recentSection)) return null;
    if (officialPinsSection && recentSection) {
      if (officialPinsSection === recentSection || officialPinsSection.compareDocumentPosition(recentSection) & Node.DOCUMENT_POSITION_PRECEDING) return null;
      return { parent: nav, before: recentSection, recentSection };
    }
    if (recentSection) return { parent: nav, before: recentSection, recentSection };
    if (officialPinsSection) {
      let before = officialPinsSection.nextElementSibling;
      if (before?.id === ROOT_ID) before = before.nextElementSibling;
      return { parent: nav, before, recentSection: null };
    }
    const historyLink = findOfficialChatLink(nav);
    const historySection = findTopLevelSection(historyLink);
    return historySection ? { parent: nav, before: historySection, recentSection: null } : null;
  }

  function getSidebarTitle(id) {
    return getOfficialSidebarTitle(id) || '無題のチャット';
  }

  function getOfficialLinkTitle(candidate) {
    const elements = [...candidate.querySelectorAll('*')];
    const projectTitleElement = elements.find((element) => (
      element.classList.contains('min-w-0') &&
      element.classList.contains('flex-1') &&
      element.classList.contains('truncate') &&
      !element.classList.contains('text-token-text-tertiary')
    ));
    if (projectTitleElement) return normalizeText(projectTitleElement.textContent).slice(0, TITLE_LIMIT);

    const hasProjectMetadata = elements.some((element) => (
      element.classList.contains('text-token-text-tertiary') &&
      normalizeText(element.textContent)
    ));
    if (!hasProjectMetadata) {
      const recentTitleElement = elements.find((element) => (
        element.classList.contains('truncate') &&
        normalizeText(element.textContent)
      ));
      if (recentTitleElement) return normalizeText(recentTitleElement.textContent).slice(0, TITLE_LIMIT);
    }

    if (elements.some((element) => normalizeText(element.textContent))) return '';
    return normalizeText(candidate.textContent).slice(0, TITLE_LIMIT);
  }

  function getOfficialSidebarTitles(container, id) {
    let matched = false;
    const titles = new Set();
    for (const candidate of container.querySelectorAll('a[href]')) {
      if (candidate.closest(`#${ROOT_ID}`) || getChatIdFromHref(candidate.getAttribute('href') || '') !== id) continue;
      matched = true;
      const title = getOfficialLinkTitle(candidate);
      if (title) titles.add(title);
    }
    return { matched, titles };
  }

  function getOfficialSidebarTitle(id, recentSection = null) {
    if (recentSection) {
      const recent = getOfficialSidebarTitles(recentSection, id);
      if (recent.matched) return recent.titles.size === 1 ? recent.titles.values().next().value : null;
    }
    const nav = findChatHistoryNav();
    if (!nav) return null;
    const { titles } = getOfficialSidebarTitles(nav, id);
    return titles.size === 1 ? titles.values().next().value : null;
  }

  function getSyncedPins(pins, recentSection = null) {
    let changed = false;
    const synced = pins.map((pin) => {
      const title = getOfficialSidebarTitle(pin.id, recentSection);
      if (!title || title === pin.title) return pin;
      changed = true;
      return { ...pin, title };
    });
    return changed ? synced : pins;
  }

  async function syncOfficialTitles(pins, recentSection = null) {
    if (getSyncedPins(pins, recentSection) === pins) return pins;
    let synced = pins;
    await updatePins((latest) => {
      synced = getSyncedPins(latest, recentSection);
      return synced;
    });
    return synced;
  }

  async function addCurrentPin() {
    const id = getChatId();
    if (!id) return false;
    let added = false;
    const title = getSidebarTitle(id);
    await updatePins((latest) => {
      if (latest.some((pin) => pin.id === id)) return latest;
      added = true;
      return [...latest, { id, title, pinnedAt: Date.now() }];
    });
    if (added) scheduleRender();
    return added;
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
    if (activeColorPickerId === id) activeColorPickerId = null;
    await updatePins((pins) => pins.filter((pin) => pin.id !== id));
    scheduleRender();
  }

  async function setPinColor(id, color) {
    await updatePins((pins) => pins.map((pin) => {
      if (pin.id !== id) return pin;
      const next = { ...pin };
      if (color) next.color = color;
      else delete next.color;
      return next;
    }));
    activeColorPickerId = null;
    scheduleRender();
  }

  function movePinBefore(pins, draggedId, beforeId) {
    const sourceIndex = pins.findIndex((pin) => pin.id === draggedId);
    if (sourceIndex < 0 || draggedId === beforeId) return pins;
    const next = pins.slice();
    const [dragged] = next.splice(sourceIndex, 1);
    if (beforeId == null) return [...next, dragged];
    const targetIndex = next.findIndex((pin) => pin.id === beforeId);
    if (targetIndex < 0) return pins;
    next.splice(targetIndex, 0, dragged);
    return next;
  }

  function getDragRow(id) {
    return [...(dragState?.list.querySelectorAll('.chatdock-row') || [])].find((row) => row.dataset.chatdockPinId === id) || null;
  }

  function clearDragPreview() {
    const list = dragState?.list;
    if (!list) return;
    list.classList.remove('chatdock-drop-after');
    for (const row of list.querySelectorAll('.chatdock-dragging, .chatdock-drop-before')) {
      row.classList.remove('chatdock-dragging', 'chatdock-drop-before');
    }
  }

  function getDropBeforeId(clientY) {
    if (!dragState) return null;
    const rows = [...dragState.list.querySelectorAll('.chatdock-row')].filter((row) => row.dataset.chatdockPinId !== dragState.draggedId);
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return row.dataset.chatdockPinId;
    }
    return null;
  }

  function updateDragPreview(clientY) {
    if (!dragState) return;
    dragState.beforeId = getDropBeforeId(clientY);
    clearDragPreview();
    getDragRow(dragState.draggedId)?.classList.add('chatdock-dragging');
    if (dragState.beforeId == null) dragState.list.classList.add('chatdock-drop-after');
    else getDragRow(dragState.beforeId)?.classList.add('chatdock-drop-before');
  }

  function removeDragListeners() {
    window.removeEventListener('pointermove', onDragPointerMove);
    window.removeEventListener('pointerup', onDragPointerUp);
    window.removeEventListener('pointercancel', onDragPointerCancel);
  }

  async function finishDrag(commit) {
    const state = dragState;
    if (!state) return;
    removeDragListeners();
    try {
      state.handle.releasePointerCapture?.(state.pointerId);
    } catch {}
    clearDragPreview();
    dragState = null;
    const shouldRender = renderPendingDuringDrag;
    renderPendingDuringDrag = false;
    if (commit) {
      try {
        await updatePins((pins) => movePinBefore(pins, state.draggedId, state.beforeId));
      } finally {
        scheduleRender();
      }
    } else if (shouldRender) {
      scheduleRender();
    }
  }

  function onDragPointerMove(event) {
    if (dragState && event.pointerId === dragState.pointerId) updateDragPreview(event.clientY);
  }

  function onDragPointerUp(event) {
    if (dragState && event.pointerId === dragState.pointerId) finishDrag(true).catch(handleAsyncError);
  }

  function onDragPointerCancel(event) {
    if (dragState && event.pointerId === dragState.pointerId) finishDrag(false).catch(handleAsyncError);
  }

  function startDrag(event, pin, list, handle) {
    if (event.button !== 0 || !event.isPrimary || dragState) return;
    event.preventDefault();
    dragState = { beforeId: null, draggedId: pin.id, handle, list, pointerId: event.pointerId };
    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {}
    window.addEventListener('pointermove', onDragPointerMove);
    window.addEventListener('pointerup', onDragPointerUp);
    window.addEventListener('pointercancel', onDragPointerCancel);
    updateDragPreview(event.clientY);
  }

  function createDragHandle(pin, list) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'chatdock-drag-handle';
    handle.textContent = '⠿';
    handle.title = `${pin.title}をドラッグして並べ替え`;
    handle.setAttribute('aria-label', handle.title);
    handle.addEventListener('pointerdown', (event) => startDrag(event, pin, list, handle));
    return handle;
  }

  function createColorButton(pin) {
    const colorName = pin.color ? COLOR_NAMES[pin.color] : '未設定';
    const button = createButton('', `chatdock-color-button${pin.color ? ` chatdock-color-${pin.color}` : ''}`, () => {
      activeColorPickerId = activeColorPickerId === pin.id ? null : pin.id;
      scheduleRender();
    }, `${pin.title}の色を変更（現在: ${colorName}）`);
    if (pin.color) button.dataset.color = pin.color;
    button.setAttribute('aria-expanded', String(activeColorPickerId === pin.id));
    button.setAttribute('aria-controls', `chatdock-color-picker-${pin.id}`);
    const marker = document.createElement('span');
    marker.className = 'chatdock-color-marker';
    marker.setAttribute('aria-hidden', 'true');
    button.appendChild(marker);
    return button;
  }

  function createColorPicker(pin) {
    const picker = document.createElement('div');
    picker.id = `chatdock-color-picker-${pin.id}`;
    picker.className = 'chatdock-color-picker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', 'ピンの色を選択');
    for (const color of COLOR_OPTIONS) {
      const option = createButton('', `chatdock-color-option chatdock-color-${color}${pin.color === color ? ' chatdock-color-selected' : ''}`, () => setPinColor(pin.id, color), `${pin.title}を${COLOR_NAMES[color]}に設定`);
      picker.appendChild(option);
    }
    picker.appendChild(createButton('None', 'chatdock-color-clear', () => setPinColor(pin.id, null), `${pin.title}の色をクリア`));
    return picker;
  }

  async function render() {
    const generation = ++renderGeneration;
    if (dragState) {
      renderPendingDuringDrag = true;
      return;
    }
    const target = getMountTarget();
    const existing = document.getElementById(ROOT_ID);
    if (!target) {
      existing?.remove();
      return;
    }
    const root = existing || document.createElement('section');
    root.id = ROOT_ID;
    root.className = 'chatdock-root';
    root.setAttribute('aria-label', 'ChatRivet のピン留めチャット');
    if (root.parentElement !== target.parent || root.nextElementSibling !== target.before) target.parent.insertBefore(root, target.before);

    const currentChatId = getChatId();
    let { pins } = await getState();
    if (generation !== renderGeneration || dragState) {
      if (dragState) renderPendingDuringDrag = true;
      return;
    }
    pins = await syncOfficialTitles(pins, target.recentSection);
    if (generation !== renderGeneration || dragState) {
      if (dragState) renderPendingDuringDrag = true;
      return;
    }
    root.replaceChildren();
    const header = document.createElement('div');
    header.className = 'chatdock-header';
    const heading = document.createElement('span');
    heading.className = 'chatdock-heading';
    heading.textContent = 'ChatRivet';
    header.appendChild(heading);
    if (currentChatId && !pins.some((pin) => pin.id === currentChatId)) {
      header.appendChild(createButton('＋', 'chatdock-add', addCurrentPin, '現在のチャットをピン留め'));
    }
    root.appendChild(header);

    const list = document.createElement('div');
    list.className = 'chatdock-list';
    for (const pin of pins) {
      const row = document.createElement('div');
      row.className = `chatdock-row${pin.id === currentChatId ? ' chatdock-current' : ''}`;
      row.dataset.chatdockPinId = pin.id;
      row.appendChild(createDragHandle(pin, list));
      row.appendChild(createColorButton(pin));
      const link = document.createElement('a');
      link.className = 'chatdock-link';
      link.href = getChatUrl(pin.id);
      link.textContent = pin.title;
      link.title = pin.title;
      row.appendChild(link);
      row.appendChild(createButton('×', 'chatdock-remove', () => removePin(pin.id), 'ピン留めを解除'));
      if (activeColorPickerId === pin.id) row.appendChild(createColorPicker(pin));
      list.appendChild(row);
    }
    root.appendChild(list);
  }

  function scheduleRender() {
    if (dragState) {
      renderPendingDuringDrag = true;
      return;
    }
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      lastUrl = location.href;
      render().catch(handleAsyncError);
    }, 120);
  }

  function closeColorPicker() {
    if (!activeColorPickerId) return;
    activeColorPickerId = null;
    scheduleRender();
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

  function shouldRenderForMutations(mutations) {
    const root = document.getElementById(ROOT_ID);
    const nav = findChatHistoryNav();
    if (!nav) return true;
    return mutations.some((mutation) => {
      if (root?.contains(mutation.target)) return false;
      if (nav.contains(mutation.target)) return true;
      return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node === nav || (node.nodeType === Node.ELEMENT_NODE && (node.contains(nav) || nav.contains(node))));
    });
  }

  new MutationObserver((mutations) => {
    if (shouldRenderForMutations(mutations)) scheduleRender();
  }).observe(document.documentElement, { attributeFilter: ['data-active', 'aria-current'], attributes: true, characterData: true, childList: true, subtree: true });
  document.addEventListener('pointerdown', (event) => {
    if (!activeColorPickerId || !(event.target instanceof Element)) return;
    if (event.target.closest('.chatdock-color-button, .chatdock-color-picker')) return;
    closeColorPicker();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeColorPicker();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes[STORAGE_KEY] || changes.pinnedChats)) scheduleRender();
  });
  observeNavigation();
  scheduleRender();
})();
