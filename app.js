// app.js — Router + navigation + drawer logic + PWA hooks
// Globals & constants
const APP_NAME = "Norsk A2 PWA";
const NB_LOCALE = "nb-NO";
const AUDIO_SPEEDS = [0.6, 1.0, 1.08];

// Elements
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const navEl = document.getElementById('nav');
const routeContainer = document.getElementById('routeContainer');
const menuBtn = document.getElementById('menuBtn');

// Year footer
(function setYear(){
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

// Voice preference (Norwegian Bokmål female preferred)
function ensureNbVoice(){
  const setVoice = ()=>{
    const vs = speechSynthesis.getVoices();
    let v = vs.find(x=>/Norwegian|Bokm[aå]l|nb-NO/i.test(x.lang) && /female|woman|dame/i.test(x.name)) ||
            vs.find(x=>/nb|no/i.test(x.lang)) || null;
    window.currentVoice = v;
    const label = document.querySelector('#voiceLabel');
    if (label) label.textContent = v ? `${v.lang} (${v.name})` : 'system default';
  };
  speechSynthesis.onvoiceschanged = setVoice; setVoice();
}
ensureNbVoice();

// Simple speech helper for other modules
function speakText(text, rate=1.0){
  const u = new SpeechSynthesisUtterance(text);
  if (window.currentVoice) u.voice = window.currentVoice;
  u.lang = (window.currentVoice && window.currentVoice.lang) || NB_LOCALE;
  u.rate = rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
window.speakText = speakText;
window.speak = speakText;
window.AUDIO_SPEEDS = AUDIO_SPEEDS;

// Drawer / sidebar behavior
const mqDesktop = window.matchMedia('(min-width: 900px)');
function isDesktop(){ return mqDesktop.matches; }

function openDrawer(){ document.body.classList.add('drawer-open','no-scroll'); menuBtn?.setAttribute('aria-expanded','true'); }
function closeDrawer(){ document.body.classList.remove('drawer-open','no-scroll'); menuBtn?.setAttribute('aria-expanded','false'); }
function toggleDrawer(){ if (document.body.classList.contains('drawer-open')) closeDrawer(); else openDrawer(); }

function toggleSidebarCollapsed(){ document.body.classList.toggle('sidebar-collapsed'); }

menuBtn?.addEventListener('click', ()=>{
  if (isDesktop()) toggleSidebarCollapsed(); else toggleDrawer();
});

overlay?.addEventListener('click', ()=> closeDrawer());

document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') closeDrawer();
});

mqDesktop.addEventListener('change', ()=>{
  // Ensure correct state when crossing breakpoint
  if (isDesktop()){
    document.body.classList.remove('drawer-open','no-scroll');
  } else {
    // keep sidebar-collapsed state but no special action
  }
});

// Navigation rendering — buttons only
async function loadNavigation(){
  const res = await fetch('./data/navigation.json');
  if (!res.ok) throw new Error('Kunne ikke laste navigation.json');
  const data = await res.json();
  renderNavTree(data.tree || []);
}

function renderNavTree(tree){
  navEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  const walk = (nodes, depth=0)=>{
    nodes.forEach(node=>{
      const btn = document.createElement('button');
      btn.className = 'node';
      btn.style.paddingLeft = `${12 + depth*16}px`; // progressive indentation
      btn.setAttribute('type','button');
      btn.dataset.type = node.type;
      if (node.route) btn.dataset.route = node.route;
      if (node.path) btn.dataset.path = node.path;
      btn.dataset.alias = node.alias || '';

      const em = document.createElement('span');
      em.textContent = node.emoji || '•';
      em.style.marginRight = '8px';
      const label = document.createElement('span');
      label.textContent = node.label || node.alias || '';

      btn.appendChild(em);
      btn.appendChild(label);

      btn.addEventListener('click', ()=>{
        handleNodeClick(btn);
      });

      frag.appendChild(btn);

      if (node.children && node.children.length){
        walk(node.children, depth+1);
      }
    });
  };
  walk(tree, 0);
  navEl.appendChild(frag);
}

function handleNodeClick(btn){
  const t = btn.dataset.type;
  if (t === 'route' && btn.dataset.route){
    navigateTo(btn.dataset.route);
  } else if (t === 'dataset' && btn.dataset.path){
    const hash = `#learn?path=${encodeURIComponent(btn.dataset.path)}`;
    navigateTo(hash);
  } else {
    // groups are non-navigable containers in this simple UI
  }
  if (!isDesktop()) closeDrawer(); // auto-close drawer on navigation (mobile)
}

// Router
function parseHash(){
  const h = location.hash || '#home';
  const [route, query=''] = h.split('?');
  const params = new URLSearchParams(query);
  return { route, params };
}

function navigateTo(hash){
  if (location.hash === hash){
    onRouteChange();
  } else {
    location.hash = hash;
  }
}

window.addEventListener('hashchange', onRouteChange);

async function onRouteChange(){
  const { route, params } = parseHash();
  routeContainer.setAttribute('aria-busy','true');

  if (route === '#home'){
    // Show the welcome section (already in DOM). We could also render dynamic home here.
    routeContainer.innerHTML = `
      <div class="welcome">
        <h2>Velkommen!</h2>
        <p>Denne appen hjelper deg å øve på norsk A2 — lytte, ord og samtaler.</p>
        <ul>
          <li>🔊 Alle norske ord og setninger kan spilles av i tre hastigheter.</li>
          <li>📦 Fungerer offline etter første besøk (PWA).</li>
          <li>🧭 Fleksibel navigasjon med flere nivåer.</li>
        </ul>
      </div>`;
  } else if (route === '#learn'){
    const path = params.get('path');
    if (!path){
      routeContainer.innerHTML = '<p>Velg et datasett fra menyen.</p>';
    } else {
      // Delegate to learn.js
      if (typeof window.renderDataset === 'function'){
        try {
          await window.renderDataset(path, routeContainer);
        } catch(err){
          console.error(err);
          routeContainer.innerHTML = `<p>Klarte ikke å laste datasettet: ${path}</p>`;
        }
      } else {
        routeContainer.innerHTML = '<p>Laster læringsmoduler…</p>';
      }
    }
  } else {
    routeContainer.innerHTML = `<p>Ukjent rute: ${route}</p>`;
  }

  routeContainer.setAttribute('aria-busy','false');
}

// Initial boot
loadNavigation().then(()=>{
  if (!location.hash) location.hash = '#home';
  onRouteChange();
}).catch(err=>{
  console.error(err);
  navEl.innerHTML = '<p>Kunne ikke laste navigasjonen.</p>';
});

// Register Service Worker
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}
