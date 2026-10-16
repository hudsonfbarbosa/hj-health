/* H&J Health — tela NUTRIÇÃO: plano por refeição, edição, metas e equivalências */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  let aba = null;

  const META_NOMES = { agua: 'Água', calorias: 'Calorias', proteina: 'Proteína', carboidrato: 'Carboidrato', gordura: 'Gordura', fibras: 'Fibras', sono: 'Sono', passos: 'Passos' };
  const VAR_NOMES = { todos: 'Todos os dias', treino: 'Dias de treino', descanso: 'Dias de descanso' };
  const FONTES = [['usuario', 'Informado por mim'], ['estimativa', 'Estimativa'], ['profissional', 'Profissional']];

  const EQUIV = [
    ['Carboidrato', '100 g de arroz cozido (4 colheres de sopa)', '100 g de macarrão cozido · 230 g de batata · 1 pão francês · 90 g de mandioca · 1 tapioca pequena (35 g de goma)'],
    ['Proteína', '100 g de filé de frango', '100 g de patinho ou coxão mole · 1 lata de atum em água · 4 ovos · 1 dose de whey + 1 ovo'],
    ['Fruta', '1 banana', '1 maçã · 1 fatia grande de mamão · 10 morangos · 1 laranja'],
    ['Gordura', '1 colher de chá de azeite', '2 castanhas-do-pará · 10 g de amendoim · 1/4 de abacate pequeno']
  ];

  function qtd(i) {
    const p = [];
    if (i.quantidade !== null) p.push(L.fmtNum(i.quantidade) + (i.unidade ? ' ' + i.unidade : ''));
    if (i.medidaCaseira) p.push(i.medidaCaseira);
    return p.length ? esc(p.join(' · ')) : UI.NI;
  }
  function macros(i) {
    const m = [['kcal', 'kcal'], ['proteina', 'P'], ['carboidrato', 'C'], ['gordura', 'G']].filter(([k]) => i[k] !== null);
    return m.length ? m.map(([k, l]) => l + ' ' + L.fmtNum(i[k]) + (k === 'kcal' ? '' : ' g')).join(' · ') : '';
  }
  function totalMacros(r) {
    const com = r.itens.filter(i => i.kcal !== null);
    if (!com.length) return '';
    const s = k => com.reduce((a, i) => a + (i[k] || 0), 0);
    return '<p class="muted small">Soma dos itens informados: ' + L.fmtNum(s('kcal'), 0) + ' kcal · P ' + L.fmtNum(s('proteina')) + ' g · C ' + L.fmtNum(s('carboidrato')) + ' g · G ' + L.fmtNum(s('gordura')) + ' g' +
      (com.length < r.itens.length ? ' (' + (r.itens.length - com.length) + ' item(ns) sem valores)' : '') + '</p>';
  }

  function planoHTML(pl) {
    let h = '<div class="card"><div class="card-head"><div><h2>' + esc(pl.nome) + ' ' + UI.fonte(pl.fonte) + (pl.ativo ? '' : ' <span class="badge">Inativo</span>') + '</h2><p class="muted small">' + UI.diasTexto(pl.diasSemana) + '</p></div>' +
      '<button class="btn sm" type="button" data-a="editPlano" data-id="' + pl.id + '">' + icon('editar', 'sm') + 'Editar</button></div>' +
      (pl.observacao ? '<div class="callout">' + icon('info') + '<div>' + esc(pl.observacao) + '</div></div>' : '') + '</div>';
    pl.refeicoes.slice().sort((a, b) => (a.horario || '99') < (b.horario || '99') ? -1 : 1).forEach(r => {
      h += '<div class="card"><div class="card-head"><div><h2><span class="num muted">' + esc(r.horario || '--:--') + '</span> ' + esc(r.nome) + '</h2><p class="muted small">' + (r.funcao ? 'Função: ' + esc(r.funcao) : 'Função não informada') + '</p></div>' +
        '<button class="btn sm" type="button" data-a="editRef" data-pl="' + pl.id + '" data-id="' + r.id + '">' + icon('editar', 'sm') + 'Editar</button></div><div class="list">';
      r.itens.forEach(i => {
        h += '<div class="row"><div class="grow"><div class="title">' + esc(i.nome) + ' ' + UI.fonte(i.fonte) + '</div><div class="desc">' + qtd(i) + (macros(i) ? ' · ' + macros(i) : '') + (i.observacao ? '<br>' + esc(i.observacao) : '') + '</div></div>' +
          '<button class="btn ghost icon" type="button" data-a="editItem" data-pl="' + pl.id + '" data-r="' + r.id + '" data-id="' + i.id + '" aria-label="Editar ' + esc(i.nome) + '">' + icon('editar', 'sm') + '</button></div>';
      });
      if (!r.itens.length) h += '<p class="empty">Nenhum alimento.</p>';
      h += '</div>' + totalMacros(r);
      if (r.substituicoes.length) {
        h += '<hr class="sep"><h3 style="margin-bottom:6px">Substituições</h3><div class="list">' + r.substituicoes.map(s =>
          '<div class="row"><div class="grow"><div>' + esc(s.descricao) + '</div><div class="desc">' + (s.autorizada ? '<span class="badge ok">Prevista no plano</span>' : '<span class="badge warn">Conferir com o profissional</span>') + ' ' + UI.fonte(s.fonte) + (s.observacao ? ' ' + esc(s.observacao) : '') + '</div></div>' +
          '<button class="btn ghost icon" type="button" data-a="editSub" data-pl="' + pl.id + '" data-r="' + r.id + '" data-id="' + s.id + '" aria-label="Editar substituição">' + icon('editar', 'sm') + '</button></div>').join('') + '</div>';
      }
      if (r.observacao) h += '<p class="muted small" style="margin-top:8px">' + esc(r.observacao) + '</p>';
      h += '<div class="btns" style="margin-top:10px"><button class="btn sm" type="button" data-a="novoItem" data-pl="' + pl.id + '" data-r="' + r.id + '">' + icon('plus', 'sm') + 'Alimento</button><button class="btn sm" type="button" data-a="novaSub" data-pl="' + pl.id + '" data-r="' + r.id + '">' + icon('plus', 'sm') + 'Substituição</button></div></div>';
    });
    h += '<div class="btns"><button class="btn" type="button" data-a="novaRef" data-pl="' + pl.id + '">' + icon('plus', 'sm') + 'Nova refeição</button></div>';
    return h;
  }

  function metasHTML(p) {
    const ms = S.list(p, 'meta').sort((a, b) => Object.keys(META_NOMES).indexOf(a.chave) - Object.keys(META_NOMES).indexOf(b.chave));
    return '<div class="card"><div class="card-head"><h2>Metas</h2><button class="btn sm" type="button" data-a="novaMeta">' + icon('plus', 'sm') + 'Meta</button></div>' +
      '<p class="muted small" style="margin-bottom:10px">Metas marcadas como estimativa vêm do plano montado em 15/10/2026. Não são prescrição profissional.</p>' +
      (ms.length ? '<div class="table-wrap"><table><thead><tr><th>Meta</th><th>Quando</th><th class="n">Valor</th><th>Origem</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        ms.map(m => '<tr><td>' + esc(META_NOMES[m.chave]) + (m.observacao ? '<br><span class="muted tiny">' + esc(m.observacao) + '</span>' : '') + '</td><td>' + VAR_NOMES[m.variante] + '</td><td class="n">' + L.fmtNum(m.valor) + (m.valorMax !== null ? '–' + L.fmtNum(m.valorMax) : '') + ' ' + esc(m.unidade) + '</td><td>' + (UI.fonte(m.fonte) || 'Informado') + '</td>' +
          '<td><button class="btn ghost icon" type="button" data-a="editMeta" data-id="' + m.id + '" aria-label="Editar meta">' + icon('editar', 'sm') + '</button></td></tr>').join('') + '</tbody></table></div>'
        : '<p class="empty">Nenhuma meta definida. Metas só aparecem quando informadas ou definidas por você.</p>') + '</div>';
  }

  function equivHTML() {
    return '<div class="card"><div class="card-head"><h2>Equivalências rápidas ' + UI.fonte('estimativa') + '</h2></div><p class="muted small" style="margin-bottom:10px">Do plano de 15/10/2026. Troque dentro do mesmo grupo. Não substitui orientação profissional.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Grupo</th><th>Equivale a</th><th>Pode trocar por</th></tr></thead><tbody>' + EQUIV.map(e => '<tr><td>' + e.map(esc).join('</td><td>') + '</td></tr>').join('') + '</tbody></table></div></div>';
  }

  async function salvarPlano(pl, fn) { const c = JSON.parse(JSON.stringify(pl)); fn(c); await S.put(c); }
  const achar = (pl, rid) => pl.refeicoes.find(r => r.id === rid);

  UI.route('nutricao', {
    titulo: 'Nutrição',
    render() {
      const p = UI.state.perfil;
      const pls = L.planos(p);
      const abas = pls.map(x => [x.id, x.nome]).concat([['metas', 'Metas'], ['equiv', 'Equivalências']]);
      if (!abas.find(a => a[0] === aba)) aba = pls.length ? (L.planoDoDia(p, L.hoje()) || pls[0]).id : 'metas';
      let h = '<div class="page-head"><div><h1>Nutrição</h1><div class="sub">Plano de ' + esc(UI.nomePerfil()) + '</div></div><button class="btn sm" type="button" data-a="novoPlano">' + icon('plus', 'sm') + 'Novo plano</button></div>';
      h += UI.tabs(abas, aba, 'aba');
      if (aba === 'metas') return h + metasHTML(p);
      if (aba === 'equiv') return h + equivHTML();
      const pl = S.get(aba);
      return h + (pl ? planoHTML(pl) : '<p class="empty">Plano não encontrado.</p>');
    },
    acoes: {
      aba(ds) { aba = ds.v; UI.render(true); },
      novoPlano() {
        UI.form({ titulo: 'Novo plano alimentar', campos: [{ k: 'nome', label: 'Nome', req: true, ph: 'Ex.: Dia de treino' }, { k: 'diasSemana', label: 'Dias da semana', tipo: 'dias' }, { k: 'observacao', label: 'Observações', tipo: 'textarea' }],
          valores: { diasSemana: [] },
          onSalvar: async v => { const r = await S.put({ tipo: 'planoAlimentar', perfil: UI.state.perfil, nome: v.nome, diasSemana: v.diasSemana, ativo: true, refeicoes: [], observacao: v.observacao, fonte: 'usuario' }); aba = r.id; }
        });
      },
      editPlano(ds) {
        const pl = S.get(ds.id);
        UI.form({ titulo: 'Editar plano', campos: [{ k: 'nome', label: 'Nome', req: true }, { k: 'diasSemana', label: 'Dias da semana em que vale', tipo: 'dias', help: 'Se dois planos ativos valem no mesmo dia, o primeiro em ordem alfabética é usado. Em Hoje você pode trocar o plano do dia.' }, { k: 'ativo', label: 'Plano ativo', tipo: 'checkbox' }, { k: 'observacao', label: 'Observações', tipo: 'textarea' }],
          valores: pl,
          onSalvar: v => salvarPlano(pl, c => Object.assign(c, v)),
          onExcluir: () => S.remove(pl.id)
        });
      },
      novaRef(ds) { editarRef(S.get(ds.pl), null); },
      editRef(ds) { const pl = S.get(ds.pl); editarRef(pl, achar(pl, ds.id)); },
      novoItem(ds) { const pl = S.get(ds.pl); editarItem(pl, ds.r, null); },
      editItem(ds) { const pl = S.get(ds.pl); editarItem(pl, ds.r, achar(pl, ds.r).itens.find(i => i.id === ds.id)); },
      novaSub(ds) { const pl = S.get(ds.pl); editarSub(pl, ds.r, null); },
      editSub(ds) { const pl = S.get(ds.pl); editarSub(pl, ds.r, achar(pl, ds.r).substituicoes.find(s => s.id === ds.id)); },
      novaMeta() { editarMeta(null); },
      editMeta(ds) { editarMeta(S.get(ds.id)); }
    }
  });

  function editarRef(pl, r) {
    UI.form({ titulo: r ? 'Editar refeição' : 'Nova refeição', duasColunas: true,
      campos: [{ k: 'nome', label: 'Nome', req: true }, { k: 'horario', label: 'Horário', tipo: 'time' }, { k: 'funcao', label: 'Função', ph: 'Ex.: Recuperação', span2: true }, { k: 'observacao', label: 'Observação', tipo: 'textarea', span2: true }],
      valores: r || {},
      onSalvar: v => salvarPlano(pl, c => {
        if (r) Object.assign(achar(c, r.id), v);
        else c.refeicoes.push(Object.assign({ id: HJ.schema.uuid(), itens: [], substituicoes: [], fonte: 'usuario' }, v));
      }),
      onExcluir: r ? () => salvarPlano(pl, c => { c.refeicoes = c.refeicoes.filter(x => x.id !== r.id); }) : null
    });
  }
  function editarItem(pl, rid, i) {
    UI.form({ titulo: i ? 'Editar alimento' : 'Novo alimento', duasColunas: true,
      campos: [{ k: 'nome', label: 'Alimento', req: true, span2: true }, { k: 'quantidade', label: 'Quantidade', tipo: 'number', min: 0 }, { k: 'unidade', label: 'Unidade', lista: ['g', 'ml', 'un', 'fatia', 'colher de sopa', 'colher de chá'] },
        { k: 'medidaCaseira', label: 'Medida caseira', ph: 'Ex.: 4 colheres de sopa', span2: true },
        { k: 'kcal', label: 'Calorias (kcal)', tipo: 'number', min: 0, help: 'Deixe em branco se não souber.' }, { k: 'proteina', label: 'Proteína (g)', tipo: 'number', min: 0 },
        { k: 'carboidrato', label: 'Carboidrato (g)', tipo: 'number', min: 0 }, { k: 'gordura', label: 'Gordura (g)', tipo: 'number', min: 0 },
        { k: 'observacao', label: 'Observação', span2: true }, { k: 'fonte', label: 'Origem do dado', tipo: 'select', opcoes: FONTES, req: true }],
      valores: i || { fonte: 'usuario' },
      onSalvar: v => salvarPlano(pl, c => {
        const r = achar(c, rid);
        if (i) Object.assign(r.itens.find(x => x.id === i.id), v);
        else r.itens.push(Object.assign({ id: HJ.schema.uuid() }, v));
      }),
      onExcluir: i ? () => salvarPlano(pl, c => { const r = achar(c, rid); r.itens = r.itens.filter(x => x.id !== i.id); }) : null
    });
  }
  function editarSub(pl, rid, s) {
    UI.form({ titulo: s ? 'Editar substituição' : 'Nova substituição',
      campos: [{ k: 'descricao', label: 'Substituição', req: true, ph: 'Ex.: 400 g de batata no lugar do arroz' }, { k: 'autorizada', label: 'Prevista no plano ou autorizada por profissional', tipo: 'checkbox', help: 'Se desmarcada, aparece como "Conferir com o profissional".' }, { k: 'observacao', label: 'Observação' }],
      valores: s || { autorizada: false },
      onSalvar: v => salvarPlano(pl, c => {
        const r = achar(c, rid);
        if (s) Object.assign(r.substituicoes.find(x => x.id === s.id), v, { fonte: 'usuario' });
        else r.substituicoes.push(Object.assign({ id: HJ.schema.uuid(), fonte: 'usuario' }, v));
      }),
      onExcluir: s ? () => salvarPlano(pl, c => { const r = achar(c, rid); r.substituicoes = r.substituicoes.filter(x => x.id !== s.id); }) : null
    });
  }
  function editarMeta(m) {
    UI.form({ titulo: m ? 'Editar meta' : 'Nova meta', duasColunas: true,
      campos: [{ k: 'chave', label: 'Meta', tipo: 'select', req: true, opcoes: Object.entries(META_NOMES) }, { k: 'variante', label: 'Quando vale', tipo: 'select', req: true, opcoes: Object.entries(VAR_NOMES) },
        { k: 'valor', label: 'Valor (mínimo)', tipo: 'number', req: true, min: 0 }, { k: 'valorMax', label: 'Valor máximo (opcional)', tipo: 'number', min: 0 },
        { k: 'unidade', label: 'Unidade', req: true, lista: ['ml', 'kcal', 'g', 'h', 'passos'] }, { k: 'fonte', label: 'Origem', tipo: 'select', req: true, opcoes: FONTES },
        { k: 'observacao', label: 'Observação', span2: true }],
      valores: m || { variante: 'todos', fonte: 'usuario' },
      onSalvar: v => {
        if (v.valorMax !== null && v.valorMax < v.valor) throw new Error('O valor máximo deve ser maior que o mínimo.');
        const dup = S.find(UI.state.perfil, 'meta', x => x.chave === v.chave && x.variante === v.variante && (!m || x.id !== m.id));
        if (dup) throw new Error('Já existe essa meta para esse período. Edite a existente.');
        return S.put(Object.assign(m ? JSON.parse(JSON.stringify(m)) : { tipo: 'meta', perfil: UI.state.perfil }, v));
      },
      onExcluir: m ? () => S.remove(m.id) : null
    });
  }
})(window.HJ);
