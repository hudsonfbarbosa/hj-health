/* H&J Health — FECHAMENTO DA SEMANA (ritual de 2 minutos) */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;

  function semanaPadrao() {
    const h = L.hoje(), ds = L.diaSemana(h);
    return ds === 1 ? L.inicioSemana(L.addDias(h, -1)) : L.inicioSemana(h);
  }
  const pctTxt = v => (v === null ? '—' : v + '%');
  function bloco(titulo, valor, detalhe) {
    return '<div class="card flat" style="padding:12px"><div class="muted small">' + titulo + '</div><div style="font-size:1.4rem;font-weight:700" class="num">' + valor + '</div>' + (detalhe ? '<div class="muted tiny">' + detalhe + '</div>' : '') + '</div>';
  }

  UI.route('semana', {
    titulo: 'Semana',
    render(params) {
      const p = UI.state.perfil;
      const ini = params.ini && HJ.schema.validDate(params.ini) ? L.inicioSemana(params.ini) : semanaPadrao();
      const fim = L.addDias(ini, 6);
      const r = L.resumoSemana(p, ini);
      const fech = S.find(p, 'fechamentoSemanal', f => f.semanaInicio === ini);
      const anterior = S.find(p, 'fechamentoSemanal', f => f.semanaInicio === L.addDias(ini, -7));
      const futura = ini > L.hoje();
      let h = '<div class="page-head"><div><h1>Fechamento da semana</h1><div class="sub">' + L.fmtData(ini) + ' a ' + L.fmtData(fim) + '</div></div>' +
        '<div class="daynav"><a class="btn icon" href="#semana?ini=' + L.addDias(ini, -7) + '" aria-label="Semana anterior">' + icon('esq') + '</a>' +
        (L.addDias(ini, 7) <= L.hoje() ? '<a class="btn icon" href="#semana?ini=' + L.addDias(ini, 7) + '" aria-label="Próxima semana">' + icon('dir') + '</a>' : '') + '</div></div>';
      if (futura) return h + '<p class="empty">Semana futura.</p>';
      if (anterior && anterior.intencao) h += '<div class="callout info">' + icon('info') + '<div><strong>Sua intenção para esta semana:</strong> ' + esc(anterior.intencao) + '</div></div>';
      h += '<div class="card"><div class="card-head"><h2>Adesão por área</h2><span class="meta">' + r.diasComRegistro + ' de ' + r.dias + ' dias com registro</span></div>' +
        '<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">' +
        bloco('Refeições do plano', pctTxt(r.refeicoes)) +
        bloco('Água', pctTxt(r.agua), 'dias com a meta batida') +
        bloco('Suplementos', pctTxt(r.suplementos)) +
        bloco('Treino', r.treinosPlanejados ? r.treinosFeitos + ' de ' + r.treinosPlanejados : (r.treinosFeitos ? r.treinosFeitos + ' feito(s)' : '—'), r.treinosPlanejados ? 'planejados' : 'sem treino planejado') +
        bloco('Sono médio', r.sonoMedioMin ? L.fmtDuracao(r.sonoMedioMin) : '—', r.noitesSono + ' noite(s) registrada(s)') +
        bloco('Hábitos', pctTxt(r.habitos)) +
        '</div><p class="muted tiny" style="margin-top:10px">Porcentagens consideram só os dias com registro. Dia sem registro aparece como "sem registro", não como falha.</p></div>';

      const dias = L.intervalo(ini, fim).filter(d => d <= L.hoje());
      h += '<div class="card"><div class="card-head"><h2>Dia a dia</h2></div><div class="table-wrap"><table><thead><tr><th>Dia</th><th class="n">Refeições</th><th class="n">Água</th><th>Treino</th><th class="n">Sono</th></tr></thead><tbody>' +
        dias.map(d => {
          const x = L.resumoDia(p, d);
          if (x.semRegistro) return '<tr><td>' + L.DIAS_CURTO[L.diaSemana(d)] + ' ' + L.fmtData(d, 'curto') + '</td><td colspan="4"><span class="absent">Sem registro</span></td></tr>';
          const tr = x.treino.status === 'feito' ? 'Feito' : x.treino.status === 'nao_feito' ? 'Não feito' : x.treino.status === 'descanso' ? 'Descanso' : x.treino.planejado ? '<span class="absent">Sem registro</span>' : '—';
          return '<tr><td>' + L.DIAS_CURTO[L.diaSemana(d)] + ' ' + L.fmtData(d, 'curto') + '</td><td class="n">' + (x.refeicoes.planejadas ? x.refeicoes.feitas + '/' + x.refeicoes.planejadas : '—') + '</td><td class="n">' + (x.agua.ml ? L.fmtNum(x.agua.ml / 1000) + ' L' : '—') + '</td><td>' + tr + '</td><td class="n">' + (x.sonoMin ? L.fmtDuracao(x.sonoMin) : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';

      h += '<form class="card" data-a="salvar" data-ini="' + ini + '"><div class="card-head"><h2>Reflexão</h2>' + (fech ? '<span class="badge ok">' + icon('check', 'sm') + 'Fechada</span>' : '') + '</div><div class="form-grid">' +
        '<div class="field"><label for="w-dest">Um destaque da semana</label><textarea id="w-dest" name="destaque" placeholder="O que funcionou?">' + esc(fech && fech.destaque || '') + '</textarea></div>' +
        '<div class="field"><label for="w-aten">Um ponto de atenção</label><textarea id="w-aten" name="atencao" placeholder="O que mais atrapalhou?">' + esc(fech && fech.atencao || '') + '</textarea></div>' +
        '<div class="field"><label for="w-int">Uma intenção para a próxima semana</label><textarea id="w-int" name="intencao" placeholder="Uma ação só.">' + esc(fech && fech.intencao || '') + '</textarea></div>' +
        '</div><div class="btns end" style="margin-top:12px"><button class="btn primary" type="submit">' + (fech ? 'Atualizar fechamento' : 'Fechar a semana') + '</button></div></form>';

      const hist = S.list(p, 'fechamentoSemanal').filter(f => f.semanaInicio !== ini).sort((a, b) => (a.semanaInicio < b.semanaInicio ? 1 : -1)).slice(0, 8);
      if (hist.length) h += '<div class="card"><div class="card-head"><h2>Fechamentos anteriores</h2></div><div class="list">' + hist.map(f => '<a class="row" href="#semana?ini=' + f.semanaInicio + '" style="color:inherit;text-decoration:none"><div class="grow"><div class="title">Semana de ' + L.fmtData(f.semanaInicio) + '</div><div class="desc">' + esc(f.intencao ? 'Intenção: ' + f.intencao : 'Sem intenção registrada') + '</div></div>' + icon('dir', 'sm') + '</a>').join('') + '</div></div>';
      return h;
    },
    acoes: {
      salvar(ds, f) {
        const p = UI.state.perfil, ini = ds.ini;
        const v = k => f[k].value.trim().slice(0, 1000) || null;
        const ex = S.find(p, 'fechamentoSemanal', x => x.semanaInicio === ini);
        UI.agir(async () => {
          await S.put(Object.assign(ex ? JSON.parse(JSON.stringify(ex)) : { tipo: 'fechamentoSemanal', perfil: p, semanaInicio: ini }, { resumo: L.resumoSemana(p, ini), destaque: v('destaque'), atencao: v('atencao'), intencao: v('intencao') }));
          UI.toast('Semana fechada. Bom trabalho em aparecer.');
        });
      }
    }
  });
})(window.HJ);
