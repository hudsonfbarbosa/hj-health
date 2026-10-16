/* H&J Health — RELATÓRIOS por período: tela, impressão A4, CSV e JSON */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  let ini = null, fim = null;
  const TREINO = { feito: 'Feito', nao_feito: 'Não feito', descanso: 'Descanso' };

  function diasResumo(p) { return L.intervalo(ini, fim).map(d => L.resumoDia(p, d)); }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');

  UI.route('relatorios', {
    titulo: 'Relatórios', largo: true,
    render() {
      const p = UI.state.perfil;
      if (!ini) { fim = L.hoje(); ini = L.addDias(fim, -29); }
      const dias = diasResumo(p);
      const com = dias.filter(d => !d.semRegistro);
      const meds = S.list(p, 'medicao', m => m.data >= ini && m.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1));
      const ses = S.list(p, 'sessaoTreino', s => s.data >= ini && s.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1));
      const exs = S.list(p, 'exame', e => e.data && e.data >= ini && e.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1));
      const fechs = S.list(p, 'fechamentoSemanal', f => f.semanaInicio >= L.inicioSemana(ini) && f.semanaInicio <= fim).sort((a, b) => (a.semanaInicio < b.semanaInicio ? -1 : 1));
      const soma = f => com.reduce((s, x) => s + f(x), 0);
      const sonos = com.filter(x => x.sonoMin);
      let h = '<div class="page-head no-print"><div><h1>Relatórios</h1><div class="sub">' + esc(UI.nomePerfil()) + '</div></div></div>' +
        '<form class="card no-print" data-a="periodo"><div class="form-grid two"><div class="field"><label for="r-ini">De</label><input id="r-ini" type="date" value="' + ini + '" max="' + L.hoje() + '" required></div>' +
        '<div class="field"><label for="r-fim">Até</label><input id="r-fim" type="date" value="' + fim + '" max="' + L.hoje() + '" required></div></div>' +
        '<div class="btns" style="margin-top:12px"><button class="btn primary" type="submit">Atualizar</button><button class="btn" type="button" data-a="imprimir">' + icon('imprimir', 'sm') + 'Imprimir (A4)</button>' +
        '<button class="btn" type="button" data-a="csvDia">' + icon('baixar', 'sm') + 'CSV diário</button><button class="btn" type="button" data-a="csvMed">' + icon('baixar', 'sm') + 'CSV medições</button>' +
        '<button class="btn" type="button" data-a="csvTreino">' + icon('baixar', 'sm') + 'CSV treinos</button><button class="btn" type="button" data-a="json">' + icon('baixar', 'sm') + 'JSON do período</button></div></form>';

      h += '<div class="card"><h2>Relatório de ' + esc(UI.nomePerfil()) + '</h2><p class="muted small">Período: ' + L.fmtData(ini) + ' a ' + L.fmtData(fim) + ' (' + dias.length + ' dias) · gerado em ' + new Date().toLocaleString('pt-BR') + '</p>' +
        '<p class="muted small">Dias sem registro aparecem como "sem registro" e não entram nas médias. Nenhum valor ausente é preenchido.</p>' +
        '<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:12px">' +
        [['Dias com registro', com.length + ' de ' + dias.length], ['Refeições do plano', pct(soma(x => x.refeicoes.feitas), soma(x => x.refeicoes.planejadas))],
          ['Água: dias com meta', pct(com.filter(x => x.agua.meta && x.agua.ml >= x.agua.meta).length, com.filter(x => x.agua.meta).length)],
          ['Suplementos', pct(soma(x => x.suplementos.tomados), soma(x => x.suplementos.devidos))],
          ['Treinos feitos', String(com.filter(x => x.treino.status === 'feito').length)],
          ['Sono médio', sonos.length ? L.fmtDuracao(sonos.reduce((s, x) => s + x.sonoMin, 0) / sonos.length) + ' (' + sonos.length + ' noites)' : '—']]
          .map(([t, v]) => '<div class="card flat" style="padding:10px"><div class="muted tiny">' + t + '</div><div style="font-weight:700" class="num">' + v + '</div></div>').join('') + '</div></div>';

      h += '<div class="card"><h2 style="margin-bottom:10px">Dia a dia</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th class="n">Refeições</th><th class="n">Água</th><th class="n">Suplementos</th><th>Treino</th><th class="n">Sono</th><th class="n">Progresso</th></tr></thead><tbody>' +
        dias.slice().reverse().map(x => x.semRegistro ? '<tr><td>' + L.fmtData(x.data) + '</td><td colspan="6"><span class="absent">Sem registro</span></td></tr>' :
          '<tr><td>' + L.fmtData(x.data) + '</td><td class="n">' + (x.refeicoes.planejadas ? x.refeicoes.feitas + '/' + x.refeicoes.planejadas : '—') + '</td><td class="n">' + (x.agua.ml ? L.fmtNum(x.agua.ml, 0) + ' ml' : '—') + '</td>' +
          '<td class="n">' + (x.suplementos.devidos ? x.suplementos.tomados + '/' + x.suplementos.devidos : '—') + '</td><td>' + (TREINO[x.treino.status] || (x.treino.planejado ? '<span class="absent">Sem registro</span>' : '—')) + '</td>' +
          '<td class="n">' + (x.sonoMin ? L.fmtDuracao(x.sonoMin) : '—') + '</td><td class="n">' + (x.progresso !== null ? Math.round(x.progresso * 100) + '%' : '—') + '</td></tr>').join('') + '</tbody></table></div></div>';

      h += '<div class="card"><h2 style="margin-bottom:10px">Medições no período</h2>' + (meds.length ? '<div class="table-wrap"><table><thead><tr><th>Data</th><th class="n">Peso</th><th class="n">Cintura</th><th class="n">Gordura</th><th class="n">Músculo esq.</th><th>Equipamento</th></tr></thead><tbody>' +
        meds.map(m => '<tr><td>' + L.fmtData(m.data) + '</td><td class="n">' + (m.peso !== null ? L.fmtNum(m.peso) + ' kg' : '—') + '</td><td class="n">' + (m.cintura !== null ? L.fmtNum(m.cintura) + ' cm' : '—') + '</td><td class="n">' + (m.gorduraPct !== null ? L.fmtNum(m.gorduraPct) + '%' : '—') + '</td><td class="n">' + (m.musculoEsqKg !== null ? L.fmtNum(m.musculoEsqKg) + ' kg' : '—') + '</td><td>' + esc(m.equipamento || '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="empty">Sem medições.</p>') + '</div>';

      h += '<div class="card"><h2 style="margin-bottom:10px">Sessões de treino</h2>' + (ses.length ? '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Treino</th><th class="n">Duração</th><th class="n">Esforço</th><th>Detalhes</th></tr></thead><tbody>' +
        ses.map(s => { const r = L.ritmoSegKm(s.distanciaKm, s.duracaoSeg); return '<tr><td>' + L.fmtData(s.data) + '</td><td>' + esc(s.nome || s.modalidade) + '</td><td class="n">' + (s.duracaoMin ? L.fmtNum(s.duracaoMin, 0) + ' min' : '—') + '</td><td class="n">' + (s.esforco ? s.esforco + '/10' : '—') + '</td><td>' +
          (s.exercicios.length ? s.exercicios.map(e => esc(e.nome) + ' (' + e.series.length + ' séries)').join(', ') : '') + (s.distanciaKm ? L.fmtNum(s.distanciaKm, 2) + ' km' + (s.duracaoSeg ? ' em ' + L.fmtSeg(s.duracaoSeg) : '') + (r ? ' · ' + L.fmtSeg(r) + '/km' : '') : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">Sem sessões detalhadas.</p>') + '</div>';

      if (exs.length) h += '<div class="card"><h2 style="margin-bottom:10px">Exames no período</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Exame</th><th>Resultado</th><th>Referência informada</th></tr></thead><tbody>' +
        exs.map(e => '<tr><td>' + L.fmtData(e.data) + '</td><td>' + esc(e.nome) + '</td><td>' + (e.resultado !== null ? L.fmtNum(e.resultado, 2) + ' ' + esc(e.unidade || '') : esc(e.resultadoTexto || '—')) + '</td><td>' + (e.refMin !== null || e.refMax !== null ? (e.refMin !== null ? L.fmtNum(e.refMin, 2) : '') + ' a ' + (e.refMax !== null ? L.fmtNum(e.refMax, 2) : '') : esc(e.refTexto || '—')) + '</td></tr>').join('') + '</tbody></table></div></div>';
      if (fechs.length) h += '<div class="card"><h2 style="margin-bottom:10px">Fechamentos semanais</h2><div class="list">' + fechs.map(f => '<div class="row"><div class="grow"><div class="title">Semana de ' + L.fmtData(f.semanaInicio) + '</div><div class="desc">' + (f.destaque ? 'Destaque: ' + esc(f.destaque) + '<br>' : '') + (f.atencao ? 'Atenção: ' + esc(f.atencao) + '<br>' : '') + (f.intencao ? 'Intenção: ' + esc(f.intencao) : '') + '</div></div></div>').join('') + '</div></div>';
      return h;
    },
    acoes: {
      periodo(ds, f) {
        const a = f.querySelector('#r-ini').value, b = f.querySelector('#r-fim').value;
        if (!HJ.schema.validDate(a) || !HJ.schema.validDate(b) || a > b) { UI.toast('Período inválido: a data inicial deve ser anterior à final.', { erro: true }); return; }
        if (L.diasEntre(a, b) > 731) { UI.toast('Escolha um período de até 2 anos.', { erro: true }); return; }
        ini = a; fim = b; UI.render(true);
      },
      imprimir() { window.print(); },
      csvDia() {
        const p = UI.state.perfil;
        const linhas = diasResumo(p).map(x => ({ data: x.data, registro: x.semRegistro ? 'sem registro' : 'registrado', refFeitas: x.semRegistro ? null : x.refeicoes.feitas, refPlan: x.refeicoes.planejadas || null, agua: x.semRegistro ? null : x.agua.ml, aguaMeta: x.agua.meta, supT: x.semRegistro ? null : x.suplementos.tomados, supD: x.suplementos.devidos || null, treinoPlan: x.treino.planejado, treino: x.treino.status ? TREINO[x.treino.status] : null, sono: x.sonoMin, sonoQ: x.sonoQualidade, prog: x.progresso === null ? null : Math.round(x.progresso * 100) }));
        baixarCSV('diario', [{ chave: 'data', titulo: 'Data' }, { chave: 'registro', titulo: 'Situação' }, { chave: 'refFeitas', titulo: 'Refeições feitas' }, { chave: 'refPlan', titulo: 'Refeições planejadas' }, { chave: 'agua', titulo: 'Água (ml)' }, { chave: 'aguaMeta', titulo: 'Meta de água (ml)' }, { chave: 'supT', titulo: 'Suplementos tomados' }, { chave: 'supD', titulo: 'Suplementos previstos' }, { chave: 'treinoPlan', titulo: 'Treino planejado' }, { chave: 'treino', titulo: 'Treino' }, { chave: 'sono', titulo: 'Sono (min)' }, { chave: 'sonoQ', titulo: 'Qualidade do sono' }, { chave: 'prog', titulo: 'Progresso (%)' }], linhas);
      },
      csvMed() {
        const p = UI.state.perfil;
        const ms = S.list(p, 'medicao', m => m.data >= ini && m.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1));
        baixarCSV('medicoes', ['data', 'hora', 'peso', 'cintura', 'gorduraPct', 'gorduraKg', 'musculoEsqKg', 'massaMagraKg', 'aguaKg', 'visceral', 'tmb', 'equipamento', 'condicoes', 'observacao'].map(k => ({ chave: k, titulo: k })), ms);
      },
      csvTreino() {
        const p = UI.state.perfil;
        const linhas = [];
        S.list(p, 'sessaoTreino', s => s.data >= ini && s.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1)).forEach(s => {
          const base = { data: s.data, nome: s.nome, modalidade: s.modalidade, duracaoMin: s.duracaoMin, esforco: s.esforco, distanciaKm: s.distanciaKm, duracaoSeg: s.duracaoSeg, fc: s.fcMedia };
          if (!s.exercicios.length) linhas.push(base);
          s.exercicios.forEach(e => e.series.forEach((sr, i) => linhas.push(Object.assign({}, base, { exercicio: e.nome, serie: i + 1, reps: sr.reps, carga: sr.carga }))));
        });
        baixarCSV('treinos', ['data', 'nome', 'modalidade', 'duracaoMin', 'esforco', 'exercicio', 'serie', 'reps', 'carga', 'distanciaKm', 'duracaoSeg', 'fc'].map(k => ({ chave: k, titulo: k })), linhas);
      },
      json() {
        const p = UI.state.perfil;
        const regs = S.dump([p]).filter(r => (r.data && r.data >= ini && r.data <= fim) || (r.semanaInicio && r.semanaInicio >= ini && r.semanaInicio <= fim));
        const obj = { app: 'hj-health', tipoArquivo: 'relatorio', schemaVersion: HJ.schema.SCHEMA_VERSION, perfil: p, periodo: { inicio: ini, fim }, geradoEm: new Date().toISOString(), observacao: 'Relatório (não é backup). Contém apenas registros datados do período.', registros: regs };
        HJ.IO.entregarArquivo('hj-relatorio-' + p + '-' + ini + '_' + fim + '.json', JSON.stringify(obj, null, 2), 'application/json');
      }
    }
  });

  function baixarCSV(nome, cols, linhas) {
    const p = UI.state.perfil;
    HJ.IO.entregarArquivo('hj-' + nome + '-' + p + '-' + ini + '_' + fim + '.csv', L.toCSV(cols, linhas), 'text/csv;charset=utf-8');
  }
})(window.HJ);
