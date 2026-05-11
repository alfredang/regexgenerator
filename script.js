(() => {
  const $ = (id) => document.getElementById(id);
  const pattern = $('pattern');
  const flagsInput = $('flags');
  const testString = $('testString');
  const highlight = $('highlight');
  const errorBox = $('errorBox');
  const matchCount = $('matchCount');
  const matchesList = $('matchesList');
  const explanation = $('explanation');
  const replacement = $('replacement');
  const subResult = $('subResult');
  const regexWrap = document.querySelector('.regex-input-wrap');
  const flagToggles = document.querySelectorAll('.flag-toggles input[type="checkbox"]');

  // ----- Theme -----
  const themeBtn = $('themeBtn');
  const iconMoon = $('iconMoon');
  const iconSun = $('iconSun');
  const savedTheme = localStorage.getItem('regexlab-theme') || 'dark';
  applyTheme(savedTheme);
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('regexlab-theme', t);
    iconMoon.style.display = t === 'dark' ? '' : 'none';
    iconSun.style.display  = t === 'dark' ? 'none' : '';
  }

  // ----- Tabs -----
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ----- Flag checkboxes <-> flags input sync -----
  flagToggles.forEach(cb => {
    cb.addEventListener('change', () => {
      const flags = Array.from(flagToggles).filter(c => c.checked).map(c => c.dataset.flag).join('');
      flagsInput.value = flags;
      update();
    });
  });
  flagsInput.addEventListener('input', () => {
    const flags = flagsInput.value;
    flagToggles.forEach(cb => { cb.checked = flags.includes(cb.dataset.flag); });
    update();
  });

  // ----- Copy -----
  $('copyBtn').addEventListener('click', () => {
    const text = `/${pattern.value}/${flagsInput.value}`;
    navigator.clipboard.writeText(text).then(() => toast('Copied: ' + text));
  });

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // ----- Sync scroll of textarea & highlight -----
  testString.addEventListener('scroll', () => {
    highlight.scrollTop = testString.scrollTop;
    highlight.scrollLeft = testString.scrollLeft;
  });

  // ----- Main update -----
  pattern.addEventListener('input', update);
  testString.addEventListener('input', update);
  replacement.addEventListener('input', updateSubstitution);

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildRegex() {
    let flags = flagsInput.value;
    // dedupe
    flags = Array.from(new Set(flags.split(''))).join('');
    flagsInput.value = flags;
    return new RegExp(pattern.value, flags);
  }

  function update() {
    errorBox.hidden = true;
    regexWrap.classList.remove('error');

    if (!pattern.value) {
      highlight.innerHTML = escapeHtml(testString.value);
      matchCount.textContent = '0 matches';
      matchesList.innerHTML = '<div class="empty">Enter a pattern to see matches</div>';
      explanation.innerHTML = '<div class="empty">Enter a pattern to see explanation</div>';
      subResult.textContent = '';
      return;
    }

    let re;
    try {
      re = buildRegex();
    } catch (e) {
      errorBox.hidden = false;
      errorBox.textContent = e.message;
      regexWrap.classList.add('error');
      highlight.innerHTML = escapeHtml(testString.value);
      matchCount.textContent = '—';
      matchesList.innerHTML = '<div class="empty">Invalid regex</div>';
      explanation.innerHTML = '';
      return;
    }

    const text = testString.value;
    const matches = collectMatches(re, text);
    renderHighlight(text, matches);
    renderMatches(matches);
    renderExplanation(pattern.value);
    updateSubstitution();
    matchCount.textContent = matches.length + (matches.length === 1 ? ' match' : ' matches');
  }

  function collectMatches(re, text) {
    const out = [];
    const global = re.flags.includes('g') || re.flags.includes('y');
    if (!global) {
      const m = re.exec(text);
      if (m) out.push(makeMatchInfo(m));
      return out;
    }
    let m;
    let safety = 0;
    while ((m = re.exec(text)) !== null) {
      out.push(makeMatchInfo(m));
      if (m.index === re.lastIndex) re.lastIndex++;
      if (++safety > 100000) break;
    }
    return out;
  }

  function makeMatchInfo(m) {
    return {
      value: m[0],
      index: m.index,
      end: m.index + m[0].length,
      groups: m.slice(1),
      named: m.groups ? { ...m.groups } : null,
    };
  }

  function renderHighlight(text, matches) {
    if (!matches.length) {
      highlight.innerHTML = escapeHtml(text) + '\n';
      return;
    }
    let html = '';
    let cursor = 0;
    matches.forEach((m, i) => {
      if (m.index > cursor) html += escapeHtml(text.slice(cursor, m.index));
      const cls = 'm' + (i % 5);
      const inner = m.value.length === 0 ? '&#8203;' : escapeHtml(m.value);
      html += `<mark class="${cls}" title="Match ${i + 1}">${inner}</mark>`;
      cursor = m.end;
    });
    if (cursor < text.length) html += escapeHtml(text.slice(cursor));
    highlight.innerHTML = html + '\n';
  }

  function renderMatches(matches) {
    if (!matches.length) {
      matchesList.innerHTML = '<div class="empty">No matches found</div>';
      return;
    }
    matchesList.innerHTML = matches.map((m, i) => {
      let groupsHtml = '';
      if (m.groups.length || (m.named && Object.keys(m.named).length)) {
        const rows = [];
        m.groups.forEach((g, gi) => {
          rows.push(`<div class="group-row"><span class="gname">$${gi + 1}</span><span class="gval">${g === undefined ? '<em style="color:var(--text-dim)">undefined</em>' : escapeHtml(g)}</span></div>`);
        });
        if (m.named) {
          Object.entries(m.named).forEach(([k, v]) => {
            rows.push(`<div class="group-row"><span class="gname">${escapeHtml(k)}</span><span class="gval">${v === undefined ? '<em style="color:var(--text-dim)">undefined</em>' : escapeHtml(v)}</span></div>`);
          });
        }
        groupsHtml = `<div class="match-groups">${rows.join('')}</div>`;
      }
      return `
        <div class="match-item" style="border-left-color: var(--${matchColorVar(i)})">
          <div class="match-header">
            <span>Match ${i + 1}</span>
            <span>${m.index}–${m.end}</span>
          </div>
          <div class="match-value">${escapeHtml(m.value) || '<em style="color:var(--text-dim)">(empty)</em>'}</div>
          ${groupsHtml}
        </div>`;
    }).join('');
  }

  function matchColorVar(i) {
    return ['accent', 'accent-2', 'success', 'warn', 'danger'][i % 5];
  }

  function updateSubstitution() {
    if (!pattern.value) { subResult.textContent = ''; return; }
    let re;
    try { re = buildRegex(); } catch { subResult.textContent = ''; return; }
    try {
      subResult.textContent = testString.value.replace(re, replacement.value);
    } catch (e) {
      subResult.textContent = e.message;
    }
  }

  // ----- Tokenizer-based explanation -----
  const RULES = [
    [/^\\d/, 'matches any digit (0-9)'],
    [/^\\D/, 'matches any non-digit'],
    [/^\\w/, 'matches any word character'],
    [/^\\W/, 'matches any non-word character'],
    [/^\\s/, 'matches any whitespace'],
    [/^\\S/, 'matches any non-whitespace'],
    [/^\\b/, 'word boundary'],
    [/^\\B/, 'non-word boundary'],
    [/^\\n/, 'newline'],
    [/^\\t/, 'tab'],
    [/^\\r/, 'carriage return'],
    [/^\[\^[^\]]*\]/, 'negated character set'],
    [/^\[[^\]]*\]/, 'character set'],
    [/^\.\*\?/, 'lazy: any char, 0+'],
    [/^\.\*/, 'any char, 0+ (greedy)'],
    [/^\.\+\?/, 'lazy: any char, 1+'],
    [/^\.\+/, 'any char, 1+ (greedy)'],
    [/^\./, 'any character (except newline)'],
    [/^\^/, 'start of line/string'],
    [/^\$/, 'end of line/string'],
    [/^\(\?:[^)]*\)/, 'non-capturing group'],
    [/^\(\?<[^>]+>[^)]*\)/, 'named capturing group'],
    [/^\(\?=[^)]*\)/, 'positive lookahead'],
    [/^\(\?![^)]*\)/, 'negative lookahead'],
    [/^\(\?<=[^)]*\)/, 'positive lookbehind'],
    [/^\(\?<![^)]*\)/, 'negative lookbehind'],
    [/^\([^)]*\)/, 'capturing group'],
    [/^\\./, 'escaped character'],
    [/^\{\d+,\d+\}/, 'between n and m times'],
    [/^\{\d+,\}/, 'n or more times'],
    [/^\{\d+\}/, 'exactly n times'],
    [/^\*\?/, '0 or more (lazy)'],
    [/^\+\?/, '1 or more (lazy)'],
    [/^\?\?/, '0 or 1 (lazy)'],
    [/^\*/, '0 or more (greedy)'],
    [/^\+/, '1 or more (greedy)'],
    [/^\?/, '0 or 1 (optional)'],
    [/^\|/, 'alternation (OR)'],
  ];

  function renderExplanation(p) {
    if (!p) { explanation.innerHTML = ''; return; }
    const tokens = [];
    let i = 0;
    while (i < p.length) {
      const rest = p.slice(i);
      let matched = false;
      for (const [re, desc] of RULES) {
        const m = rest.match(re);
        if (m) {
          tokens.push({ tok: m[0], desc });
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // literal char (group consecutive literals)
        let lit = '';
        while (i < p.length) {
          const r = p.slice(i);
          if (RULES.some(([re]) => re.test(r))) break;
          lit += p[i];
          i++;
        }
        if (lit) tokens.push({ tok: lit, desc: `literal "${lit}"` });
        else { tokens.push({ tok: p[i], desc: 'literal' }); i++; }
      }
    }
    explanation.innerHTML = tokens.map(t =>
      `<div class="exp-token"><code>${escapeHtml(t.tok)}</code><span>${escapeHtml(t.desc)}</span></div>`
    ).join('');
  }

  // Init flag checkboxes from flags input
  (function syncInit() {
    const flags = flagsInput.value;
    flagToggles.forEach(cb => { cb.checked = flags.includes(cb.dataset.flag); });
  })();

  update();
})();
