(function(){
  var input = document.getElementById('faq-search');
  var expandBtn = document.getElementById('faq-expand-all');
  var collapseBtn = document.getElementById('faq-collapse-all');
  var countEl = document.getElementById('faq-count');
  var suggestEl = document.getElementById('faq-suggest');
  var qs = Array.prototype.slice.call(document.querySelectorAll('details.faq-q'));
  var savedOpen = qs.map(function(d){ return d.open; });
  qs.forEach(function(d){ d.dataset.text = (d.textContent || '').toLowerCase(); });

  // Build a flat index for the live-suggest dropdown: one entry per
  // details.faq-q, with id, summary (question line) and body text. We
  // cache summary HTML so we can highlight matches without re-parsing.
  var faqIndex = qs.map(function(d){
    var sum = d.querySelector('summary');
    var summaryText = '';
    if (sum) {
      // Strip the trailing '§' anchor link and surrounding whitespace.
      summaryText = (sum.textContent || '').replace(/\s*§\s*$/, '').trim();
    }
    var bodyText = (d.dataset.text || '').replace(summaryText.toLowerCase(), '').trim();
    return {
      id: d.id || '',
      summary: summaryText,
      summaryLc: summaryText.toLowerCase(),
      bodyLc: bodyText
    };
  });

  var suggestItems = [];      // DOM <li> nodes currently rendered
  var suggestActive = -1;     // keyboard-highlighted index

  function escHtml(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function highlightMatch(text, qLower){
    if (!qLower) return escHtml(text);
    var idx = text.toLowerCase().indexOf(qLower);
    if (idx < 0) return escHtml(text);
    return escHtml(text.slice(0, idx))
      + '<mark>' + escHtml(text.slice(idx, idx + qLower.length)) + '</mark>'
      + escHtml(text.slice(idx + qLower.length));
  }

  function scoreEntry(entry, qLower){
    // Tiered: summary substring (best), word-prefix on summary, body substring.
    var s = entry.summaryLc.indexOf(qLower);
    if (s === 0) return 100;                          // starts the question
    if (s > 0) return 80 - Math.min(s, 30);           // earlier = better
    // Token-prefix on summary words.
    var words = entry.summaryLc.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(qLower) === 0) return 60 - i;
    }
    if (entry.bodyLc.indexOf(qLower) >= 0) return 30;
    return 0;
  }

  function renderSuggestions(q){
    if (!suggestEl) return;
    var qLower = q.toLowerCase();
    if (!qLower) {
      suggestEl.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      suggestEl.innerHTML = '';
      suggestItems = [];
      suggestActive = -1;
      return;
    }
    var scored = faqIndex
      .map(function(en){ return { en: en, sc: scoreEntry(en, qLower) }; })
      .filter(function(r){ return r.sc > 0; })
      .sort(function(a, b){ return b.sc - a.sc; })
      .slice(0, 8);

    suggestEl.innerHTML = '';
    if (scored.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'faq-suggest-empty';
      empty.textContent = 'No matching FAQ. Log in at samagama.in and ask Yaksha.';
      suggestEl.appendChild(empty);
      suggestEl.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      suggestItems = [];
      suggestActive = -1;
      return;
    }
    scored.forEach(function(r, i){
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      var a = document.createElement('a');
      a.href = '#' + r.en.id;
      a.innerHTML = '<span class="faq-suggest-id">' + escHtml(r.en.id) + '</span>'
                  + highlightMatch(r.en.summary, qLower);
      a.addEventListener('click', function(ev){
        ev.preventDefault();
        jumpTo(r.en.id);
      });
      li.appendChild(a);
      suggestEl.appendChild(li);
    });
    suggestItems = Array.prototype.slice.call(suggestEl.querySelectorAll('li'));
    suggestActive = -1;
    suggestEl.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function jumpTo(id){
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') {
      el.open = true;
      var idx = qs.indexOf(el);
      if (idx >= 0) savedOpen[idx] = true;
    }
    // Push hash so the URL is shareable; scroll-margin-top in CSS keeps
    // the heading clear of the sticky toolbar.
    history.replaceState(null, '', '#' + id);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Close the dropdown but keep the typed query (so applyFilter results
    // and the count line stay visible inline).
    if (suggestEl) {
      suggestEl.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }
  }

  function moveActive(delta){
    if (!suggestItems.length) return;
    if (suggestActive >= 0) suggestItems[suggestActive].classList.remove('is-active');
    suggestActive = (suggestActive + delta + suggestItems.length) % suggestItems.length;
    suggestItems[suggestActive].classList.add('is-active');
    var a = suggestItems[suggestActive].querySelector('a');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }

  function applyFilter(){
    var q = (input.value || '').trim().toLowerCase();
    var hits = 0;
    qs.forEach(function(d, idx){
      if (!q) {
        d.hidden = false;
        d.removeAttribute('data-hit');
        d.open = savedOpen[idx];
        return;
      }
      var match = d.dataset.text.indexOf(q) !== -1;
      d.hidden = !match;
      if (match) {
        d.open = true;
        d.setAttribute('data-hit', '1');
        hits++;
      } else {
        d.removeAttribute('data-hit');
      }
    });
    if (!q) { countEl.textContent = ''; return; }
    countEl.textContent = hits === 0
      ? 'No matches. Log in at samagama.in and ask Yaksha.'
      : hits + ' match' + (hits === 1 ? '' : 'es') + ' for "' + q + '"';
  }

  function onInput(){
    var q = input.value || '';
    renderSuggestions(q.trim());
    applyFilter();
  }
  function onKeyDown(ev){
    if (suggestEl && suggestEl.hidden && (ev.key === 'ArrowDown' || ev.key === 'Down')) {
      // Re-open suggestions if user re-focuses an input that has a query.
      renderSuggestions((input.value || '').trim());
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'Down') { ev.preventDefault(); moveActive(1); return; }
    if (ev.key === 'ArrowUp' || ev.key === 'Up')     { ev.preventDefault(); moveActive(-1); return; }
    if (ev.key === 'Enter') {
      if (suggestActive >= 0 && suggestItems[suggestActive]) {
        ev.preventDefault();
        var a = suggestItems[suggestActive].querySelector('a');
        if (a) {
          var id = (a.getAttribute('href') || '').replace(/^#/, '');
          if (id) jumpTo(id);
        }
      } else if (suggestItems.length > 0) {
        // No active highlight — jump to the top suggestion.
        ev.preventDefault();
        var a0 = suggestItems[0].querySelector('a');
        if (a0) {
          var id0 = (a0.getAttribute('href') || '').replace(/^#/, '');
          if (id0) jumpTo(id0);
        }
      }
      return;
    }
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      if (suggestEl && !suggestEl.hidden) {
        suggestEl.hidden = true;
        input.setAttribute('aria-expanded', 'false');
      } else if (input.value) {
        input.value = '';
        applyFilter();
      }
      return;
    }
  }

  if (input) {
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('focus', function(){
      var q = (input.value || '').trim();
      if (q) renderSuggestions(q);
    });
    // Close dropdown when focus moves outside the search wrapper.
    document.addEventListener('click', function(ev){
      var wrap = input.closest('.faq-search-wrap');
      if (wrap && !wrap.contains(ev.target)) {
        if (suggestEl && !suggestEl.hidden) {
          suggestEl.hidden = true;
          input.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  if (expandBtn) expandBtn.addEventListener('click', function(){
    qs.forEach(function(d, idx){ if (!d.hidden) d.open = true; });
    savedOpen = qs.map(function(d){ return d.open; });
  });
  if (collapseBtn) collapseBtn.addEventListener('click', function(){
    qs.forEach(function(d){ if (!d.hidden) d.open = false; });
    savedOpen = qs.map(function(d){ return d.open; });
  });

  function openHashTarget(){
    if (!location.hash) return;
    var el = document.querySelector(location.hash);
    if (el && el.tagName === 'DETAILS') {
      el.open = true;
      var idx = qs.indexOf(el);
      if (idx >= 0) savedOpen[idx] = true;
    }
  }
  openHashTarget();
  window.addEventListener('hashchange', openHashTarget);

  // ── Yaksha-mini floating chatbot ────────────────────────────────────
  var ymLauncher = document.getElementById('ym-launcher');
  var ymPanel = document.getElementById('ym-panel');
  var ymClose = document.getElementById('ym-close');
  var ymForm = document.getElementById('ym-form');
  var ymInput = document.getElementById('ym-input');
  var ymLog = document.getElementById('ym-log');
  var ymHistory = [];
  var ymBusy = false;

  function ymOpen(){
    if (!ymPanel) return;
    ymPanel.hidden = false;
    if (ymLauncher) ymLauncher.hidden = true;
    setTimeout(function(){ if (ymInput) ymInput.focus(); }, 30);
  }
  function ymCloseFn(){
    if (!ymPanel) return;
    ymPanel.hidden = true;
    if (ymLauncher) ymLauncher.hidden = false;
  }
  if (ymLauncher) ymLauncher.addEventListener('click', ymOpen);
  if (ymClose) ymClose.addEventListener('click', ymCloseFn);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && ymPanel && !ymPanel.hidden) ymCloseFn();
  });
  // On the FAQ page, open the Yaksha-mini panel by default so visitors
  // don't miss the chatbot affordance. Overview page stays icon-by-default.
  // Clicking the X collapses to the icon as usual (existing behaviour).
  try {
    if (typeof window !== 'undefined' && window.location && /\/internship\/faq/.test(window.location.pathname)) {
      ymOpen();
    }
  } catch { /* defensive */ }

  // Small markdown renderer for assistant bubbles. Escapes HTML first, then
  // applies a conservative subset (bold, italic, inline code, links, newlines).
  // Keeps parity with the server-side renderInline used for the static FAQ.
  function ymEsc(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function ymMd(s){
    s = ymEsc(s);
    s = s.replace(/`([^`]+)`/g, function(_, c){ return '<code>' + c + '</code>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, function(_, t){ return '<strong>' + t + '</strong>'; });
    s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, function(_, t){ return '<em>' + t + '</em>'; });
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, href){
      var safe = /^(https?:|mailto:|\/)/i.test(href) ? href : '#';
      return '<a href="' + safe + '" target="_blank" rel="noopener">' + text + '</a>';
    });
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function ymAppend(role, text, cls){
    var row = document.createElement('div');
    row.className = 'ym-msg ' + (cls || role);
    var bubble = document.createElement('div');
    bubble.className = 'ym-bubble';
    if (cls === 'thinking') {
      var dots = document.createElement('span');
      dots.className = 'ym-dots';
      dots.innerHTML = '<span></span><span></span><span></span>';
      bubble.appendChild(dots);
    } else if (role === 'user') {
      bubble.textContent = text;
    } else {
      // assistant + error: render limited markdown so **bold**, *italic*,
      // backtick-code, and [link](url) display correctly.
      bubble.innerHTML = ymMd(text);
    }
    row.appendChild(bubble);
    ymLog.appendChild(row);
    ymLog.scrollTop = ymLog.scrollHeight;
    return row;
  }

  var ymSendBtn = document.getElementById('ym-send-btn');
  if (ymForm) ymForm.addEventListener('submit', function(ev){
    ev.preventDefault();
    if (ymBusy) return;
    var q = (ymInput.value || '').trim();
    if (!q) return;
    ymAppend('user', q);
    ymInput.value = '';
    ymBusy = true;
    ymInput.disabled = true;
    if (ymSendBtn) ymSendBtn.disabled = true;
    var thinking = ymAppend('assistant', '', 'thinking');

    fetch('/internship/faq/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history: ymHistory.slice(-6) }),
    })
      .then(function(r){ return r.json().then(function(j){ return { status: r.status, body: j }; }); })
      .then(function(out){
        thinking.parentNode.removeChild(thinking);
        var ans = (out.body && out.body.answer) || 'No reply received.';
        var cls = out.body && out.body.ok ? 'assistant' : 'error';
        ymAppend('assistant', ans, cls);
        if (out.body && out.body.ok) {
          ymHistory.push({ role: 'user', content: q });
          ymHistory.push({ role: 'assistant', content: ans });
        }
      })
      .catch(function(){
        thinking.parentNode.removeChild(thinking);
        ymAppend('assistant', 'Yaksha-mini is unreachable right now. Please try again, or log in at samagama.in and ask Yaksha there.', 'error');
      })
      .then(function(){ ymBusy = false; ymInput.disabled = false; if (ymSendBtn) ymSendBtn.disabled = false; ymInput.focus(); });
  });
})();
