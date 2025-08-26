// File: app.js (collapse-ready + single-source nav)
// SPA shell: routing, navigation tree, drawer behavior, PWA install, SW register
// Navigation labels/emojis come directly from data/navigation.json (no nav_aliases.json)

(() => {
  const ROUTES = new Set(["#home", "#learn"]);
  const els = {
    sidebar: document.getElementById('sidebar'),
    treeNav: document.getElementById('treeNav'),
    content: document.getElementById('content'),
    viewHome: document.getElementById('view-home'),
    viewLearn: document.getElementById('view-learn'),
    learnMeta: document.getElementById('learn-meta'),
    learnContent: document.getElementById('learn-content'),
    drawerToggle: document.getElementById('drawerToggle'),
    collapseBtn: document.getElementById('collapseBtn'),
    overlay: document.getElementById('overlay'),
    stopAudioBtn: document.getElementById('stopAudioBtn'),
  };

  const STORAGE_KEYS = {
    drawerCollapsed: 'norskA2.drawerCollapsed',
    expandedAliases: 'norskA2.navExpanded',
    lastDatasetPath: 'norskA2.lastDatasetPath',
  };

  let navTree = {};

  /* --------------------------- Router --------------------------- */
  function navigate(hash) {
    const h = ROUTES.has(hash) ? hash : '#home';
    for (const sec of [els.viewHome, els.viewLearn]) {
      const match = sec.dataset.route === h;
      sec.hidden = !match;
      if (match) sec.focus({ preventScroll: true });
    }
    els.stopAudioBtn.hidden = h !== '#learn';
    if (h !== '#learn') cancelAllAudio();
  }

  window.addEventListener('hashchange', () => navigate(location.hash));
  document.addEventListener('DOMContentLoaded', () => navigate(location.hash || '#home'));

  /* ---------------------- Drawer & Overlay ---------------------- */
  function setDrawerCollapsed(collapsed) {
    els.sidebar.dataset.collapsed = String(!!collapsed);
    localStorage.setItem(STORAGE_KEYS.drawerCollapsed, String(!!collapsed));
    document.body.classList.toggle('sidebar-collapsed', !!collapsed);
  }
  function restoreDrawerState() {
    const collapsed = localStorage.getItem(STORAGE_KEYS.drawerCollapsed) === 'true';
    els.sidebar.dataset.collapsed = String(collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
  }

  // open/close button (mobile)
  els.drawerToggle?.addEventListener('click', () => {
    const isShown = els.sidebar.classList.toggle('show');
    els.drawerToggle.setAttribute('aria-expanded', String(isShown));
    els.overlay.hidden = !isShown;
    document.body.classList.toggle('no-scroll', isShown); // lock background scroll while open
  });
  // overlay click closes drawer
  els.overlay?.addEventListener('click', () => {
    els.sidebar.classList.remove('show');
    els.drawerToggle?.setAttribute('aria-expanded', 'false');
    els.overlay.hidden = true;
    document.body.classList.remove('no-scroll');
  });

  // collapse (desktop)
  els.collapseBtn?.addEventListener('click', () => {
    const collapsed = els.sidebar.dataset.collapsed !== 'true';
    setDrawerCollapsed(collapsed);
  });

  /* ------------------------ Fetch helpers ----------------------- */
  async function fetchAsJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const e = new Error(`HTTP ${r.status} ${r.statusText} for ${url}`);
      e.body = text; e.status = r.status; e.url = url;
      throw e;
    }
    return r.json();
  }
  const resolvePath = (p) => (p.startsWith('./') ? [p, p.slice(2)] : [p]);
  async function loadJSON(path) {
    let lastErr; for (const u of resolvePath(path)) { try { return await fetchAsJSON(u); } catch (e) { lastErr = e; } }
    throw lastErr || new Error(`Could not fetch ${path}`);
  }

  /* --------------------- Navigation rendering ------------------- */
  function loadExpandedSet() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.expandedAliases);
      const set = new Set(raw ? JSON.parse(raw) : []);
      if (!set.size) set.add('nav.home');
      return set;
    } catch { return new Set(['nav.home']); }
  }
  function saveExpandedSet(set) {
    localStorage.setItem(STORAGE_KEYS.expandedAliases, JSON.stringify([...set]));
  }
  const expanded = loadExpandedSet();

  function renderTree() {
    els.treeNav.innerHTML = '';
    els.treeNav.setAttribute('role', 'tree');
    const rootList = document.createElement('ul');
    rootList.setAttribute('role', 'group');
    els.treeNav.appendChild(rootList);

    const makeNode = (node) => {
      const li = document.createElement('li');
      const div = document.createElement('button'); // button improves mobile click reliability
      div.className = 'node';
      div.type = 'button';
      div.dataset.alias = node.alias;
      div.dataset.type = node.type;
      div.setAttribute('role', 'treeitem');

      const labelText = node.label || node.alias || '';
      const emojiText = node.emoji || '•';

      const hasChildren = (node.children && node.children.length > 0);
      const isContainer = node.type === 'group' || (node.type === 'route' && hasChildren);

      if (isContainer) {
        const defaultOpen = node.alias === 'nav.home';
        const isOpen = expanded.has(node.alias) || defaultOpen;
        if (isOpen) expanded.add(node.alias);
        div.setAttribute('aria-expanded', String(isOpen));
      }

      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.textContent = emojiText;
      const label = document.createElement('span');
      label.className = 'txt';
      label.textContent = labelText;
      div.appendChild(emoji); div.appendChild(label); li.appendChild(div);

      if (hasChildren) {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'group');
        const open = expanded.has(node.alias) || node.alias === 'nav.home';
        ul.hidden = !open; li.appendChild(ul);
        (node.children || []).forEach(child => ul.appendChild(makeNode(child)));
      }

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isContainer) {
          const nowOpen = !(div.getAttribute('aria-expanded') === 'true');
          div.setAttribute('aria-expanded', String(nowOpen));
          expanded[nowOpen ? 'add' : 'delete'](node.alias);
          saveExpandedSet(expanded);
          const next = div.nextElementSibling;
          if (next && next.tagName === 'UL') next.hidden = !nowOpen;
          if (node.type === 'route' && node.route) location.hash = node.route;
        } else if (node.type === 'dataset') {
          if (node.path) openDataset(node.alias, node.path);
        } else if (node.type === 'route') {
          if (node.route) location.hash = node.route;
        }
      });

      div.addEventListener('keydown', (ev) => handleTreeKeydown(ev, div));
      return li;
    };

    const root = (navTree.tree || []).find(n => n.alias === 'nav.home') || (navTree.tree || [])[0];
    if (!root) return;
    rootList.appendChild(makeNode(root));
  }

  function handleTreeKeydown(ev, el) {
    const key = ev.key;
    const isGroup = el.hasAttribute('aria-expanded');
    const parentLi = el.parentElement; if (!parentLi) return;
    if (key === 'ArrowRight') {
      if (isGroup && el.getAttribute('aria-expanded') === 'false') { el.click(); ev.preventDefault(); }
    } else if (key === 'ArrowLeft') {
      if (isGroup && el.getAttribute('aria-expanded') === 'true') { el.click(); ev.preventDefault(); }
      else { const pGroup = parentLi.parentElement?.previousElementSibling; if (pGroup && pGroup.classList.contains('node')) pGroup.focus(); }
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      const focusables = [...els.treeNav.querySelectorAll('.node')];
      const i = focusables.indexOf(el);
      const next = key === 'ArrowDown' ? focusables[i + 1] : focusables[i - 1];
      if (next) { next.focus(); ev.preventDefault(); }
    } else if (key === 'Enter' || key === ' ') { el.click(); ev.preventDefault(); }
  }

  function highlightCurrent(alias) {
    els.treeNav.querySelectorAll('.node[aria-current="page"]').forEach(n => n.removeAttribute('aria-current'));
    if (!alias) return;
    const el = els.treeNav.querySelector(`.node[data-alias="${CSS.escape(alias)}"]`);
    if (el) el.setAttribute('aria-current', 'page');
  }

  /* ------------------------- Dataset load ----------------------- */
  async function openDataset(alias, path) {
    try {
      location.hash = '#learn';
      localStorage.setItem(STORAGE_KEYS.lastDatasetPath, path);
      highlightCurrent(alias);
      if (window.loadDataset) {
        await window.loadDataset(path);
      } else {
        const data = await loadJSON(path);
        renderMinimal(data);
      }
    } catch (err) {
      console.error('Dataset load error', err);
      showError(`Kunne ikke laste datasettet.\nPath: ${err.url || path}\nError: ${err.message}`);
    }
  }

  function renderMinimal(data) {
    els.learnMeta.textContent = `${data.title || ''}`;
    els.learnContent.innerHTML = '';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    pre.className = 'card';
    els.learnContent.appendChild(pre);
  }

  function showError(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:sticky;top:0;z-index:100;background:#7f1d1d;color:#fff;padding:8px 12px;border-bottom:1px solid #b91c1c;white-space:pre-wrap;';
    el.textContent = msg;
    els.content.prepend(el);
    setTimeout(() => el.remove(), 6500);
  }

  /* ---------------------------- Init ---------------------------- */
  async function initNav() {
    try {
      navTree = await loadJSON('./data/navigation.json');
      renderTree();

      const last = localStorage.getItem(STORAGE_KEYS.lastDatasetPath);
      if (last) {
        const alias = findAliasByPath(navTree.tree, last);
        if (alias) {
          expandChainToAlias(alias);
          renderTree();
          openDataset(alias, last);
        }
      }
    } catch (err) {
      console.error('Failed loading navigation', err);
      showError(`Kunne ikke laste navigasjonen.\nPath: ${err.url || 'data/navigation.json'}\nError: ${err.message}`);
    }
  }

  function findAliasByPath(nodes, path) {
    for (const n of nodes || []) {
      if (n.type === 'dataset' && n.path === path) return n.alias;
      const inChild = findAliasByPath(n.children || [], path);
      if (inChild) return inChild;
    }
    return null;
  }

  function expandChainToAlias(alias) {
    const parts = alias.split('.');
    const acc = [];
    for (const p of parts) { acc.push(p); expanded.add(acc.join('.')); }
    saveExpandedSet(expanded);
  }

  restoreDrawerState();
  initNav();

  /* -------------------------- PWA: SW/Install ------------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    });
  }

  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; installBtn.hidden = false;
  });
  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome) installBtn.hidden = true;
    deferredPrompt = null;
  });

  /* ------------------------ Audio: global stop ------------------ */
  function cancelAllAudio() {
    try { window.speechSynthesis.cancel(); } catch {}
    document.dispatchEvent(new CustomEvent('tts:stop-all'));
  }
  els.stopAudioBtn?.addEventListener('click', cancelAllAudio);
})();
