/* H&J Health — tela SAÚDE: suplementos, medicamentos, exames, consultas e histórico */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  let aba = 'suplementos';
  const FREQ = { diario: 'Diário', semanal: 'Semanal', condicional: 'Quando necessário', outro: 'Outro' };
  const CAT = { condicao: 'Condição', alergia: 'Alergia', intolerancia: 'Intolerância', cirurgia: 'Cirurgia', vacina: 'Vacina', outro: 'Outro' };
  const FONTES = [['usuario', 'Informado por mim'], ['estimativa', 'Estimativa'], ['profissional', 'Profissional']];

  function foraRef(e) {
    if (e.resultado === null) return null;
    if (e.refMin !== null && e.resultado < e.refMin) return 'abaixo';
    if (e.refMax !== null && e.resultado > e.refMax) return 'acima';
    return null;
  }
  const refTxt = e => (e.refMin !== null || e.refMax !== null ? (e.refMin !== null ? L.fmtNum(e.refMin, 2) : '') + ' a ' + (e.refMax !== null ? L.fmtNum(e.refMax, 2) : '') + ' ' + (e.unidade || '') : '') + (e.refTexto ? ' ' + e.refTexto : '') || 'Não informada';
  const resTxt = e => (e.resultado !== null ? L.fmtNum(e.resultado, 2) + ' ' + esc(e.unidade || '') : '') + (e.resultadoTexto ? ' ' + esc(e.resultadoTexto) : '') || UI.NI;

  function supsHTML(p) {
    const sups = S.list(p, 'suplemento').sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const meds = S.list(p, 'medicamento');
    const linha = (x, tipo) => '<div class="row"><div class="grow"><div class="title">' + esc(x.nome) + ' ' + (x.ativo ? '' : '<span class="badge">Inativo</span>') + ' ' + UI.fonte(x.fonte) + '</div><div class="desc">' +
      (tipo === 'sup' ? (x.dose !== null ? L.fmtNum(x.dose) + ' ' + esc(x.unidade || '') : 'Dose não informada') : (x.dose ? esc(x.dose) : 'Dose não informada')) + ' · ' + FREQ[x.frequencia] +
      (x.frequencia !== 'condicional' ? ' · ' + UI.diasTexto(x.diasSemana) : '') + (x.horario ? ' · ' + x.horario : '') + (x.observacao ? '<br>' + esc(x.observacao) : '') + '</div></div>' +
      '<button class="btn ghost icon" type="button" data-a="' + (tipo === 'sup' ? 'editSup' : 'editMed') + '" data-id="' + x.id + '" aria-label="Editar ' + esc(x.nome) + '">' + icon('editar', 'sm') + '</button></div>';
    return '<div class="card"><div class="card-head"><h2>Suplementos</h2><button class="btn sm" type="button" data-a="novoSup">' + icon('plus', 'sm') + 'Suplemento</button></div>' +
      (sups.length ? '<div class="list">' + sups.map(x => linha(x, 'sup')).join('') + '</div>' : '<p class="empty">Nenhum suplemento.</p>') + '<p class="muted tiny" style="margin-top:8px">Ativos e com dia definido aparecem em Hoje. Inativos ficam guardados para referência.</p></div>' +
      '<div class="card"><div class="card-head"><h2>Medicamentos em uso</h2><button class="btn sm" type="button" data-a="novoMed">' + icon('plus', 'sm') + 'Medicamento</button></div>' +
      (meds.length ? '<div class="list">' + meds.map(x => linha(x, 'med')).join('') + '</div>' : '<p class="empty">Nenhum medicamento registrado.</p>') +
      '<div class="callout" style="margin-top:10px">' + icon('info') + '<div>O app só registra o que você informa. Não sugere dose, suspensão ou troca. Converse com o médico sobre qualquer mudança.</div></div></div>';
  }

  function examesHTML(p) {
    const ex = S.list(p, 'exame');
    let h = '<div class="card"><div class="card-head"><h2>Exames laboratoriais</h2><button class="btn sm" type="button" data-a="novoExame">' + icon('plus', 'sm') + 'Resultado</button></div>';
    if (!ex.length) return h + '<p class="empty">Nenhum exame registrado.</p></div>';
    const grupos = {};
    ex.forEach(e => { (grupos[e.nome] = grupos[e.nome] || []).push(e); });
    Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(nome => {
      const lista = grupos[nome].sort((a, b) => ((a.data || '') < (b.data || '') ? 1 : -1));
      const unidades = [...new Set(lista.filter(e => e.resultado !== null).map(e => (e.unidade || '').trim().toLowerCase()))];
      h += '<div style="border-top:1px solid var(--border);padding:12px 0"><h3>' + esc(nome) + '</h3>';
      if (unidades.length > 1) h += '<div class="callout amber" style="margin:8px 0">' + icon('alerta') + '<div>Resultados em unidades diferentes (' + esc(unidades.join(', ')) + '). Não compare os valores sem conversão validada pelo laboratório ou médico.</div></div>';
      else {
        const num = lista.filter(e => e.resultado !== null && e.data).sort((a, b) => (a.data < b.data ? -1 : 1));
        if (num.length >= 2) h += UI.grafico({ pontos: num.map(e => ({ x: e.data, y: e.resultado })), ini: num[0].data, fim: num[num.length - 1].data, tipo: 'linha', unidade: lista[0].unidade, dec: 2, titulo: 'Histórico de ' + nome });
      }
      h += '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Data</th><th>Resultado</th><th>Referência do laboratório</th><th>Laboratório</th><th><span class="sr-only">Editar</span></th></tr></thead><tbody>' +
        lista.map(e => {
          const f = foraRef(e);
          return '<tr><td>' + (e.data ? L.fmtData(e.data) : UI.NI) + '</td><td>' + resTxt(e) + (f ? '<br><span class="badge warn">' + icon('alerta', 'sm') + (f === 'acima' ? 'Acima' : 'Abaixo') + ' da referência informada</span>' : '') + (e.observacao ? '<br><span class="muted tiny">' + esc(e.observacao) + '</span>' : '') + '</td><td>' + esc(refTxt(e)) + '</td><td>' + esc(e.laboratorio || '—') + '</td>' +
            '<td><button class="btn ghost icon" type="button" data-a="editExame" data-id="' + e.id + '" aria-label="Editar resultado">' + icon('editar', 'sm') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      if (lista.some(foraRef)) h += '<p class="muted small" style="margin-top:6px">Valor fora da referência informada: discuta com o profissional que pediu o exame. O app não interpreta resultados.</p>';
      h += '</div>';
    });
    return h + '</div>';
  }

  function consultasHTML(p) {
    const cs = S.list(p, 'consulta').sort((a, b) => ((a.data || '') < (b.data || '') ? 1 : -1));
    const ag = cs.filter(c => c.status === 'agendada').sort((a, b) => ((a.data || '9') < (b.data || '9') ? -1 : 1));
    const re = cs.filter(c => c.status === 'realizada');
    const item = c => '<div class="row"><div class="grow"><div class="title">' + (c.data ? L.fmtData(c.data) : 'Data não informada') + (c.hora ? ' às ' + c.hora : '') + ' · ' + esc(c.especialidade || 'Consulta') + '</div><div class="desc">' + esc(c.profissional || '') +
      (c.orientacoes ? '<br>Orientações: ' + esc(c.orientacoes) : '') + (c.examesSolicitados ? '<br>Exames pedidos: ' + esc(c.examesSolicitados) : '') + (c.pendencias ? '<br><strong>Pendências:</strong> ' + esc(c.pendencias) : '') + '</div></div>' +
      '<button class="btn ghost icon" type="button" data-a="editCons" data-id="' + c.id + '" aria-label="Editar consulta">' + icon('editar', 'sm') + '</button></div>';
    return '<div class="card"><div class="card-head"><h2>Próximos retornos</h2><button class="btn sm" type="button" data-a="novaCons">' + icon('plus', 'sm') + 'Consulta</button></div>' + (ag.length ? '<div class="list">' + ag.map(item).join('') + '</div>' : '<p class="empty">Nada agendado.</p>') + '</div>' +
      '<div class="card"><div class="card-head"><h2>Consultas realizadas</h2></div>' + (re.length ? '<div class="list">' + re.map(item).join('') + '</div>' : '<p class="empty">Nenhuma consulta registrada.</p>') + '</div>';
  }

  function historicoHTML(p) {
    const hs = S.list(p, 'historicoSaude').sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descricao.localeCompare(b.descricao, 'pt-BR'));
    return '<div class="card"><div class="card-head"><h2>Histórico de saúde</h2><button class="btn sm" type="button" data-a="novoHist">' + icon('plus', 'sm') + 'Item</button></div>' +
      (hs.length ? '<div class="list">' + hs.map(x => '<div class="row"><div class="grow"><div class="title">' + esc(x.descricao) + ' <span class="badge">' + CAT[x.categoria] + '</span></div><div class="desc">' + (x.data ? L.fmtData(x.data) : '') + (x.observacao ? (x.data ? ' · ' : '') + esc(x.observacao) : '') + '</div></div>' +
        '<button class="btn ghost icon" type="button" data-a="editHist" data-id="' + x.id + '" aria-label="Editar">' + icon('editar', 'sm') + '</button></div>').join('') + '</div>' : '<p class="empty">Nada registrado. Inclua apenas alergias e intolerâncias confirmadas.</p>') + '</div>';
  }

  UI.route('saude', {
    titulo: 'Saúde',
    render() {
      const p = UI.state.perfil;
      const corpo = { suplementos: supsHTML, exames: examesHTML, consultas: consultasHTML, historico: historicoHTML }[aba](p);
      return '<div class="page-head"><div><h1>Saúde</h1><div class="sub">' + esc(UI.nomePerfil()) + '</div></div></div>' +
        UI.tabs([['suplementos', 'Suplementos e medicamentos'], ['exames', 'Exames'], ['consultas', 'Consultas'], ['historico', 'Histórico']], aba, 'aba') + corpo;
    },
    acoes: {
      aba(ds) { aba = ds.v; UI.render(true); },
      novoSup() { editarSup(null); }, editSup(ds) { editarSup(S.get(ds.id)); },
      novoMed() { editarMed(null); }, editMed(ds) { editarMed(S.get(ds.id)); },
      novoExame() { editarExame(null); }, editExame(ds) { editarExame(S.get(ds.id)); },
      novaCons() { editarCons(null); }, editCons(ds) { editarCons(S.get(ds.id)); },
      novoHist() { editarHist(null); }, editHist(ds) { editarHist(S.get(ds.id)); }
    }
  });

  const salvarComo = (orig, base, v) => S.put(Object.assign(orig ? JSON.parse(JSON.stringify(orig)) : base, v));
  function checarDias(v) { if (v.frequencia === 'semanal' && v.diasSemana.length !== 1 && v.diasSemana.length) throw new Error('Para frequência semanal, escolha um único dia (ou nenhum, se ainda não souber).'); if (v.frequencia === 'diario' && !v.diasSemana.length) v.diasSemana = [0, 1, 2, 3, 4, 5, 6]; if (v.frequencia === 'condicional') v.diasSemana = []; }

  function editarSup(x) {
    UI.form({ titulo: x ? 'Editar suplemento' : 'Novo suplemento', duasColunas: true,
      campos: [{ k: 'nome', label: 'Nome', req: true, span2: true }, { k: 'dose', label: 'Dose', tipo: 'number', min: 0 }, { k: 'unidade', label: 'Unidade', lista: ['g', 'mg', 'UI', 'cápsula', 'gota', 'dose'] },
        { k: 'frequencia', label: 'Frequência', tipo: 'select', req: true, opcoes: [['diario', 'Diário'], ['semanal', 'Semanal'], ['condicional', 'Quando necessário']] }, { k: 'horario', label: 'Horário', tipo: 'time' },
        { k: 'diasSemana', label: 'Dias', tipo: 'dias', span2: true }, { k: 'ativo', label: 'Em uso (aparece em Hoje)', tipo: 'checkbox' }, { k: 'fonte', label: 'Origem', tipo: 'select', req: true, opcoes: FONTES },
        { k: 'observacao', label: 'Observação', span2: true }],
      valores: x || { frequencia: 'diario', diasSemana: [0, 1, 2, 3, 4, 5, 6], ativo: true, fonte: 'usuario' },
      onSalvar: v => { checarDias(v); return salvarComo(x, { tipo: 'suplemento', perfil: UI.state.perfil }, v); },
      onExcluir: x ? () => S.remove(x.id) : null });
  }
  function editarMed(x) {
    UI.form({ titulo: x ? 'Editar medicamento' : 'Novo medicamento', duasColunas: true,
      campos: [{ k: 'nota', tipo: 'nota', html: '<p class="muted small">Registre exatamente o que foi prescrito. O app não sugere doses.</p>' }, { k: 'nome', label: 'Nome', req: true, span2: true }, { k: 'dose', label: 'Dose (como prescrita)' },
        { k: 'frequencia', label: 'Frequência', tipo: 'select', req: true, opcoes: [['diario', 'Diário'], ['semanal', 'Semanal'], ['outro', 'Outro']] }, { k: 'diasSemana', label: 'Dia(s) da aplicação ou uso', tipo: 'dias', span2: true },
        { k: 'horario', label: 'Horário', tipo: 'time' }, { k: 'prescritoPor', label: 'Prescrito por' }, { k: 'ativo', label: 'Em uso', tipo: 'checkbox' }, { k: 'observacao', label: 'Observação', span2: true }],
      valores: x || { frequencia: 'diario', diasSemana: [], ativo: true },
      onSalvar: v => { delete v.nota; checarDias(v); return salvarComo(x, { tipo: 'medicamento', perfil: UI.state.perfil, fonte: 'usuario' }, v); },
      onExcluir: x ? () => S.remove(x.id) : null });
  }
  function editarExame(x) {
    const nomes = [...new Set(S.list(UI.state.perfil, 'exame').map(e => e.nome))];
    UI.form({ titulo: x ? 'Editar resultado' : 'Novo resultado de exame', duasColunas: true,
      campos: [{ k: 'nome', label: 'Exame', req: true, lista: nomes, span2: true }, { k: 'data', label: 'Data da coleta', tipo: 'date' }, { k: 'laboratorio', label: 'Laboratório' },
        { k: 'resultado', label: 'Resultado (número)', tipo: 'number' }, { k: 'unidade', label: 'Unidade', ph: 'Ex.: ng/dL' }, { k: 'resultadoTexto', label: 'Resultado em texto', span2: true, help: 'Para resultados não numéricos (ex.: "não reagente").' },
        { k: 'refMin', label: 'Referência mínima', tipo: 'number' }, { k: 'refMax', label: 'Referência máxima', tipo: 'number' }, { k: 'refTexto', label: 'Referência (texto do laudo)', span2: true },
        { k: 'observacao', label: 'Anotações', tipo: 'textarea', span2: true }],
      valores: x || {},
      onSalvar: v => {
        if (v.resultado === null && !v.resultadoTexto) throw new Error('Informe o resultado (número ou texto).');
        if (v.refMin !== null && v.refMax !== null && v.refMin > v.refMax) throw new Error('A referência mínima é maior que a máxima.');
        if (v.data && v.data > L.hoje()) throw new Error('A data não pode ser no futuro.');
        return salvarComo(x, { tipo: 'exame', perfil: UI.state.perfil, fonte: 'usuario' }, v);
      },
      onExcluir: x ? () => S.remove(x.id) : null });
  }
  function editarCons(x) {
    UI.form({ titulo: x ? 'Editar consulta' : 'Nova consulta', duasColunas: true,
      campos: [{ k: 'status', label: 'Situação', tipo: 'select', req: true, opcoes: [['agendada', 'Agendada'], ['realizada', 'Realizada']] }, { k: 'data', label: 'Data', tipo: 'date' }, { k: 'hora', label: 'Hora', tipo: 'time' },
        { k: 'especialidade', label: 'Especialidade', lista: ['Clínico geral', 'Endocrinologia', 'Nutrição', 'Fisioterapia', 'Cardiologia', 'Ginecologia', 'Urologia'] }, { k: 'profissional', label: 'Profissional', span2: true },
        { k: 'orientacoes', label: 'Orientações recebidas', tipo: 'textarea', span2: true }, { k: 'examesSolicitados', label: 'Exames solicitados', span2: true }, { k: 'pendencias', label: 'Pendências', span2: true }, { k: 'observacao', label: 'Observação', span2: true }],
      valores: x || { status: 'agendada' },
      onSalvar: v => salvarComo(x, { tipo: 'consulta', perfil: UI.state.perfil, fonte: 'usuario' }, v),
      onExcluir: x ? () => S.remove(x.id) : null });
  }
  function editarHist(x) {
    UI.form({ titulo: x ? 'Editar item' : 'Novo item do histórico',
      campos: [{ k: 'categoria', label: 'Categoria', tipo: 'select', req: true, opcoes: Object.entries(CAT) }, { k: 'descricao', label: 'Descrição', req: true }, { k: 'data', label: 'Data (se souber)', tipo: 'date' }, { k: 'observacao', label: 'Observação', tipo: 'textarea' }],
      valores: x || { categoria: 'condicao' },
      onSalvar: v => salvarComo(x, { tipo: 'historicoSaude', perfil: UI.state.perfil, fonte: 'usuario' }, v),
      onExcluir: x ? () => S.remove(x.id) : null });
  }
})(window.HJ);
