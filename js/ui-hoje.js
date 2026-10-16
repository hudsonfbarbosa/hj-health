/* H&J Health — tela HOJE (registro diário em 1 toque) */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  const abertos = new Set();
  let substituindo = null;

  function saudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

  async function diario(p, d, fn) {
    const reg = L.registroDiario(p, d) || { tipo: 'registroDiario', perfil: p, data: d, planoId: null, refeicoes: {}, treinoStatus: null, recuperacao: null, observacao: null };
    reg.refeicoes = reg.refeicoes || {};
    fn(reg);
    await S.put(reg);
  }

  function onboarding(p) {
    const padrao = HJ.Prefs.get('perfilPadrao', null);
    return '<div class="card"><div class="card-head"><h2>Primeiros passos neste aparelho</h2></div>' +
      '<ol class="list" style="padding-left:18px;margin:0;gap:14px">' +
      '<li><p class="title" style="font-weight:600">Este aparelho é de quem?</p><p class="muted small">Define o perfil que abre por padrão. Os dois perfis continuam disponíveis.</p>' +
      '<div class="seg" style="margin-top:8px">' + HJ.schema.PERFIS.map(x => '<button type="button" data-a="padrao" data-v="' + x + '" aria-pressed="' + (padrao === x) + '">' + HJ.IO.NOMES[x] + '</button>').join('') + '</div></li>' +
      '<li><p class="title" style="font-weight:600">Importe o arquivo de dados de ' + esc(HJ.IO.NOMES[p]) + '</p><p class="muted small">Arquivo <code>hj-seed-' + p + '.json</code> (ou um backup). Ele traz o plano, metas e suplementos.</p>' +
      '<label class="btn primary" style="margin-top:8px">' + icon('subir', 'sm') + 'Escolher arquivo<input type="file" accept=".json,application/json" data-a="importar" class="sr-only"></label></li>' +
      '<li><p class="title" style="font-weight:600">Proteja os dados</p><p class="muted small">Peça ao navegador para não apagar os dados deste app. No iPhone, use o app pela tela inicial.</p>' +
      '<button class="btn" type="button" data-a="persistir" style="margin-top:8px">Pedir armazenamento persistente</button></li>' +
      '<li><p class="title" style="font-weight:600">Lembretes no calendário</p><p class="muted small">Gere o arquivo de calendário em Configurações e importe no app Calendário.</p>' +
      '<a class="btn" href="#config?sec=calendario" style="margin-top:8px">' + icon('cal', 'sm') + 'Configurar lembretes</a></li></ol>' +
      '<p class="muted small" style="margin-top:14px">' + icon('info', 'sm') + ' Seus dados ficam só neste aparelho. Nada é enviado para a internet.</p></div>';
  }

  function avisos(p, d) {
    const out = [];
    const ub = S.getMeta('ultimoBackup');
    const temDados = S.list(p).length > 0;
    if (temDados && (!ub || L.diasEntre(ub.slice(0, 10), L.hoje()) >= 14)) {
      out.push('<div class="callout amber no-print">' + icon('alerta') + '<div class="grow">' + (ub ? 'Último backup há ' + L.diasEntre(ub.slice(0, 10), L.hoje()) + ' dias (' + L.fmtData(ub.slice(0, 10)) + ').' : 'Você ainda não fez nenhum backup.') +
        ' Os dados ficam só neste aparelho.</div><button class="btn sm" type="button" data-a="backup">Fazer backup</button></div>');
    }
    const ds = L.diaSemana(L.hoje());
    if (d === L.hoje() && (ds === 0 || ds === 1)) {
      const ini = ds === 0 ? L.inicioSemana(d) : L.inicioSemana(L.addDias(d, -1));
      const feito = S.find(p, 'fechamentoSemanal', f => f.semanaInicio === ini);
      if (!feito) out.push('<a class="callout info" href="#semana?ini=' + ini + '" style="color:inherit;text-decoration:none">' + icon('semana') + '<div class="grow"><strong>Fechamento da semana</strong><br><span class="muted small">2 minutos: adesão, um destaque, um ponto de atenção e uma intenção.</span></div>' + icon('dir', 'sm') + '</a>');
    }
    return out.join('');
  }

  function cardRefeicoes(p, d, plano, reg) {
    if (!plano) return '<div class="card"><div class="card-head"><h2>Refeições</h2></div><p class="empty">Nenhum plano alimentar para este dia. Importe os dados ou crie um plano em Nutrição.</p></div>';
    const feitas = plano.refeicoes.filter(r => reg && reg.refeicoes[r.id]).length;
    let h = '<div class="card"><div class="card-head"><h2>Refeições</h2><span class="meta num">' + feitas + ' de ' + plano.refeicoes.length + '</span></div><div class="list">';
    plano.refeicoes.forEach(r => {
      const st = reg && reg.refeicoes[r.id];
      const aberto = abertos.has(r.id);
      const status = st ? (st.status === 'substituido' ? 'Substituído' + (st.substituto ? ': ' + esc(st.substituto) : '') : 'Feito' + (st.hora ? ' às ' + st.hora : '')) : (r.funcao ? esc(r.funcao) : '');
      h += '<div class="row meal' + (st ? ' done' : '') + '">' +
        '<button type="button" class="check' + (st && st.status === 'substituido' ? ' sub' : '') + '" data-a="ref" data-id="' + r.id + '" aria-pressed="' + !!st + '" aria-label="' + esc(r.nome) + (st ? ': marcada, tocar para desfazer' : ': marcar como feita') + '">' + icon('check') + '</button>' +
        '<span class="time">' + esc(r.horario || '') + '</span>' +
        '<div class="grow"><div class="title">' + esc(r.nome) + '</div><div class="desc">' + status + '</div></div>' +
        '<button type="button" class="btn ghost icon" data-a="expandir" data-id="' + r.id + '" aria-expanded="' + aberto + '" aria-label="Detalhar ' + esc(r.nome) + '">' + icon(aberto ? 'baixo' : 'dir', 'sm') + '</button></div>';
      if (aberto) {
        h += '<div class="meal-detail"><ul>' + r.itens.map(i => '<li>' + esc(i.nome) + ' — ' + qtdItem(i) + '</li>').join('') + '</ul>';
        if (substituindo === r.id) {
          h += '<form data-a="salvarSub" data-id="' + r.id + '" class="field"><label for="sub-' + r.id + '">O que você comeu no lugar?</label>' +
            (r.substituicoes.length ? '<div class="btns">' + r.substituicoes.map(s => '<button type="button" class="chip" data-a="subPronta" data-id="' + r.id + '" data-v="' + esc(s.descricao) + '">' + esc(s.descricao) + '</button>').join('') + '</div>' : '') +
            '<input id="sub-' + r.id + '" type="text" placeholder="Ex.: marmita de restaurante por quilo" value="' + esc(st && st.substituto || '') + '"><div class="btns"><button class="btn sm primary" type="submit">Salvar substituição</button><button class="btn sm" type="button" data-a="cancelarSub">Cancelar</button></div>' +
            '<span class="help">Substituições fora do plano são registradas como estão. Para mudar o plano, use Nutrição.</span></form>';
        } else {
          h += '<form data-a="salvarDet" data-id="' + r.id + '" class="form-grid two">' +
            '<div class="field"><label for="fo-' + r.id + '">Fome antes (1–5)</label><select id="fo-' + r.id + '" name="fome"><option value="">—</option>' + [1, 2, 3, 4, 5].map(n => '<option' + (st && st.fome === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
            '<div class="field"><label for="sa-' + r.id + '">Saciedade depois (1–5)</label><select id="sa-' + r.id + '" name="saciedade"><option value="">—</option>' + [1, 2, 3, 4, 5].map(n => '<option' + (st && st.saciedade === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
            '<div class="field span2"><label for="ob-' + r.id + '">Observação</label><input id="ob-' + r.id + '" name="obs" type="text" value="' + esc(st && st.observacao || '') + '"></div>' +
            '<div class="btns span2"><button class="btn sm primary" type="submit">Salvar detalhes</button><button class="btn sm" type="button" data-a="substituir" data-id="' + r.id + '">Substituí esta refeição</button></div></form>';
        }
        h += '</div>';
      }
    });
    return h + '</div></div>';
  }

  function qtdItem(i) {
    const partes = [];
    if (i.quantidade !== null) partes.push(L.fmtNum(i.quantidade) + (i.unidade ? ' ' + i.unidade : ''));
    if (i.medidaCaseira) partes.push(i.medidaCaseira);
    return partes.length ? esc(partes.join(' · ')) : '<span class="muted">quantidade não informada</span>';
  }

  function cardAgua(p, d) {
    const total = L.aguaTotal(p, d);
    const m = L.metaDoDia(p, 'agua', d);
    const pct = m ? Math.min(100, Math.round((total / m.valor) * 100)) : null;
    const regs = L.aguaRegistros(p, d);
    return '<div class="card"><div class="card-head"><h2>' + icon('agua', 'sm') + ' Água</h2>' + (m ? '<span class="meta">Meta ' + L.fmtNum(m.valor / 1000) + ' L ' + UI.fonte(m.fonte) + '</span>' : '<span class="meta">Sem meta definida</span>') + '</div>' +
      '<div class="water-top"><span class="big">' + L.fmtNum(total, 0) + ' ml</span>' + (m ? '<span class="muted num">' + pct + '%</span>' : '') + '</div>' +
      (m ? '<div class="bar-h" role="progressbar" aria-label="Água do dia" aria-valuemin="0" aria-valuemax="' + m.valor + '" aria-valuenow="' + total + '"><i style="width:' + pct + '%"></i></div>' : '<div style="height:12px"></div>') +
      '<div class="water-btns">' + [150, 250, 350, 500].map(v => '<button type="button" class="btn" data-a="agua" data-v="' + v + '">+' + v + '</button>').join('') + '</div>' +
      '<form data-a="aguaLivre" class="btns" style="margin-top:10px;flex-wrap:nowrap"><label for="agua-livre" class="sr-only">Outro valor em ml</label><input id="agua-livre" type="number" inputmode="numeric" min="1" max="3000" step="1" placeholder="Outro valor (ml)"><button class="btn" type="submit">Adicionar</button>' +
      '<button type="button" class="btn icon" data-a="aguaDesfazer" aria-label="Desfazer último registro de água"' + (regs.length ? '' : ' disabled') + '>' + icon('undo') + '</button></form></div>';
  }

  function cardSuplementos(p, d) {
    const sups = L.suplementosDoDia(p, d);
    const meds = L.medicamentosDoDia(p, d);
    if (!sups.length && !meds.length) return '';
    let h = '<div class="card"><div class="card-head"><h2>' + icon('pilula', 'sm') + ' Suplementos' + (meds.length ? ' e medicamentos' : '') + '</h2></div><div class="list">';
    sups.forEach(({ sup, reg }) => {
      const st = reg ? reg.status : null;
      h += '<div class="row"><div class="grow"><div class="title">' + esc(sup.nome) + (sup.dose !== null ? ' <span class="muted">' + L.fmtNum(sup.dose) + ' ' + esc(sup.unidade || '') + '</span>' : '') + '</div><div class="desc">' + (sup.horario ? sup.horario : 'Sem horário') + (sup.frequencia === 'semanal' ? ' · semanal' : '') + '</div></div>' +
        '<div class="seg" role="group" aria-label="' + esc(sup.nome) + '"><button type="button" class="ok" data-a="sup" data-id="' + sup.id + '" data-v="tomado" aria-pressed="' + (st === 'tomado') + '">' + icon('check', 'sm') + 'Tomado</button><button type="button" data-a="sup" data-id="' + sup.id + '" data-v="pulado" aria-pressed="' + (st === 'pulado') + '">Pulado</button></div></div>';
    });
    meds.forEach(({ med, reg, semDia, devido }) => {
      const st = reg ? reg.status : null;
      h += '<div class="row"><div class="grow"><div class="title">' + esc(med.nome) + '</div><div class="desc">' + (semDia ? 'Dia da aplicação não informado · <a href="#saude">definir</a>' : devido ? 'Previsto para hoje' : 'Registrado hoje') + '</div></div>' +
        '<div class="seg" role="group" aria-label="' + esc(med.nome) + '"><button type="button" class="ok" data-a="med" data-id="' + med.id + '" data-v="aplicado" aria-pressed="' + (st === 'aplicado') + '">' + icon('check', 'sm') + 'Aplicado</button>' + (devido ? '<button type="button" data-a="med" data-id="' + med.id + '" data-v="nao_aplicado" aria-pressed="' + (st === 'nao_aplicado') + '">Não aplicado</button>' : '') + '</div></div>';
    });
    return h + '</div><p class="muted tiny" style="margin-top:8px">Registro, não prescrição.</p></div>';
  }

  function cardTreino(p, d, reg) {
    const tp = L.treinoPlanejado(p, d);
    const st = reg ? reg.treinoStatus : null;
    const ses = L.sessoesDoDia(p, d);
    const rec = (reg && reg.recuperacao) || {};
    const sel = (k, lbl) => '<div class="field"><label for="rc-' + k + '">' + lbl + '</label><select id="rc-' + k + '" data-a="recup" data-k="' + k + '"><option value="">—</option>' + [1, 2, 3, 4, 5].map(n => '<option' + (rec[k] === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>';
    return '<div class="card"><div class="card-head"><h2>' + icon('treino', 'sm') + ' Treino</h2><span class="meta">' + (tp ? esc(tp.nome) : 'Sem treino planejado') + '</span></div>' +
      '<div class="seg full" role="group" aria-label="Treino de hoje">' +
      [['feito', 'Feito'], ['nao_feito', 'Não feito'], ['descanso', 'Descanso']].map(([v, l]) => '<button type="button"' + (v === 'feito' ? ' class="ok"' : '') + ' data-a="treino" data-v="' + v + '" aria-pressed="' + (st === v) + '">' + (v === 'feito' ? icon('check', 'sm') : '') + l + '</button>').join('') + '</div>' +
      (ses.length ? '<p class="muted small" style="margin-top:10px">' + ses.length + ' sessão(ões) detalhada(s) hoje.</p>' : '') +
      '<div class="btns" style="margin-top:10px"><a class="btn sm" href="#treino?nova=' + d + '">' + icon('plus', 'sm') + 'Detalhar treino</a></div>' +
      '<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer;min-height:32px">Recuperação (opcional)</summary><div class="form-grid" style="grid-template-columns:repeat(3,1fr);margin-top:8px">' +
      sel('fadiga', 'Fadiga') + sel('dor', 'Dor muscular') + sel('disposicao', 'Disposição') + '</div><p class="muted tiny" style="margin-top:6px">1 = baixa, 5 = alta. Só registro; não é diagnóstico.</p></details></div>';
  }

  function cardSono(p, d) {
    const s = L.sonoDoDia(p, d);
    if (s) {
      const min = L.duracaoSono(s.deitar, s.acordar);
      return '<div class="card"><div class="row" style="padding:0;min-height:0">' + icon('sono') + '<div class="grow"><div class="title">Sono: ' + L.fmtDuracao(min) + '</div><div class="desc">' + s.deitar + ' → ' + s.acordar + (s.qualidade ? ' · qualidade ' + s.qualidade + '/5' : '') + '</div></div><a class="btn sm" href="#sono?editar=' + s.id + '">Editar</a></div></div>';
    }
    const c = L.config(p) || {};
    const ultimo = S.list(p, 'registroSono').sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    const deitar = (ultimo && ultimo.deitar) || c.horarioDormir || '';
    const acordar = (ultimo && ultimo.acordar) || c.horarioAcordar || '';
    return '<div class="card"><div class="card-head"><h2>' + icon('sono', 'sm') + ' Como dormiu esta noite?</h2></div>' +
      '<form data-a="sono" class="form-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label for="so-d">Deitou</label><input id="so-d" type="time" value="' + esc(deitar) + '" required></div>' +
      '<div class="field"><label for="so-a">Acordou</label><input id="so-a" type="time" value="' + esc(acordar) + '" required></div>' +
      '<div class="field span2" style="grid-column:span 2"><span class="lbl" style="font-size:.85rem;font-weight:600;color:var(--text-2)">Qualidade (opcional)</span><div class="seg" role="radiogroup" aria-label="Qualidade do sono">' +
      [1, 2, 3, 4, 5].map(n => '<button type="button" data-a="sonoQ" data-v="' + n + '" aria-pressed="' + (qualidadeTmp === n) + '">' + n + '</button>').join('') + '</div></div>' +
      '<div style="grid-column:span 2"><button class="btn primary block" type="submit">Salvar sono</button></div></form></div>';
  }
  let qualidadeTmp = null;

  function cardHabitos(p, d) {
    const hs = S.list(p, 'habito', h => L.habitoDevido(h, d))
    hs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!hs.length) return '';
    return '<div class="card"><div class="card-head"><h2>Hábitos</h2><a class="meta" href="#sono">Gerenciar</a></div><div class="list">' + hs.map(h => {
      const f = L.habitoFeito(p, h, d);
      const seq = L.sequenciaHabito(p, h, d);
      return '<div class="row"><button type="button" class="check" data-a="habito" data-id="' + h.id + '" aria-pressed="' + f + '" aria-label="' + esc(h.nome) + (f ? ': feito, tocar para desfazer' : ': marcar como feito') + '">' + icon('check') + '</button><div class="grow"><div class="title">' + esc(h.nome) + '</div><div class="desc">Meta ' + h.metaSemanal + 'x/semana' + (seq ? ' · ' + seq + (seq === 1 ? ' semana' : ' semanas') + ' seguidas' : '') + '</div></div></div>';
    }).join('') + '</div></div>';
  }

  UI.route('hoje', {
    titulo: 'Hoje',
    render() {
      const p = UI.state.perfil, d = UI.state.data, ehHoje = d === L.hoje();
      const plano = L.planoDoDia(p, d);
      const reg = L.registroDiario(p, d);
      const semDados = !L.config(p) && !L.planos(p).length;
      const prog = L.progressoDia(p, d);
      const planos = L.planos(p).filter(x => x.ativo);
      let h = '<div class="page-head"><div><h1>' + (ehHoje ? saudacao() + ', ' + esc(UI.nomePerfil()) : 'Registro de ' + esc(UI.nomePerfil())) + '</h1><div class="sub">' + esc(L.fmtData(d, 'longo')) + '</div></div>' +
        '<div class="daynav no-print"><button class="btn icon" type="button" data-a="dia" data-v="-1" aria-label="Dia anterior">' + icon('esq') + '</button>' +
        (ehHoje ? '' : '<button class="btn sm" type="button" data-a="diaHoje">Hoje</button>') +
        '<button class="btn icon" type="button" data-a="dia" data-v="1" aria-label="Próximo dia"' + (ehHoje ? ' disabled' : '') + '>' + icon('dir') + '</button></div></div>';
      if (semDados) return h + onboarding(p) + cardAgua(p, d);
      h += avisos(p, d);
      h += '<div class="card"><div class="hero">' + UI.ring(prog ? prog.pct : null, 'Progresso do dia') + '<div class="grow">' +
        (prog ? '<div class="title" style="font-weight:650">' + prog.itens.filter(i => i.feito >= 1).length + ' de ' + prog.total + ' itens</div><div class="desc muted small">Conta só o que se aplica hoje' + (prog.itens.some(i => i.feito > 0 && i.feito < 1) ? '; água conta parcialmente no anel' : '') + '.</div>' : '<div class="muted">Nada planejado para hoje.</div>') +
        (planos.length > 1 ? '<div class="field" style="margin-top:8px"><label for="plano-dia">Plano do dia</label><select id="plano-dia" data-a="plano">' + planos.map(x => '<option value="' + x.id + '"' + (plano && plano.id === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></div>' : '') +
        '</div></div></div>';
      h += cardRefeicoes(p, d, plano, reg) + cardAgua(p, d) + cardSuplementos(p, d) + cardTreino(p, d, reg) + cardSono(p, d) + cardHabitos(p, d);
      return h;
    },
    acoes: {
      dia(ds) { UI.state.data = L.addDias(UI.state.data, Number(ds.v)); if (UI.state.data > L.hoje()) UI.state.data = L.hoje(); abertos.clear(); UI.render(true); },
      diaHoje() { UI.state.data = L.hoje(); UI.render(); },
      padrao(ds) { HJ.Prefs.set('perfilPadrao', ds.v); UI.state.perfil = ds.v; HJ.Prefs.set('perfilAtivo', ds.v); UI.render(); },
      importar(ds, el) { if (el.files[0]) UI.importarArquivo(el.files[0]); el.value = ''; },
      persistir() { UI.pedirPersistencia(); },
      backup() { UI.exportarBackupFluxo(); },
      plano(ds, el) { UI.agir(() => diario(UI.state.perfil, UI.state.data, r => { r.planoId = el.value; })); },
      ref(ds) {
        UI.agir(() => diario(UI.state.perfil, UI.state.data, r => {
          if (r.refeicoes[ds.id]) delete r.refeicoes[ds.id];
          else r.refeicoes[ds.id] = { status: 'feito', hora: UI.state.data === L.hoje() ? L.horaAgora() : null, substituto: null, observacao: null, fome: null, saciedade: null };
        }));
      },
      expandir(ds) { if (abertos.has(ds.id)) abertos.delete(ds.id); else abertos.add(ds.id); substituindo = null; UI.render(true); },
      substituir(ds) { substituindo = ds.id; UI.render(true); const i = document.getElementById('sub-' + ds.id); if (i) i.focus(); },
      cancelarSub() { substituindo = null; UI.render(true); },
      subPronta(ds) { const i = document.getElementById('sub-' + ds.id); if (i) { i.value = ds.v; i.focus(); } },
      salvarSub(ds, f) {
        const v = f.querySelector('input').value.trim();
        if (!v) { UI.toast('Descreva o que você comeu no lugar.', { erro: true }); return; }
        substituindo = null;
        UI.agir(() => diario(UI.state.perfil, UI.state.data, r => {
          const a = r.refeicoes[ds.id] || {};
          r.refeicoes[ds.id] = { status: 'substituido', hora: a.hora || (UI.state.data === L.hoje() ? L.horaAgora() : null), substituto: v.slice(0, 300), observacao: a.observacao || null, fome: a.fome || null, saciedade: a.saciedade || null };
        }));
      },
      salvarDet(ds, f) {
        const fome = f.fome.value ? Number(f.fome.value) : null, sac = f.saciedade.value ? Number(f.saciedade.value) : null, obs = f.obs.value.trim() || null;
        UI.agir(() => diario(UI.state.perfil, UI.state.data, r => {
          const a = r.refeicoes[ds.id] || { status: 'feito', hora: UI.state.data === L.hoje() ? L.horaAgora() : null, substituto: null };
          r.refeicoes[ds.id] = Object.assign({}, a, { fome, saciedade: sac, observacao: obs });
        }));
      },
      agua(ds) { UI.agir(() => S.put({ tipo: 'registroAgua', perfil: UI.state.perfil, data: UI.state.data, hora: L.horaAgora(), ml: Number(ds.v) })); },
      aguaLivre(ds, f) {
        const inp = f.querySelector('input'); const v = L.parseNum(inp.value);
        if (!v || Number.isNaN(v) || v <= 0 || v > 3000) { inp.setAttribute('aria-invalid', 'true'); UI.toast('Informe um valor entre 1 e 3.000 ml.', { erro: true }); return; }
        UI.agir(() => S.put({ tipo: 'registroAgua', perfil: UI.state.perfil, data: UI.state.data, hora: L.horaAgora(), ml: Math.round(v) }));
      },
      aguaDesfazer() { const regs = L.aguaRegistros(UI.state.perfil, UI.state.data); if (regs.length) UI.agir(() => S.remove(regs[regs.length - 1].id)); },
      sup(ds) {
        const p = UI.state.perfil, d = UI.state.data;
        const ex = S.find(p, 'registroSuplemento', r => r.data === d && r.suplementoId === ds.id);
        UI.agir(() => ex && ex.status === ds.v ? S.remove(ex.id) : S.put(Object.assign(ex || { tipo: 'registroSuplemento', perfil: p, data: d, suplementoId: ds.id }, { status: ds.v })));
      },
      med(ds) {
        const p = UI.state.perfil, d = UI.state.data;
        const ex = S.find(p, 'registroMedicamento', r => r.data === d && r.medicamentoId === ds.id);
        UI.agir(() => ex && ex.status === ds.v ? S.remove(ex.id) : S.put(Object.assign(ex || { tipo: 'registroMedicamento', perfil: p, data: d, medicamentoId: ds.id }, { status: ds.v })));
      },
      treino(ds) { UI.agir(() => diario(UI.state.perfil, UI.state.data, r => { r.treinoStatus = r.treinoStatus === ds.v ? null : ds.v; })); },
      recup(ds, el) {
        UI.agir(() => diario(UI.state.perfil, UI.state.data, r => {
          r.recuperacao = Object.assign({ fadiga: null, dor: null, disposicao: null, observacao: null }, r.recuperacao || {});
          r.recuperacao[ds.k] = el.value ? Number(el.value) : null;
        }));
      },
      sonoQ(ds) { const n = Number(ds.v); qualidadeTmp = qualidadeTmp === n ? null : n; document.querySelectorAll('[data-a="sonoQ"]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === qualidadeTmp))); },
      sono(ds, f) {
        const de = f.querySelector('#so-d').value, ac = f.querySelector('#so-a').value;
        if (!L.duracaoSono(de, ac)) { UI.toast('Confira os horários de deitar e acordar.', { erro: true }); return; }
        const q = qualidadeTmp; qualidadeTmp = null;
        UI.agir(() => S.put({ tipo: 'registroSono', perfil: UI.state.perfil, data: UI.state.data, deitar: de, acordar: ac, qualidade: q, observacao: null }));
      },
      habito(ds) {
        const p = UI.state.perfil, d = UI.state.data;
        const ex = S.find(p, 'registroHabito', r => r.data === d && r.habitoId === ds.id);
        UI.agir(() => ex ? S.remove(ex.id) : S.put({ tipo: 'registroHabito', perfil: p, data: d, habitoId: ds.id, feito: true }));
      }
    }
  });
})(window.HJ);
