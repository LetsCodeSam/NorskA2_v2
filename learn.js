// learn.js — Block registry & renderers for Norsk A2 PWA

const NB_LOCALE = "nb-NO";

// Utility: word segmentation with Intl.Segmenter
function renderTokens(container, text){
  const seg = new Intl.Segmenter(NB_LOCALE,{ granularity:'word' });
  const s = text.normalize('NFC');
  for (const { segment, isWordLike } of seg.segment(s)){
    const el = document.createElement('span');
    el.textContent = segment;
    el.className = isWordLike ? 'token' : 'space';
    if (isWordLike){
      el.addEventListener('click', ()=> playWithSpeeds(segment));
    }
    container.appendChild(el);
  }
}

function makePlayBtn(text){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '🔊';
  btn.addEventListener('click', ()=> playWithSpeeds(text));
  return btn;
}

function playWithSpeeds(text){
  if (!window.speakText){
    alert('Speech synthesis ikke tilgjengelig');
    return;
  }
  // sequential play at 3 speeds
  const speeds = [0.6, 1.0, 1.08];
  let i = 0;
  function next(){
    if (i>=speeds.length) return;
    const utter = new SpeechSynthesisUtterance(text);
    if (window.currentVoice) utter.voice = window.currentVoice;
    utter.lang = NB_LOCALE;
    utter.rate = speeds[i++];
    utter.onend = next;
    speechSynthesis.speak(utter);
  }
  speechSynthesis.cancel();
  next();
}

// ===== Block renderers =====
const renderers = {
  lines(block, container){
    block.items.forEach(item=>{
      const div = document.createElement('div');
      const noLine = document.createElement('div');
      renderTokens(noLine,item.no);
      noLine.appendChild(makePlayBtn(item.no));
      const enLine = document.createElement('div');
      enLine.textContent = item.en;
      div.appendChild(noLine);
      div.appendChild(enLine);
      container.appendChild(div);
    });
  },
  mono(block, container){
    const pre = document.createElement('pre');
    pre.textContent = block.text;
    container.appendChild(pre);
  },
  verbs_table(block, container){
    const table = document.createElement('table');
    const head = document.createElement('tr');
    head.innerHTML = '<th>Infinitiv</th><th>Presens</th><th>Preteritum</th><th>Perfektum</th><th>Futurum</th>';
    table.appendChild(head);
    block.verbs.forEach(v=>{
      const tr = document.createElement('tr');
      function tdForm(no, en){
        const td = document.createElement('td');
        renderTokens(td,no);
        td.appendChild(makePlayBtn(no));
        const gloss = document.createElement('div');
        gloss.textContent = en;
        td.appendChild(gloss);
        return td;
      }
      tr.appendChild(tdForm(v.inf,v.inf_en));
      tr.appendChild(tdForm(v.pres,v.pres_en));
      tr.appendChild(tdForm(v.pret,v.pret_en));
      tr.appendChild(tdForm(v.perf,v.perf_en));
      tr.appendChild(tdForm(v.fut,v.fut_en));
      table.appendChild(tr);
    });
    container.appendChild(table);
  },
  image(block, container){
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = block.src || './assets/describe/default.png';
    img.alt = block.caption || 'illustrasjon';
    fig.appendChild(img);
    if (block.caption){
      const cap = document.createElement('figcaption');
      cap.textContent = block.caption;
      fig.appendChild(cap);
    }
    container.appendChild(fig);
  },
  markdown(block, container){
    const div = document.createElement('div');
    div.textContent = block.text; // simple fallback; markdown parse could be added
    container.appendChild(div);
  },
  html(block, container){
    const div = document.createElement('div');
    div.innerHTML = block.html;
    container.appendChild(div);
  }
};

// ===== Block dispatcher =====
window.renderBlocks = function(container, data){
  container.innerHTML = '';
  const h2 = document.createElement('h2');
  h2.textContent = data.title || '';
  container.appendChild(h2);
  (data.blocks || []).forEach(block=>{
    const sec = document.createElement('section');
    const r = renderers[block.kind];
    if (r) r(block, sec);
    else sec.textContent = 'Ukjent blokk: '+block.kind;
    container.appendChild(sec);
  });
};
