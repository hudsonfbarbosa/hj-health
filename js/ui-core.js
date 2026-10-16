/* H&J Health — Camada de INTERFACE (núcleo)
 * Roteamento, perfil ativo, diálogos, formulários, gráficos e componentes comuns.
 */
(function (HJ) {
  'use strict';
  const L = HJ.L;
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls) => '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
  const NI = '<span class="absent">Não informado</span>';

  const NAV = [
    { r: 'hoje', t: 'Hoje', i: 'hoje', b: true },
    { r: 'nutricao', t: 'Nutrição', i: 'nutri', b: true },
    { r: 'treino', t: 'Treino', i: 'treino', b: true },
    { r: 'sono', t: 'Sono e hábitos', i: 'sono' },
    { r: 'evolucao', t: 'Evolução', i: 'evolucao', b: true },
    { r: 'semana', t: 'Semana', i: 'semana' },
    { r: 'saude', t: 'Saúde', i: 'saude' },
    { r: 'compras', t: 'Receitas e compras', i: 'compras' },
    { r: 'relatorios', t: 'Relatórios', i: 'relatorio' },
    { r: 'config', t: 'Configurações', i: 'config' }
  ];

  const UI = {
    esc, icon, NI, NAV,
    routes: {},
    state: { perfil: 'hudson', data: L.hoje(), rota: 'hoje', params: {} },
    route(nome, def) { this.routes[nome] = def; },
    nomePerfil(p) { const c = L.config(p || this.state.perfil); return c ? c.nome : HJ.IO.NOMES[p || this.state.perfil]; }
  };

  /* ---------- Rotas e navegação ---------- */
  function lerHash() {
    const h = (location.hash || '#hoje').slice(1);
    const [rota, q] = h.split('?');
    const params = {};
    if (q) q.split('&').forEach(par => { const [k, v] = par.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { rota: UI.routes[rota] ? rota : 'hoje', params };
  }

  function navHTML(lado) {
    if (lado) {
      return '<div class="brand"><span class="brand-mark" aria-hidden="true">H&amp;J</span><span class="brand-name">H&amp;J Health</span></div>' +
        NAV.map(n => '<a href="#' + n.r + '" data-r="' + n.r + '">' + icon(n.i) + '<span class="lbl">' + n.t + '</span></a>').join('') +
        '<div class="grow"></div><button class="navbtn" type="button" id="recolher" aria-expanded="true">' + icon('menu') + '<span class="lbl">Recolher menu</span></button>';
    }
    return NAV.filter(n => n.b).map(n => '<a href="#' + n.r + '" data-r="' + n.r + '" class="' + n.r + '">' + icon(n.i) + n.t + '</a>').join('') +
      '<a href="#mais" data-r="mais">' + icon('mais') + 'Mais</a>';
  }

  function marcarNav() {
    const r = UI.state.rota;
    const doMais = !NAV.find(n => n.r === r && n.b);
    document.querySelectorAll('#side a, #bottomNav a').forEach(a => {
      const ativo = a.dataset.r === r || (a.closest('#bottomNav') && a.dataset.r === 'mais' && doMais);
      if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function perfilSwitchHTML() {
    return HJ.schema.PERFIS.map(p => '<button type="button" data-perfil="' + p + '" aria-pressed="' + (p === UI.state.perfil) + '">' + esc(UI.nomePerfil(p)) + '</button>').join('');
  }

  UI.ir = function (rota, params) {
    const q = params ? '?' + Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
    if (location.hash === '#' + rota + q) UI.render(); else location.hash = rota + q;
  };

  UI.render = function (manterFoco) {
    const { rota, params } = lerHash();
    const mudouRota = rota !== UI.state.rota;
    UI.state.rota = rota; UI.state.params = params;
    const def = UI.routes[rota];
    const view = document.getElementById('view');
    document.getElementById('perfilSwitch').innerHTML = perfilSwitchHTML();
    view.className = 'view' + (def.largo ? ' wide' : '');
    const rolagem = window.scrollY;
    let foco = null;
    if (manterFoco && document.activeElement && view.contains(document.activeElement)) {
      const el = document.activeElement;
      foco = el.id ? '#' + el.id : (el.dataset.a ? '[data-a="' + el.dataset.a + '"]' + (el.dataset.id ? '[data-id="' + el.dataset.id + '"]' : '') + (el.dataset.v ? '[data-v="' + el.dataset.v + '"]' : '') : null);
    }
    try { view.innerHTML = def.render(params); }
    catch (e) { console.error(e); view.innerHTML = '<div class="callout red">' + icon('alerta') + '<div>Erro ao montar esta tela: ' + esc(e.message) + '</div></div>'; }
    if (def.depois) def.depois(view, params);
    document.title = (def.titulo || 'H&J Health') + ' · H&J Health';
    marcarNav();
    if (mudouRota) { window.scrollTo(0, 0); const h1 = view.querySelector('h1'); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
    else {
      window.scrollTo(0, rolagem);
      if (foco) { try { const el = view.querySelector(foco); if (el) el.focus({ preventScroll: true }); } catch (e) { /* seletor inválido */ } }
    }
  };

  // Executa uma ação que grava dados; mostra erro se falhar e redesenha.
  UI.agir = async function (fn) {
    try { await fn(); UI.render(true); }
    catch (e) { console.error(e); UI.toast('Não foi possível salvar: ' + (e.message || e), { erro: true }); UI.render(true); }
  };

  function ligarEventos() {
    const view = document.getElementById('view');
    const disparar = (tipo, ev) => {
      const def = UI.routes[UI.state.rota];
      const el = ev.target.closest('[data-a]');
      if (!el || !view.contains(el)) return;
      if (tipo === 'click' && ['INPUT', 'SELECT', 'TEXTAREA', 'FORM'].includes(el.tagName)) return;
      if (tipo === 'change' && !(el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const fn = def.acoes && def.acoes[el.dataset.a];
      if (!fn) return;
      if (el.tagName === 'A' || el.tagName === 'BUTTON') ev.preventDefault();
      fn(el.dataset, el, ev);
    };
    view.addEventListener('click', e => disparar('click', e));
    view.addEventListener('change', e => disparar('change', e));
    view.addEventListener('submit', e => {
      const f = e.target.closest('form[data-a]');
      if (!f) return;
      e.preventDefault();
      const def = UI.routes[UI.state.rota];
      const fn = def.acoes && def.acoes[f.dataset.a];
      if (fn) fn(f.dataset, f, e);
    });
    document.getElementById('perfilSwitch').addEventListener('click', e => {
      const b = e.target.closest('[data-perfil]');
      if (!b) return;
      UI.state.perfil = b.dataset.perfil;
      HJ.Prefs.set('perfilAtivo', UI.state.perfil);
      UI.render();
    });
    window.addEventListener('hashchange', () => UI.render());
  }

  /* ---------- Avisos ---------- */
  let salvoTimer = null;
  UI.mostrarSalvo = function () {
    const el = document.getElementById('saved');
    el.innerHTML = icon('check', 'sm') + 'Salvo';
    el.classList.add('on');
    clearTimeout(salvoTimer);
    salvoTimer = setTimeout(() => el.classList.remove('on'), 1400);
  };
  UI.toast = function (msg, op) {
    op = op || {};
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (op.erro ? ' err' : '');
    t.setAttribute('role', op.erro ? 'alert' : 'status');
    t.innerHTML = (op.erro ? icon('alerta') : icon('info')) + '<span>' + esc(msg) + '</span>' + (op.acao ? '<button class="btn sm" type="button">' + esc(op.acao.texto) + '</button>' : '');
    if (op.acao) t.querySelector('button').addEventListener('click', () => { t.remove(); op.acao.fn(); });
    box.appendChild(t);
    setTimeout(() => t.remove(), op.dur || (op.acao ? 6000 : op.erro ? 7000 : 3000));
  };

  /* ---------- Diálogos ---------- */
  const dlg = () => document.getElementById('dlg');
  let dlgFechar = null;
  function abrirDialogo(html, aoMontar) {
    const d = dlg();
    d.innerHTML = html;
    if (!d.open) d.showModal();
    const primeiro = d.querySelector('[autofocus], input, select, textarea, button.primary');
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
    if (aoMontar) aoMontar(d);
  }
  function fecharDialogo(v) { const d = dlg(); if (d.open) d.close(); if (dlgFechar) { const f = dlgFechar; dlgFechar = null; f(v); } }
  UI.fecharDialogo = fecharDialogo;
  function cabecalho(titulo) { return '<div class="dlg-head"><h2 id="dlgTitle">' + esc(titulo) + '</h2><button type="button" class="btn ghost icon" data-fechar aria-label="Fechar">' + icon('x') + '</button></div>'; }

  UI.confirmar = function ({ titulo, texto, ok, perigo, digitar }) {
    return new Promise(resolve => {
      dlgFechar = resolve;
      abrirDialogo(cabecalho(titulo) +
        '<form method="dialog" class="dlg-form"><div class="dlg-body"><p>' + texto + '</p>' +
        (digitar ? '<div class="field"><label for="cf-dig">Digite <strong>' + esc(digitar) + '</strong> para confirmar</label><input id="cf-dig" type="text" autocomplete="off" autocapitalize="characters"></div>' : '') +
        '</div><div class="dlg-foot"><button type="button" class="btn" data-fechar>Cancelar</button><button type="submit" class="btn ' + (perigo ? 'danger solid' : 'primary') + '"' + (digitar ? ' disabled' : '') + '>' + esc(ok || 'Confirmar') + '</button></div></form>',
        d => {
          d.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => fecharDialogo(false)));
          const inp = d.querySelector('#cf-dig'), btn = d.querySelector('button[type=submit]');
          if (inp) inp.addEventListener('input', () => { btn.disabled = inp.value.trim().toUpperCase() !== digitar.toUpperCase(); });
          d.querySelector('form').addEventListener('submit', e => { e.preventDefault(); if (!btn.disabled) fecharDialogo(true); });
        });
    });
  };

  // Mostra conteúdo livre (somente leitura) num diálogo.
  UI.info = function (titulo, html) {
    return new Promise(resolve => {
      dlgFechar = resolve;
      abrirDialogo(cabecalho(titulo) + '<div class="dlg-body">' + html + '</div><div class="dlg-foot"><button type="button" class="btn primary" data-fechar>Fechar</button></div>',
        d => d.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => fecharDialogo())));
    });
  };

  /* Formulário genérico.
   * campos: [{ k, label, tipo: text|number|date|time|select|textarea|checkbox|dias|nota, req, help, min, max, step, opcoes:[[v,l]], ph, span2, html }]
   * onSalvar(valores) -> pode lançar Error('mensagem') para manter aberto.
   */
  UI.form = function ({ titulo, campos, valores, salvar, onSalvar, onExcluir, duasColunas, extraHTML }) {
    valores = valores || {};
    return new Promise(resolve => {
      dlgFechar = resolve;
      const campo = (c, i) => {
        const id = 'f-' + i + '-' + c.k;
        const v = valores[c.k];
        const req = c.req ? ' required aria-required="true"' : '';
        const help = c.help ? '<span class="help" id="' + id + '-h">' + c.help + '</span>' : '';
        const desc = c.help ? ' aria-describedby="' + id + '-h"' : '';
        const cls = 'field' + (c.span2 ? ' span2' : '');
        if (c.tipo === 'nota') return '<div class="' + cls + ' span2">' + c.html + '</div>';
        if (c.tipo === 'checkbox') return '<div class="' + cls + '"><label class="checkline" for="' + id + '"><input type="checkbox" id="' + id + '" data-k="' + c.k + '"' + (v ? ' checked' : '') + desc + '>' + esc(c.label) + '</label>' + help + '</div>';
        if (c.tipo === 'dias') {
          const sel = Array.isArray(v) ? v : [];
          return '<fieldset class="' + cls + '" style="border:0;padding:0;margin:0"><legend class="lbl" style="font-size:.85rem;font-weight:600;color:var(--text-2);margin-bottom:6px">' + esc(c.label) + '</legend><div class="dias" data-k="' + c.k + '" data-tipo="dias">' +
            [1, 2, 3, 4, 5, 6, 0].map(d => '<label><input type="checkbox" value="' + d + '"' + (sel.includes(d) ? ' checked' : '') + '><span>' + L.DIAS_CURTO[d] + '</span></label>').join('') + '</div>' + help + '</fieldset>';
        }
        let inp;
        if (c.tipo === 'select') inp = '<select id="' + id + '" data-k="' + c.k + '"' + req + desc + '>' + (c.req ? '' : '<option value="">—</option>') + c.opcoes.map(([ov, ol]) => '<option value="' + esc(ov) + '"' + (String(v) === String(ov) ? ' selected' : '') + '>' + esc(ol) + '</option>').join('') + '</select>';
        else if (c.tipo === 'textarea') inp = '<textarea id="' + id + '" data-k="' + c.k + '"' + req + desc + (c.ph ? ' placeholder="' + esc(c.ph) + '"' : '') + '>' + esc(v || '') + '</textarea>';
        else {
          // Números: teclado numérico nativo que aceita vírgula decimal (padrão brasileiro).
          const t = c.tipo === 'number' ? 'text' : (c.tipo || 'text');
          const extra = c.tipo === 'number' ? ' inputmode="' + (c.inteiro ? 'numeric' : 'decimal') + '" enterkeyhint="next"' : '';
          inp = '<input type="' + t + '" id="' + id + '" data-k="' + c.k + '" data-tipo="' + (c.tipo || 'text') + '"' + extra + req + desc + ' value="' + esc(v === null || v === undefined ? '' : (c.tipo === 'number' && typeof v === 'number' ? String(v).replace('.', ',') : v)) + '"' + (c.ph ? ' placeholder="' + esc(c.ph) + '"' : '') + (c.lista ? ' list="' + id + '-l"' : '') + ' autocomplete="off">' +
            (c.lista ? '<datalist id="' + id + '-l">' + c.lista.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>' : '');
        }
        return '<div class="' + cls + '"><label for="' + id + '">' + esc(c.label) + (c.req ? ' *' : '') + '</label>' + inp + help + '<span class="err" id="' + id + '-e" aria-live="polite"></span></div>';
      };
      abrirDialogo(cabecalho(titulo) +
        '<form novalidate><div class="dlg-body"><div class="form-grid' + (duasColunas ? ' two' : '') + '">' + campos.map(campo).join('') + '</div>' + (extraHTML || '') + '<p class="err small" id="f-geral" role="alert"></p></div>' +
        '<div class="dlg-foot">' + (onExcluir ? '<button type="button" class="btn danger" data-excluir style="margin-right:auto">' + icon('lixo', 'sm') + 'Excluir</button>' : '') +
        '<button type="button" class="btn" data-fechar>Cancelar</button><button type="submit" class="btn primary">' + esc(salvar || 'Salvar') + '</button></div></form>',
        d => {
          d.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => fecharDialogo(null)));
          const ex = d.querySelector('[data-excluir]');
          if (ex) ex.addEventListener('click', async () => {
            d.close();
            const ok = await UI.confirmar({ titulo: 'Excluir?', texto: 'Esta ação não pode ser desfeita.', ok: 'Excluir', perigo: true });
            if (ok) { try { await onExcluir(); UI.render(true); } catch (e) { UI.toast(e.message, { erro: true }); } }
          });
          d.querySelector('form').addEventListener('submit', async e => {
            e.preventDefault();
            const out = {}; let ok = true;
            d.querySelectorAll('.err').forEach(x => { x.textContent = ''; });
            d.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
            campos.forEach((c, i) => {
              if (c.tipo === 'nota') return;
              const id = 'f-' + i + '-' + c.k;
              const erro = msg => { ok = false; const el = d.querySelector('#' + id); if (el) el.setAttribute('aria-invalid', 'true'); const er = d.querySelector('#' + id + '-e'); if (er) er.textContent = msg; };
              if (c.tipo === 'dias') { out[c.k] = [...d.querySelectorAll('[data-k="' + c.k + '"] input:checked')].map(x => Number(x.value)).sort(); return; }
              const el = d.querySelector('#' + id);
              if (c.tipo === 'checkbox') { out[c.k] = el.checked; return; }
              let v = el.value.trim();
              if (!v) { if (c.req) erro('Campo obrigatório'); out[c.k] = null; return; }
              if (c.tipo === 'number') {
                const n = L.parseNum(v);
                if (Number.isNaN(n)) return erro('Número inválido');
                if (c.min !== undefined && n < c.min) return erro('Mínimo ' + c.min);
                if (c.max !== undefined && n > c.max) return erro('Máximo ' + c.max);
                if (c.inteiro && !Number.isInteger(n)) return erro('Use um número inteiro');
                out[c.k] = n; return;
              }
              if (c.tipo === 'date' && !HJ.schema.validDate(v)) return erro('Data inválida');
              if (c.tipo === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return erro('Horário inválido');
              if (c.tipo === 'select' && c.numerico) v = Number(v);
              out[c.k] = v;
            });
            if (!ok) { const inv = d.querySelector('[aria-invalid]'); if (inv) inv.focus(); return; }
            try {
              const r = await onSalvar(out);
              fecharDialogo(r === undefined ? out : r);
              UI.render(true);
            } catch (err) { d.querySelector('#f-geral').textContent = err.message || String(err); }
          });
        });
    });
  };

  /* ---------- Componentes ---------- */
  UI.ring = function (pct, rotulo) {
    const r = 42, c = 2 * Math.PI * r;
    const p = pct === null || pct === undefined ? 0 : Math.max(0, Math.min(1, pct));
    const txt = pct === null || pct === undefined ? '—' : Math.round(p * 100) + '%';
    return '<div class="ring" role="img" aria-label="' + esc(rotulo || 'Progresso') + ': ' + txt + '"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="9"/>' +
      '<circle class="bar" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(2) + '"/></svg>' +
      '<div class="lbl" aria-hidden="true"><div>' + txt + '<small>do dia</small></div></div></div>';
  };
  UI.fonte = function (f) {
    if (f === 'estimativa') return '<span class="badge estimativa" title="Valor estimado, não é prescrição profissional">Estimativa</span>';
    if (f === 'profissional') return '<span class="badge profissional">Profissional</span>';
    return '';
  };
  UI.val = (v, sufixo, dec) => (v === null || v === undefined || v === '' ? NI : esc(typeof v === 'number' ? L.fmtNum(v, dec) : v) + (sufixo ? ' ' + sufixo : ''));
  UI.tabs = (itens, ativo, acao) => '<div class="tabs" role="group">' + itens.map(([v, l]) => '<button type="button" class="chip" data-a="' + acao + '" data-v="' + esc(v) + '" aria-pressed="' + (String(v) === String(ativo)) + '">' + esc(l) + '</button>').join('') + '</div>';
  UI.diasTexto = dias => (!dias || !dias.length ? 'Dia não informado' : dias.length === 7 ? 'Todos os dias' : dias.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => L.DIAS_CURTO[d]).join(', '));

  /* Gráfico de tendência em SVG.
   * pontos: [{x:'AAAA-MM-DD', y:number}], só valores registrados. tipo 'linha' | 'barras'. ini/fim definem o eixo.
   */
  UI.grafico = function ({ pontos, ini, fim, tipo, meta, unidade, dec, titulo }) {
    const W = 520, H = 230, ml = 46, mr = 14, mt = 14, mb = 30;
    if (!pontos.length) return '<p class="empty">Sem registros neste período.</p>';
    const tot = Math.max(1, L.diasEntre(ini, fim));
    const xs = k => ml + (L.diasEntre(ini, k) / tot) * (W - ml - mr);
    let ymin = Math.min(...pontos.map(p => p.y), meta !== undefined && meta !== null ? meta : Infinity);
    let ymax = Math.max(...pontos.map(p => p.y), meta !== undefined && meta !== null ? meta : -Infinity);
    if (tipo === 'barras') ymin = 0;
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const pad = (ymax - ymin) * 0.12; if (tipo !== 'barras') ymin -= pad; ymax += pad;
    const ys = v => mt + (1 - (v - ymin) / (ymax - ymin)) * (H - mt - mb);
    const ticks = [0, 1, 2, 3].map(i => ymin + (i / 3) * (ymax - ymin));
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titulo || 'Gráfico') + '">';
    ticks.forEach(t => { s += '<line class="grid" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + ys(t) + '" y2="' + ys(t) + '"/><text x="' + (ml - 6) + '" y="' + (ys(t) + 4) + '" text-anchor="end">' + L.fmtNum(t, dec === undefined ? 1 : dec) + '</text>'; });
    const nLbl = Math.min(6, tot + 1);
    for (let i = 0; i < nLbl; i++) { const k = L.addDias(ini, Math.round((i / Math.max(1, nLbl - 1)) * tot)); s += '<text x="' + xs(k) + '" y="' + (H - 8) + '" text-anchor="middle">' + L.fmtData(k, 'curto') + '</text>'; }
    if (meta !== undefined && meta !== null) s += '<line class="meta" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + ys(meta) + '" y2="' + ys(meta) + '"><title>Meta</title></line>';
    const ord = pontos.slice().sort((a, b) => (a.x < b.x ? -1 : 1));
    if (tipo === 'barras') {
      const bw = Math.max(3, Math.min(22, ((W - ml - mr) / (tot + 1)) * 0.7));
      ord.forEach(p => { s += '<rect class="barra" x="' + (xs(p.x) - bw / 2) + '" y="' + ys(p.y) + '" width="' + bw + '" height="' + Math.max(0, ys(0) - ys(p.y)) + '" rx="2"><title>' + L.fmtData(p.x) + ': ' + L.fmtNum(p.y, dec) + ' ' + (unidade || '') + '</title></rect>'; });
    } else {
      if (ord.length > 1) s += '<polyline class="line" points="' + ord.map(p => xs(p.x) + ',' + ys(p.y)).join(' ') + '"/>';
      ord.forEach(p => { s += '<circle class="dot" cx="' + xs(p.x) + '" cy="' + ys(p.y) + '" r="3.5"><title>' + L.fmtData(p.x) + ': ' + L.fmtNum(p.y, dec) + ' ' + (unidade || '') + '</title></circle>'; });
    }
    return s + '</svg>';
  };

  /* ---------- Rota "Mais" (celular) ---------- */
  UI.route('mais', {
    titulo: 'Mais',
    render() {
      return '<div class="page-head"><h1>Mais</h1></div><div class="card"><div class="list">' +
        NAV.filter(n => !n.b).map(n => '<a class="row" href="#' + n.r + '" style="color:inherit;text-decoration:none">' + icon(n.i) + '<span class="grow title">' + n.t + '</span>' + icon('dir', 'sm') + '</a>').join('') + '</div></div>';
    }
  });

  UI.init = function () {
    document.getElementById('side').innerHTML = navHTML(true);
    document.getElementById('bottomNav').innerHTML = navHTML(false);
    const rec = document.getElementById('recolher');
    const aplicarRecolhido = v => { document.getElementById('side').classList.toggle('collapsed', v); rec.setAttribute('aria-expanded', String(!v)); rec.querySelector('.lbl').textContent = v ? 'Expandir menu' : 'Recolher menu'; };
    aplicarRecolhido(HJ.Prefs.get('menuRecolhido', false));
    rec.addEventListener('click', () => { const v = !document.getElementById('side').classList.contains('collapsed'); HJ.Prefs.set('menuRecolhido', v); aplicarRecolhido(v); });
    dlg().addEventListener('cancel', () => { setTimeout(() => { if (dlgFechar) { const f = dlgFechar; dlgFechar = null; f(null); } }, 0); });
    HJ.Store.onSalvo(() => UI.mostrarSalvo());
    ligarEventos();
  };

  HJ.UI = UI;
})(window.HJ = window.HJ || {});
