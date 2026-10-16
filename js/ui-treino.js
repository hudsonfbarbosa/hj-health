/* H&J Health — tela TREINO: rotina, sessões, histórico de carga e corrida */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  const MOD = { musculacao: 'Musculação', corrida: 'Corrida', caminhada: 'Caminhada', cardio: 'Cardio', outro: 'Outro' };
  const MOD_ROT = { musculacao: 'Musculação', cardio: 'Cardio', corrida: 'Corrida', caminhada: 'Caminhada', descanso: 'Descanso', outro: 'Outro' };
  let ed = null;         // rascunho da sessão em edição
  let exSel = null;      // exercício selecionado no histórico de carga

  const novaSessao = (p, d) => {
    const tp = L.treinoPlanejado(p, d);
    return { tipo: 'sessaoTreino', perfil: p, data: d, nome: tp ? tp.nome : null, modalidade: tp && MOD[tp.modalidade] ? tp.modalidade : 'musculacao', duracaoMin: null, esforco: null, exercicios: [], distanciaKm: null, duracaoSeg: null, fcMedia: null, observacao: null };
  };
  const aerobio = m => ['corrida', 'caminhada', 'cardio'].includes(m);

  function sincronizar() {
    const f = document.getElementById('sessao');
    if (!f || !ed) return true;
    const g = id => f.querySelector('#' + id);
    ed.data = g('s-data').value;
    ed.modalidade = g('s-mod').value;
    ed.nome = g('s-nome').value.trim() || null;
    ed._dur = g('s-dur').value; ed._esf = g('s-esf').value; ed.observacao = g('s-obs').value.trim() || null;
    if (g('s-dist')) { ed._dist = g('s-dist').value; ed._tempo = g('s-tempo').value; ed._fc = g('s-fc').value; }
    f.querySelectorAll('[data-ex]').forEach(bl => {
      const ex = ed.exercicios[Number(bl.dataset.ex)];
      ex.nome = bl.querySelector('.ex-nome').value;
      bl.querySelectorAll('[data-serie]').forEach(sr => {
        const s = ex.series[Number(sr.dataset.serie)];
        s._reps = sr.querySelector('.reps').value; s._carga = sr.querySelector('.carga').value;
      });
    });
    return true;
  }

  function editorHTML(p) {
    const v = (x, alt) => esc(x !== undefined && x !== null ? x : (alt !== undefined && alt !== null ? alt : ''));
    const nomes = [...new Set(S.list(p, 'exercicio').map(e => e.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const rot = (L.config(p) || {}).rotinaTreino || {};
    const nomesTreino = [...new Set(Object.values(rot).map(t => t.nome))];
    let h = '<form id="sessao" class="card" data-a="salvarSessao" novalidate><div class="card-head"><h2>' + (ed.id ? 'Editar sessão' : 'Nova sessão') + '</h2></div><div class="form-grid two">' +
      '<div class="field"><label for="s-data">Data</label><input id="s-data" type="date" value="' + v(ed.data) + '" max="' + L.hoje() + '" required></div>' +
      '<div class="field"><label for="s-mod">Modalidade</label><select id="s-mod" data-a="edMod">' + Object.entries(MOD).map(([k, l]) => '<option value="' + k + '"' + (ed.modalidade === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="s-nome">Nome do treino</label><input id="s-nome" type="text" list="s-nome-l" value="' + v(ed.nome) + '" placeholder="Ex.: Upper A"><datalist id="s-nome-l">' + nomesTreino.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label for="s-dur">Duração (min)</label><input id="s-dur" type="number" inputmode="numeric" min="1" max="600" value="' + v(ed._dur, ed.duracaoMin) + '"></div>' +
      '<div class="field"><label for="s-esf">Esforço percebido (1–10)</label><input id="s-esf" type="number" inputmode="numeric" min="1" max="10" step="1" value="' + v(ed._esf, ed.esforco) + '"></div>';
    if (aerobio(ed.modalidade)) {
      const dist = L.parseNum(ed._dist !== undefined ? ed._dist : ed.distanciaKm), seg = ed._tempo !== undefined ? L.parseDuracaoSeg(ed._tempo) : ed.duracaoSeg;
      const ritmo = L.ritmoSegKm(dist, seg);
      h += '<div class="field"><label for="s-dist">Distância (km)</label><input id="s-dist" type="text" inputmode="decimal" value="' + v(ed._dist, ed.distanciaKm) + '"></div>' +
        '<div class="field"><label for="s-tempo">Tempo (mm:ss ou h:mm:ss)</label><input id="s-tempo" type="text" inputmode="numeric" placeholder="28:30" value="' + v(ed._tempo, ed.duracaoSeg ? L.fmtSeg(ed.duracaoSeg) : '') + '"></div>' +
        '<div class="field"><label for="s-fc">FC média (bpm, opcional)</label><input id="s-fc" type="number" inputmode="numeric" min="30" max="230" value="' + v(ed._fc, ed.fcMedia) + '"></div>' +
        '<div class="field"><span class="lbl">Ritmo</span><p class="num" style="min-height:44px;display:flex;align-items:center">' + (ritmo ? L.fmtSeg(ritmo) + ' /km' : '<span class="muted">Calculado com distância e tempo válidos</span>') + '</p></div>';
    }
    h += '<div class="field span2"><label for="s-obs">Observação</label><input id="s-obs" type="text" value="' + v(ed.observacao) + '"></div></div>';
    if (ed.modalidade === 'musculacao') {
      h += '<hr class="sep"><h3>Exercícios</h3><datalist id="ex-l">' + nomes.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
      ed.exercicios.forEach((ex, i) => {
        h += '<div class="card flat" data-ex="' + i + '" style="margin-top:10px;padding:12px"><div class="btns" style="flex-wrap:nowrap"><label class="sr-only" for="ex-' + i + '">Exercício ' + (i + 1) + '</label><input id="ex-' + i + '" class="ex-nome" type="text" list="ex-l" placeholder="Exercício" value="' + esc(ex.nome) + '">' +
          '<button class="btn icon" type="button" data-a="rmEx" data-v="' + i + '" aria-label="Remover exercício">' + icon('lixo', 'sm') + '</button></div>';
        ex.series.forEach((s, j) => {
          h += '<div class="btns" data-serie="' + j + '" style="margin-top:8px;flex-wrap:nowrap;align-items:center"><span class="muted small" style="width:48px">Série ' + (j + 1) + '</span>' +
            '<label class="sr-only" for="r-' + i + '-' + j + '">Repetições</label><input id="r-' + i + '-' + j + '" class="reps" type="number" inputmode="numeric" min="0" max="200" step="1" placeholder="reps" value="' + esc(s._reps !== undefined ? s._reps : s.reps !== null ? s.reps : '') + '">' +
            '<label class="sr-only" for="c-' + i + '-' + j + '">Carga em kg</label><input id="c-' + i + '-' + j + '" class="carga" type="text" inputmode="decimal" placeholder="kg" value="' + esc(s._carga !== undefined ? s._carga : s.carga !== null ? s.carga : '') + '">' +
            '<button class="btn icon" type="button" data-a="rmSerie" data-v="' + i + '-' + j + '" aria-label="Remover série">' + icon('x', 'sm') + '</button></div>';
        });
        h += '<button class="btn sm" type="button" data-a="addSerie" data-v="' + i + '" style="margin-top:8px">' + icon('plus', 'sm') + 'Série</button></div>';
      });
      h += '<button class="btn sm" type="button" data-a="addEx" style="margin-top:10px">' + icon('plus', 'sm') + 'Exercício</button>';
    }
    h += '<p class="err small" id="s-err" role="alert"></p><div class="btns end" style="margin-top:12px">' + (ed.id ? '<button class="btn danger" type="button" data-a="rmSessao" style="margin-right:auto">' + icon('lixo', 'sm') + 'Excluir</button>' : '') +
      '<button class="btn" type="button" data-a="cancelar">Cancelar</button><button class="btn primary" type="submit">Salvar sessão</button></div></form>';
    return h;
  }

  function resumoSessao(s) {
    const partes = [MOD[s.modalidade]];
    if (s.duracaoMin) partes.push(L.fmtNum(s.duracaoMin, 0) + ' min');
    if (s.esforco) partes.push('esforço ' + s.esforco + '/10');
    if (s.exercicios.length) partes.push(s.exercicios.length + ' exercício(s)');
    if (s.distanciaKm) partes.push(L.fmtNum(s.distanciaKm, 2) + ' km');
    const r = L.ritmoSegKm(s.distanciaKm, s.duracaoSeg);
    if (r) partes.push(L.fmtSeg(r) + '/km');
    return partes.join(' · ');
  }

  function cargaHTML(p) {
    const ses = S.list(p, 'sessaoTreino', s => s.modalidade === 'musculacao').sort((a, b) => (a.data < b.data ? -1 : 1));
    const nomes = [...new Set(ses.flatMap(s => s.exercicios.map(e => e.nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    let h = '<div class="card"><div class="card-head"><h2>Histórico de carga</h2></div>';
    if (!nomes.length) return h + '<p class="empty">Registre exercícios com carga para ver a evolução.</p></div>';
    if (!nomes.includes(exSel)) exSel = nomes[0];
    h += '<div class="field" style="margin-bottom:10px"><label for="ex-sel">Exercício</label><select id="ex-sel" data-a="exSel">' + nomes.map(n => '<option' + (n === exSel ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></div>';
    const linhas = [];
    ses.forEach(s => s.exercicios.filter(e => e.nome === exSel).forEach(e => {
      const val = e.series.filter(x => x.carga !== null && x.reps !== null);
      if (!val.length) return;
      const max = val.reduce((a, b) => (b.carga > a.carga || (b.carga === a.carga && b.reps > a.reps) ? b : a));
      linhas.push({ data: s.data, max, vol: val.reduce((t, x) => t + x.carga * x.reps, 0), series: e.series.length });
    }));
    if (!linhas.length) return h + '<p class="empty">Sem séries com carga e repetições para este exercício.</p></div>';
    const ini = linhas[0].data, fim = linhas[linhas.length - 1].data;
    h += UI.grafico({ pontos: linhas.map(l => ({ x: l.data, y: l.max.carga })), ini, fim: fim === ini ? L.addDias(ini, 1) : fim, tipo: 'linha', unidade: 'kg', titulo: 'Carga máxima por sessão: ' + exSel });
    h += '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Data</th><th class="n">Maior carga</th><th class="n">Séries</th><th class="n">Volume (kg×reps)</th></tr></thead><tbody>' +
      linhas.slice().reverse().map(l => '<tr><td>' + L.fmtData(l.data) + '</td><td class="n">' + L.fmtNum(l.max.carga) + ' kg × ' + l.max.reps + '</td><td class="n">' + l.series + '</td><td class="n">' + L.fmtNum(l.vol, 0) + '</td></tr>').join('') + '</tbody></table></div></div>';
    return h;
  }

  function corridaHTML(p) {
    const objs = S.list(p, 'objetivoCorrida');
    let h = '<div class="card"><div class="card-head"><h2>Objetivos de corrida</h2><button class="btn sm" type="button" data-a="novoObj">' + icon('plus', 'sm') + 'Objetivo</button></div>';
    if (!objs.length) return h + '<p class="empty">Nenhum objetivo. Exemplo: 5 km abaixo de 30 min.</p></div>';
    return h + '<div class="list">' + objs.map(o => {
      const st = L.statusObjetivo(p, o);
      const txt = st.atingido ? '<span class="badge ok">' + icon('check', 'sm') + 'Atingido</span> melhor tempo ' + L.fmtSeg(st.melhor.duracaoSeg) + ' em ' + L.fmtData(st.melhor.data)
        : st.melhor ? 'Melhor registro compatível: ' + L.fmtSeg(st.melhor.duracaoSeg) + ' (' + L.fmtData(st.melhor.data) + ')' : 'Sem registro compatível ainda (corrida de ' + L.fmtNum(o.distanciaKm) + ' km com tempo).';
      return '<div class="row"><div class="grow"><div class="title">' + esc(o.nome) + (o.ativo ? '' : ' <span class="badge">Pausado</span>') + '</div><div class="desc">' + txt + '</div></div><button class="btn ghost icon" type="button" data-a="editObj" data-id="' + o.id + '" aria-label="Editar objetivo">' + icon('editar', 'sm') + '</button></div>';
    }).join('') + '</div><p class="muted tiny" style="margin-top:8px">Só conta como atingido com uma corrida registrada na distância do objetivo (até 4% a mais), com tempo abaixo da meta.</p></div>';
  }

  UI.route('treino', {
    titulo: 'Treino',
    render(params) {
      const p = UI.state.perfil;
      if (params.nova && (!ed || ed._origem !== 'nova-' + params.nova + p)) { ed = novaSessao(p, HJ.schema.validDate(params.nova) ? params.nova : L.hoje()); ed._origem = 'nova-' + params.nova + p; }
      if (params.editar && (!ed || ed.id !== params.editar)) { const s = S.get(params.editar); ed = s && s.perfil === p ? JSON.parse(JSON.stringify(s)) : null; }
      if (!params.nova && !params.editar) ed = null;
      if (ed && ed.perfil !== p) ed = null;
      const c = L.config(p) || {};
      const rot = c.rotinaTreino || {};
      let h = '<div class="page-head"><div><h1>Treino</h1><div class="sub">' + esc(UI.nomePerfil()) + '</div></div>' + (ed ? '' : '<a class="btn sm primary" href="#treino?nova=' + L.hoje() + '">' + icon('plus', 'sm') + 'Nova sessão</a>') + '</div>';
      if (ed) return h + editorHTML(p);
      h += '<div class="card"><div class="card-head"><h2>Rotina semanal</h2><button class="btn sm" type="button" data-a="editRotina"' + (c.id ? '' : ' disabled') + '>' + icon('editar', 'sm') + 'Editar</button></div><div class="list">' +
        [1, 2, 3, 4, 5, 6, 0].map(d => { const t = rot[String(d)]; return '<div class="row" style="min-height:40px;padding:6px 0"><span style="width:44px" class="muted small">' + L.DIAS_CURTO[d] + '</span><span class="grow">' + (t ? esc(t.nome) + ' <span class="muted small">· ' + MOD_ROT[t.modalidade] + '</span>' : '<span class="muted">Sem treino definido</span>') + '</span></div>'; }).join('') +
        '</div>' + (c.id ? '' : '<p class="muted small">Importe os dados do perfil para definir a rotina.</p>') + '</div>';
      const ses = S.list(p, 'sessaoTreino').sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.criadoEm < b.criadoEm ? 1 : -1));
      h += '<div class="card"><div class="card-head"><h2>Sessões registradas</h2><span class="meta">' + ses.length + '</span></div>' +
        (ses.length ? '<div class="list">' + ses.slice(0, 40).map(s => '<a class="row" href="#treino?editar=' + s.id + '" style="color:inherit;text-decoration:none"><div class="grow"><div class="title">' + L.fmtData(s.data) + ' · ' + esc(s.nome || MOD[s.modalidade]) + '</div><div class="desc">' + esc(resumoSessao(s)) + '</div></div>' + icon('dir', 'sm') + '</a>').join('') + '</div>' + (ses.length > 40 ? '<p class="muted small">Mostrando as 40 mais recentes. Veja todas em Relatórios.</p>' : '')
          : '<p class="empty">Nenhuma sessão detalhada ainda. Marcar o treino em Hoje já conta; detalhar é opcional.</p>') + '</div>';
      return h + '<div class="grid2">' + cargaHTML(p) + corridaHTML(p) + '</div>';
    },
    acoes: {
      edMod() {
        sincronizar(); ed.modalidade = document.getElementById('s-mod').value;
        const tp = L.treinoPlanejado(ed.perfil, ed.data);
        if (tp && ed.nome === tp.nome && tp.modalidade !== ed.modalidade) ed.nome = null; // nome do treino planejado não vale para outra modalidade
        UI.render(true);
      },
      addEx() { sincronizar(); ed.exercicios.push({ exercicioId: null, nome: '', series: [{ reps: null, carga: null }], observacao: null }); UI.render(true); const el = document.getElementById('ex-' + (ed.exercicios.length - 1)); if (el) el.focus(); },
      rmEx(ds) { sincronizar(); ed.exercicios.splice(Number(ds.v), 1); UI.render(true); },
      addSerie(ds) {
        sincronizar(); const ex = ed.exercicios[Number(ds.v)]; const ult = ex.series[ex.series.length - 1];
        ex.series.push(ult ? { reps: null, carga: null, _reps: ult._reps, _carga: ult._carga } : { reps: null, carga: null }); UI.render(true);
      },
      rmSerie(ds) { sincronizar(); const [i, j] = ds.v.split('-').map(Number); ed.exercicios[i].series.splice(j, 1); UI.render(true); },
      cancelar() { ed = null; history.length > 1 ? history.back() : UI.ir('treino'); },
      async rmSessao() {
        if (!await UI.confirmar({ titulo: 'Excluir sessão?', texto: 'A sessão de ' + L.fmtData(ed.data) + ' será apagada.', ok: 'Excluir', perigo: true })) return;
        const id = ed.id; ed = null; await S.remove(id); UI.ir('treino');
      },
      async salvarSessao() {
        sincronizar();
        const err = m => { document.getElementById('s-err').textContent = m; };
        const p = UI.state.perfil;
        if (!HJ.schema.validDate(ed.data) || ed.data > L.hoje()) return err('Data inválida.');
        const num = (s, nome, int, min, max) => { const n = L.parseNum(s); if (n === null) return null; if (Number.isNaN(n) || (int && !Number.isInteger(n)) || n < min || n > max) throw new Error(nome + ' inválido.'); return n; };
        let rec;
        try {
          rec = { id: ed.id, criadoEm: ed.criadoEm, tipo: 'sessaoTreino', perfil: p, data: ed.data, nome: ed.nome, modalidade: ed.modalidade, observacao: ed.observacao,
            duracaoMin: num(ed._dur !== undefined ? ed._dur : ed.duracaoMin, 'Duração', false, 1, 600), esforco: num(ed._esf !== undefined ? ed._esf : ed.esforco, 'Esforço', true, 1, 10),
            exercicios: [], distanciaKm: null, duracaoSeg: null, fcMedia: null, fonte: 'usuario' };
          if (aerobio(ed.modalidade)) {
            rec.distanciaKm = num(ed._dist !== undefined ? ed._dist : ed.distanciaKm, 'Distância', false, 0.01, 500);
            const t = ed._tempo !== undefined ? L.parseDuracaoSeg(ed._tempo) : ed.duracaoSeg;
            if (Number.isNaN(t) || (t !== null && t <= 0)) throw new Error('Tempo inválido. Use mm:ss, por exemplo 28:30.');
            rec.duracaoSeg = t;
            rec.fcMedia = num(ed._fc !== undefined ? ed._fc : ed.fcMedia, 'FC média', true, 30, 230);
          }
          if (ed.modalidade === 'musculacao') {
            for (const ex of ed.exercicios) {
              const nome = (ex.nome || '').trim();
              const series = ex.series.map(s => ({ reps: num(s._reps !== undefined ? s._reps : s.reps, 'Repetições', true, 0, 200), carga: num(s._carga !== undefined ? s._carga : s.carga, 'Carga', false, 0, 1000) })).filter(s => s.reps !== null || s.carga !== null);
              if (!nome && !series.length) continue;
              if (!nome) throw new Error('Dê nome a todos os exercícios.');
              let cat = S.find(p, 'exercicio', e => e.nome.toLowerCase() === nome.toLowerCase());
              if (!cat) cat = await S.put({ tipo: 'exercicio', perfil: p, nome, grupo: null });
              rec.exercicios.push({ exercicioId: cat.id, nome: cat.nome, series, observacao: null });
            }
          }
        } catch (e) { return err(e.message); }
        try {
          await S.put(rec);
          const reg = L.registroDiario(p, rec.data);
          if (!reg || !reg.treinoStatus) await S.put(Object.assign(reg || { tipo: 'registroDiario', perfil: p, data: rec.data, planoId: null, refeicoes: {}, recuperacao: null, observacao: null }, { treinoStatus: 'feito' }));
          ed = null; UI.toast('Sessão salva.'); UI.ir('treino');
        } catch (e) { err('Não foi possível salvar: ' + e.message); }
      },
      exSel(ds, el) { exSel = el.value; UI.render(true); },
      editRotina() {
        const c = L.config(UI.state.perfil);
        const campos = []; const val = {};
        [1, 2, 3, 4, 5, 6, 0].forEach(d => {
          const t = c.rotinaTreino[String(d)];
          campos.push({ k: 'n' + d, label: L.DIAS[d] + ': treino', ph: 'Vazio = sem treino' }, { k: 'm' + d, label: L.DIAS[d] + ': tipo', tipo: 'select', opcoes: Object.entries(MOD_ROT) });
          val['n' + d] = t ? t.nome : ''; val['m' + d] = t ? t.modalidade : '';
        });
        UI.form({ titulo: 'Rotina semanal', duasColunas: true, campos, valores: val,
          onSalvar: v => {
            const rot = {};
            [0, 1, 2, 3, 4, 5, 6].forEach(d => { if (v['n' + d]) rot[d] = { nome: v['n' + d], modalidade: v['m' + d] || 'musculacao' }; });
            const cc = JSON.parse(JSON.stringify(c)); cc.rotinaTreino = rot; return S.put(cc);
          } });
      },
      novoObj() { editarObj(null); },
      editObj(ds) { editarObj(S.get(ds.id)); }
    }
  });

  function editarObj(o) {
    UI.form({ titulo: o ? 'Editar objetivo' : 'Novo objetivo de corrida', duasColunas: true,
      campos: [{ k: 'nome', label: 'Nome', req: true, ph: '5 km abaixo de 30 min', span2: true }, { k: 'distanciaKm', label: 'Distância (km)', tipo: 'number', req: true, min: 0.1, max: 100 }, { k: 'tempo', label: 'Tempo-alvo (mm:ss)', req: true, ph: '30:00' }, { k: 'ativo', label: 'Ativo', tipo: 'checkbox' }],
      valores: o ? Object.assign({}, o, { tempo: L.fmtSeg(o.tempoAlvoSeg) }) : { ativo: true },
      onSalvar: v => {
        const t = L.parseDuracaoSeg(v.tempo);
        if (!t || Number.isNaN(t)) throw new Error('Tempo-alvo inválido. Use mm:ss.');
        return S.put(Object.assign(o ? JSON.parse(JSON.stringify(o)) : { tipo: 'objetivoCorrida', perfil: UI.state.perfil }, { nome: v.nome, distanciaKm: v.distanciaKm, tempoAlvoSeg: t, ativo: v.ativo }));
      },
      onExcluir: o ? () => S.remove(o.id) : null });
  }
})(window.HJ);
