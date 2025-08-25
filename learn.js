// File: learn.js (fresh)
// Renders datasets (blocks[]) + Text‑to‑Speech (word chips, sentence speeds)

(() => {
  const els = {
    meta: document.getElementById('learn-meta'),
    container: document.getElementById('learn-content'), // actual blocks container
    scroller: document.getElementById('content'),        // scrollable main area
    stopBtn: document.getElementById('stopAudioBtn'),
  };

  /* ===================== TTS ===================== */
  const TTS = { locale: 'nb-NO', rate: 1, voice: null, ready: false };
  function pickNbVoice() {
    const voices = window.speechSynthesis.getVoices();
    let nb = voices.find(v => /^(nb|no)/i.test(v.lang));
    if (!nb) nb = voices.find(v => v.lang && v.lang.startsWith('en'));
    TTS.voice = nb || null; TTS.ready = true;
  }
  if ('speechSynthesis' in window) {
    try { pickNbVoice(); } catch {}
    window.speechSynthesis.onvoiceschanged = () => pickNbVoice();
  }
  function cancelAll() { try { window.speechSynthesis.cancel(); } catch {} }
  document.addEventListener('tts:stop-all', cancelAll);

  function speak(text, rate = 1.0) {
    cancelAll(); if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; if (TTS.voice) u.voice = TTS.voice; u.lang = (TTS.voice && TTS.voice.lang) || 'nb-NO';
    window.speechSynthesis.speak(u);
  }

  /* ===================== helpers ===================== */
  function tokenizeWords(str) {
    const tokens = []; const re = /(\w+|[åæøÅÆØA-Za-z]+|\d+|\S)/g; let m;
    while ((m = re.exec(str || '')) !== null) tokens.push(m[0]);
    return tokens;
  }
  function mkWordTokens(noText) {
    const wrap = document.createElement('span'); wrap.className = 'no-words';
    tokenizeWords(noText).forEach((p, i, arr) => {
      const span = document.createElement('span'); span.className = 'word'; span.textContent = p; span.tabIndex = 0; span.dataset.word = p;
      span.addEventListener('click', () => speak(p, 1));
      span.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); speak(p, 1); } });
      wrap.appendChild(span); if (i < arr.length - 1) wrap.appendChild(document.createTextNode(' '));
    });
    return wrap;
  }
  function mkSpeakBtn(text, label = '🔊') {
    const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = label;
    btn.addEventListener('click', () => speak(text, 1.0)); return btn;
  }
  function div(cls){ const d=document.createElement('div'); if(cls) d.className=cls; return d; }
  function h3(txt){ const h=document.createElement('h3'); h.textContent=txt; return h; }
  function pEl(txt,cls){ const p=document.createElement('p'); if(cls) p.className=cls; p.textContent=txt; return p; }
  function strong(txt){ const s=document.createElement('strong'); s.textContent=txt; return s; }
  function esc(x){ return (x ?? '').toString().replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s])); }

  /* ===================== RENDERERS ===================== */
  const R = {};

  R.heading = (blk) => { const card = div('block card'); const h = document.createElement('h2'); h.textContent = blk.text || blk.title || 'Untitled'; card.appendChild(h); return card; };

  R.image = (blk) => { const c = div('block image card'); const fig = document.createElement('figure'); const img = document.createElement('img'); img.src = blk.src; img.alt = blk.alt || ''; fig.appendChild(img); if (blk.alt) { const cap = document.createElement('figcaption'); cap.textContent = blk.alt; fig.appendChild(cap); } c.appendChild(fig); return c; };

  R.lines = (blk) => {
    const c = div('block card'); c.appendChild(h3(blk.title || 'Lines'));
    (blk.items || []).forEach(item => {
      const box = div('card'); const no = item.no || ''; const top = div();
      top.appendChild(strong('NO: ')); top.appendChild(mkWordTokens(no)); box.appendChild(top); box.appendChild(mkChips(no));
      if (item.pron) box.appendChild(pEl('Pron: ' + item.pron, 'muted'));
      if (item.en) box.appendChild(pEl('EN: ' + item.en));
      c.appendChild(box);
    });
    return c;
  };

  R.mono = (blk) => {
    const c = div('block card'); c.appendChild(h3(blk.title || 'Monolog'));
    (blk.items || []).forEach(slot => {
      const box = div('card'); const title = pEl(slot.no || slot.title || ''); title.style.fontWeight = '600'; box.appendChild(title);
      if (Array.isArray(slot.model)) {
        slot.model.forEach(m => {
          const no = m.no || ''; const top = div(); top.appendChild(strong('NO: ')); top.appendChild(mkWordTokens(no)); box.appendChild(top); box.appendChild(mkChips(no));
          if (m.pron) box.appendChild(pEl('Pron: ' + m.pron, 'muted'));
          if (m.en) box.appendChild(pEl('EN: ' + m.en));
        });
      }
      c.appendChild(box);
    });
    return c;
  };

  R.verbs_table = (blk) => {
    const c = div('block card');
    const head = div(); const h = h3(blk.title || 'Verb'); head.appendChild(h);
    const hint = pEl('Trykk på ord eller 🔊 for å høre.'); hint.className = 'muted'; head.appendChild(hint);
    c.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Infinitiv</th><th>Presens</th><th>Preteritum</th><th>Perfektum</th><th>Futurum</th><th>Notater</th></tr>';
    table.appendChild(thead);
    const tb = document.createElement('tbody');

    (blk.verbs || []).forEach(v => {
      const tr = document.createElement('tr');
      const cells = [
        { form: v.inf, pron: v.inf_pron, en: v.inf_en },
        { form: v.pres, pron: v.pres_pron, en: v.pres_en },
        { form: v.pret, pron: v.pret_pron, en: v.pret_en },
        { form: v.perf, pron: v.perf_pron, en: v.perf_en },
        { form: v.fut,  pron: v.fut_pron,  en: v.fut_en  }
      ];

      cells.forEach(({form, pron, en}) => {
        const td = document.createElement('td');
        const box = document.createElement('div'); box.style.display = 'grid'; box.style.gap = '4px';
        const line = document.createElement('div'); line.style.display='flex'; line.style.alignItems='center'; line.style.gap='6px';
        line.appendChild(mkWordTokens(form || ''));
        line.appendChild(mkSpeakBtn(form || ''));
        box.appendChild(line);
        if (pron) box.appendChild(pEl('Pron: ' + pron, 'muted'));
        if (en)   box.appendChild(pEl('EN: ' + en, 'muted'));
        td.appendChild(box); tr.appendChild(td);
      });

      const notesTd = document.createElement('td'); notesTd.textContent = v.notes || '';
      tr.appendChild(notesTd); tb.appendChild(tr);
    });

    table.appendChild(tb); c.appendChild(table); return c;
  };

  R.fill_list = (blk) => {
    const c = div('block card'); c.appendChild(h3(blk.title || 'Verb Diktat'));
    const list = div('quiz-list');
    (blk.items || []).forEach((it) => {
      const item = div('quiz-item'); const label = div();
      label.appendChild(strong('NO: ')); label.appendChild(mkWordTokens(it.no || '')); item.appendChild(label);
      const input = document.createElement('input'); input.type='text'; input.placeholder='svar'; input.style.marginTop='8px'; item.appendChild(input);
      const check = document.createElement('button'); check.className='btn'; check.textContent='Sjekk'; check.style.marginLeft='8px';
      const fb = div('quiz-feedback');
      check.addEventListener('click', () => {
        const ok = (input.value || '').trim().toLowerCase() === (it.ans || '').toLowerCase();
        fb.textContent = ok ? 'Riktig!' : `Riktig svar: ${it.ans}`; fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'bad');
      });
      const controls = div(); controls.appendChild(check); controls.appendChild(fb); item.appendChild(controls);
      list.appendChild(item);
    });
    c.appendChild(list); return c;
  };

  R.mcq_list = (blk) => {
    const c = div('block card'); c.appendChild(h3(blk.title || 'Multiple Choice'));
    const list = div('quiz-list');
    (blk.items || []).forEach((q, qi) => {
      const item = div('quiz-item'); const qlabel = div();
      qlabel.appendChild(strong('NO: ')); qlabel.appendChild(mkWordTokens(q.noQ || '')); item.appendChild(qlabel);
      const opts = div('quiz-options');
      (q.options || []).forEach((opt, oi) => {
        const row = div('quiz-option'); const id = `mcq_${qi}_${oi}`;
        const radio = document.createElement('input'); radio.type='radio'; radio.name=`mcq_${qi}`; radio.id=id;
        const lab = document.createElement('label'); lab.setAttribute('for', id); lab.textContent = opt.no || '';
        row.appendChild(radio); row.appendChild(lab); opts.appendChild(row);
      });
      item.appendChild(opts);
      const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Sjekk';
      const fb = div('quiz-feedback');
      btn.addEventListener('click', () => {
        const idx = q.answerIndex; const name = `mcq_${qi}`;
        const checked = [...item.querySelectorAll(`input[name="${name}"]`)].findIndex(el => el.checked);
        const ok = checked === idx; fb.textContent = ok ? 'Riktig!' : `Riktig svar: ${q.options?.[idx]?.no || ''}`; fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'bad');
      });
      item.appendChild(btn); item.appendChild(fb); list.appendChild(item);
    });
    c.appendChild(list); return c;
  };

  R.tf_list = (blk) => {
    const c = div('block card'); c.appendChild(h3(blk.title || 'Sant / Usant'));
    const list = div('quiz-list');
    (blk.items || []).forEach((q) => {
      const item = div('quiz-item'); const label = div();
      label.appendChild(strong('NO: ')); label.appendChild(mkWordTokens(q.no || ''));
      if (q.en) item.appendChild(pEl('EN: ' + q.en));
      const yes = document.createElement('button'); yes.className='btn'; yes.textContent='Sant';
      const no = document.createElement('button');  no.className='btn';  no.textContent='Usant';
      const fb = div('quiz-feedback');
      yes.addEventListener('click', () => setTF(true));
      no.addEventListener('click', () => setTF(false));
      function setTF(val) {
        const ok = !!q.answer === val; fb.textContent = ok ? 'Riktig!' : (val ? 'Det er ikke sant.' : 'Det er sant.'); fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'bad');
      }
      const ctr = div(); ctr.appendChild(yes); ctr.appendChild(no); ctr.appendChild(fb);
      item.appendChild(label); item.appendChild(ctr); list.appendChild(item);
    });
    c.appendChild(list); return c;
  };

  R.qa_list = (blk) => {
    const c = div('block card'); c.appendChild(h3(blk.title || 'Spørsmål'));
    (blk.items || []).forEach(q => {
      const cardQ = div('card');
      if (q.noQ) { const top = div(); top.appendChild(strong('Q NO: ')); top.appendChild(mkWordTokens(q.noQ)); cardQ.appendChild(top); cardQ.appendChild(mkChips(q.noQ)); }
      if (q.pronQ) cardQ.appendChild(pEl('PronQ: ' + q.pronQ, 'muted'));
      if (q.enQ)  cardQ.appendChild(pEl('EN: ' + q.enQ));
      if (q.noA) { const ans = div(); ans.appendChild(strong('A NO: ')); ans.appendChild(mkWordTokens(q.noA)); cardQ.appendChild(ans); cardQ.appendChild(mkChips(q.noA)); }
      if (q.pronA) cardQ.appendChild(pEl('PronA: ' + q.pronA, 'muted'));
      if (q.enA)  cardQ.appendChild(pEl('EN: ' + q.enA));
      c.appendChild(cardQ);
    });
    return c;
  };

  R.markdown = (blk) => { const c = div('block markdown card'); c.appendChild(h3(blk.title || 'Notater')); c.appendChild(pEl(blk.text || '')); return c; };

  // Audio chips for any NO line
  function mkChips(noText) {
    const row = document.createElement('div'); row.className = 'chips';
    [
      { label: '🐢 Extra Slow', rate: 0.60 },
      { label: '🐢 Slow',       rate: 0.80 },
      { label: '▶️ Normal',     rate: 1.00 },
      { label: '🎧 Native',     rate: 1.08 },
    ].forEach(s => { const b = document.createElement('button'); b.className='chip'; b.textContent=s.label; b.addEventListener('click', () => speak(noText, s.rate)); row.appendChild(b); });
    return row;
  }

  /* ===================== Public API ===================== */
  async function loadDataset(path) {
    const resp = await fetch(path, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${path}`);
    const data = await resp.json(); renderDataset(data);
  }

  function renderDataset(data) {
    cancelAll(); els.meta.textContent = data.title || '';
    els.scroller?.scrollTo?.(0, 0); els.container.innerHTML = '';
    (data.blocks || []).forEach(blk => { const kind = (blk.kind || '').toLowerCase(); const fn = R[kind] || R_unknown; els.container.appendChild(fn(blk)); });
  }

  function R_unknown(blk) { const c = div('block card'); c.appendChild(h3(blk.title || `Unknown block: ${blk.kind}`)); const pre=document.createElement('pre'); pre.textContent = JSON.stringify(blk, null, 2); c.appendChild(pre); return c; }

  // Expose for app.js
  window.loadDataset = loadDataset;
})();
