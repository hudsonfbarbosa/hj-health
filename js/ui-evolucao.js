/* H&J Health — tela EVOLUÇÃO: medições, bioimpedância e tendências */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  let metrica = 'peso', periodo = 90;

  // Margens abaixo das quais a variação não deve ser lida como mudança real.
  const METRICAS = {
    peso: { t: 'Peso', u: 'kg', campo: 'peso', margem: 0.5, dec: 1 },
    cintura: { t: 'Cintura', u: 'cm', campo: 'cintura', margem: 1, dec: 1 },
    gorduraPct: { t: 'Gordura', u: '%', campo: 'gorduraPct', margem: 1, dec: 1, bio: true },
    musculoEsqKg: { t: 'Músculo esquelético', u: 'kg', campo: 'musculoEsqKg', margem: 0.5, dec: 1, bio: true },
    visceral: { t: 'Gordura visceral', u: 'nível', campo: 'visceral', margem: 1, dec: 0, bio: true },
    agua: { t: 'Água por dia', u: 'ml', diario: true, dec: 0 },
    sono: { t: 'Sono', u: 'h', diario: true, dec: 1 },
    adesao: { t: 'Adesão do dia', u: '%', diario: true, dec: 0 }
  };

  function editarMedicao(m) {
    const equip = [...new Set(S.list(UI.state.perfil, 'medicao').map(x => x.equipamento).filter(Boolean))];
    UI.form({ titulo: m ? 'Editar medição' : 'Nova medição', duasColunas: true,
      campos: [{ k: 'data', label: 'Data', tipo: 'date', req: true }, { k: 'hora', label: 'Hora', tipo: 'time' },
        { k: 'peso', label: 'Peso (kg)', tipo: 'number', min: 20, max: 300 }, { k: 'cintura', label: 'Cintura (cm)', tipo: 'number', min: 30, max: 250, help: 'Na altura do umbigo.' },
        { k: 'nota', tipo: 'nota', html: '<h3 style="margin-top:6px">Bioimpedância (opcional)</h3>' },
        { k: 'gorduraPct', label: 'Gordura (%)', tipo: 'number', min: 1, max: 70 }, { k: 'gorduraKg', label: 'Gordura (kg)', tipo: 'number', min: 0, max: 200 },
        { k: 'musculoEsqKg', label: 'Músculo esquelético (kg)', tipo: 'number', min: 0, max: 150 }, { k: 'massaMagraKg', label: 'Massa livre de gordura (kg)', tipo: 'number', min: 0, max: 200 },
        { k: 'aguaKg', label: 'Água corporal (kg)', tipo: 'number', min: 0, max: 150 }, { k: 'visceral', label: 'Gordura visceral (nível)', tipo: 'number', min: 0, max: 60 },
        { k: 'tmb', label: 'Taxa metabólica basal (kcal)', tipo: 'number', min: 500, max: 5000 }, { k: 'equipamento', label: 'Equipamento', lista: equip, ph: 'Ex.: Relaxmedic' },
        { k: 'condicoes', label: 'Condições', span2: true, lista: ['Em jejum, após ir ao banheiro, sem treino antes', 'Após refeição', 'Após treino'], help: 'Para comparar, repita sempre as mesmas condições e horário.' },
        { k: 'observacao', label: 'Observação', span2: true }],
      valores: m || { data: L.hoje(), hora: L.horaAgora() },
      onSalvar: v => {
        if (v.data > L.hoje()) throw new Error('A data não pode ser no futuro.');
        if (['peso', 'cintura', 'gorduraPct', 'gorduraKg', 'musculoEsqKg', 'massaMagraKg', 'aguaKg', 'visceral', 'tmb'].every(k => v[k] === null)) throw new Error('Informe ao menos uma medida.');
        delete v.nota;
        return S.put(Object.assign(m ? JSON.parse(JSON.stringify(m)) : { tipo: 'medicao', perfil: UI.state.perfil }, v));
      },
      onExcluir: m ? () => S.remove(m.id) : null });
  }

  function serie(p, chave, ini, fim) {
    const M = METRICAS[chave];
    if (!M.diario) return S.list(p, 'medicao', m => m[M.campo] !== null && m.data >= ini && m.data <= fim).map(m => ({ x: m.data, y: m[M.campo], m }));
    const out = [];
    L.intervalo(ini, fim).forEach(d => {
      if (chave === 'agua') { const t = L.aguaTotal(p, d); if (t > 0) out.push({ x: d, y: t }); }
      if (chave === 'sono') { const s = L.sonoDoDia(p, d); const min = s && L.duracaoSono(s.deitar, s.acordar); if (min) out.push({ x: d, y: min / 60 }); }
      if (chave === 'adesao') { if (L.temRegistro(p, d)) { const pr = L.progressoDia(p, d); if (pr) out.push({ x: d, y: Math.round(pr.pct * 100) }); } }
    });
    return out;
  }

  function analise(p, chave, pts) {
    const M = METRICAS[chave];
    if (M.diario) {
      if (!pts.length) return '';
      const media = pts.reduce((s, x) => s + x.y, 0) / pts.length;
      return '<p class="muted small">' + pts.length + ' dia(s) com registro. Média desses dias: ' + L.fmtNum(media, M.dec) + ' ' + M.u + '. Dias sem registro ficam em branco, não contam como zero.</p>';
    }
    if (!pts.length) return '';
    const ord = pts.slice().sort((a, b) => (a.x < b.x ? -1 : 1));
    let h = '<p class="muted small">' + ord.length + ' medição(ões).';
    if (ord.length >= 2) {
      const dif = ord[ord.length - 1].y - ord[0].y;
      h += ' Variação de ' + L.fmtData(ord[0].x) + ' a ' + L.fmtData(ord[ord.length - 1].x) + ': <strong>' + (dif > 0 ? '+' : '') + L.fmtNum(dif, M.dec) + ' ' + M.u + '</strong>.';
      if (Math.abs(dif) < M.margem) h += ' Está dentro da margem de variação normal da medida; não indica mudança real.';
      if (ord.length < 3) h += ' Com menos de 3 medições, trate como tendência inicial.';
    }
    h += '</p>';
    const equips = [...new Set(ord.map(x => x.m.equipamento || 'não informado'))];
    if (M.bio && equips.length > 1) h += '<div class="callout amber" style="margin-top:8px">' + icon('alerta') + '<div>Medições de equipamentos diferentes (' + esc(equips.join(', ')) + '). Bioimpedâncias de aparelhos diferentes não são diretamente comparáveis.</div></div>';
    const horas = ord.map(x => x.m.hora).filter(Boolean);
    if (M.bio && horas.length > 1) {
      const mins = horas.map(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
      if (Math.max(...mins) - Math.min(...mins) > 120) h += '<div class="callout amber" style="margin-top:8px">' + icon('alerta') + '<div>Medições em horários muito diferentes. Hidratação e refeições mudam o resultado da bioimpedância; repita no mesmo horário.</div></div>';
    }
    return h;
  }

  UI.route('evolucao', {
    titulo: 'Evolução',
    render() {
      const p = UI.state.perfil;
      const meds = S.list(p, 'medicao').sort((a, b) => (a.data + (a.hora || '') < b.data + (b.hora || '') ? 1 : -1));
      const fim = L.hoje();
      let ini;
      if (periodo === 'tudo') {
        const datas = S.list(p, null, r => r.data && /^(medicao|registro|sessao)/.test(r.tipo)).map(r => r.data).sort();
        ini = datas[0] && datas[0] < fim ? datas[0] : L.addDias(fim, -30);
      } else ini = L.addDias(fim, -(periodo - 1));
      const M = METRICAS[metrica];
      let pts = serie(p, metrica, ini, fim);
      // Medições esparsas: o eixo começa na primeira medição (mínimo de 14 dias), para não espremer os pontos.
      if (!M.diario && pts.length) {
        const prim = pts.map(x => x.x).sort()[0];
        const lim = L.addDias(fim, -14);
        if (prim > ini) ini = prim < lim ? prim : lim;
      }
      let metaV = null;
      if (metrica === 'agua') { const m = L.meta(p, 'agua', 'todos') || L.meta(p, 'agua', 'treino'); metaV = m ? m.valor : null; }
      if (metrica === 'sono') { const m = L.meta(p, 'sono', 'todos'); metaV = m ? m.valor : null; }
      let h = '<div class="page-head"><div><h1>Evolução</h1><div class="sub">' + esc(UI.nomePerfil()) + '</div></div><button class="btn sm primary" type="button" data-a="nova">' + icon('plus', 'sm') + 'Nova medição</button></div>';
      h += '<div class="card"><div class="card-head"><h2>Tendência</h2></div>' + UI.tabs(Object.entries(METRICAS).map(([k, v]) => [k, v.t]), metrica, 'metrica') +
        '<div style="margin:10px 0">' + UI.tabs([[30, '30 dias'], [90, '90 dias'], [180, '6 meses'], [365, '1 ano'], ['tudo', 'Tudo']], periodo, 'periodo') + '</div>' +
        UI.grafico({ pontos: pts.map(x => ({ x: x.x, y: x.y })), ini, fim, tipo: M.diario && metrica !== 'sono' ? 'barras' : 'linha', meta: metaV, unidade: M.u, dec: M.dec, titulo: M.t + ' de ' + L.fmtData(ini) + ' a ' + L.fmtData(fim) }) +
        '<p class="muted tiny" style="margin:6px 0">' + M.t + ' (' + M.u + ') · ' + L.fmtData(ini) + ' a ' + L.fmtData(fim) + (metaV ? ' · linha tracejada = meta' : '') + ' · origem: ' + (M.diario ? 'seus registros diários' : 'suas medições') + '</p>' +
        analise(p, metrica, pts) + '</div>';
      h += '<div class="card"><div class="card-head"><h2>Histórico de medições</h2><span class="meta">' + meds.length + '</span></div>' +
        (meds.length ? '<div class="table-wrap"><table><thead><tr><th>Data</th><th class="n">Peso</th><th class="n">Cintura</th><th class="n">Gordura</th><th class="n">Músculo esq.</th><th class="n">Visceral</th><th>Equipamento</th><th><span class="sr-only">Editar</span></th></tr></thead><tbody>' +
          meds.map(m => '<tr><td>' + L.fmtData(m.data) + (m.hora ? '<br><span class="muted tiny">' + m.hora + '</span>' : '') + '</td><td class="n">' + (m.peso !== null ? L.fmtNum(m.peso) + ' kg' : '—') + '</td><td class="n">' + (m.cintura !== null ? L.fmtNum(m.cintura) + ' cm' : '—') + '</td>' +
            '<td class="n">' + (m.gorduraPct !== null ? L.fmtNum(m.gorduraPct) + '%' : '—') + '</td><td class="n">' + (m.musculoEsqKg !== null ? L.fmtNum(m.musculoEsqKg) + ' kg' : '—') + '</td><td class="n">' + (m.visceral !== null ? L.fmtNum(m.visceral, 0) : '—') + '</td>' +
            '<td>' + esc(m.equipamento || '—') + (m.condicoes ? '<br><span class="muted tiny">' + esc(m.condicoes) + '</span>' : '') + '</td><td><button class="btn ghost icon" type="button" data-a="editar" data-id="' + m.id + '" aria-label="Editar medição de ' + L.fmtData(m.data) + '">' + icon('editar', 'sm') + '</button></td></tr>').join('') + '</tbody></table></div>'
          : '<p class="empty">Nenhuma medição registrada.</p>') +
        '<p class="muted tiny" style="margin-top:8px">Para bioimpedância: mesmo aparelho, mesmo horário, em jejum, sem treino antes. Prefira a tendência de várias medições a uma leitura isolada. Para gordura abdominal, a fita na cintura costuma ser mais confiável.</p></div>';
      return h;
    },
    acoes: {
      nova() { editarMedicao(null); },
      editar(ds) { editarMedicao(S.get(ds.id)); },
      metrica(ds) { metrica = ds.v; UI.render(true); },
      periodo(ds) { periodo = ds.v === 'tudo' ? 'tudo' : Number(ds.v); UI.render(true); }
    }
  });
})(window.HJ);
