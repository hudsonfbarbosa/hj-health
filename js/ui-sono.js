/* H&J Health — tela SONO E HÁBITOS */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;

  function editarSono(s) {
    const c = L.config(UI.state.perfil) || {};
    UI.form({ titulo: s ? 'Editar sono' : 'Registrar sono', duasColunas: true,
      campos: [{ k: 'data', label: 'Dia em que acordou', tipo: 'date', req: true, span2: true }, { k: 'deitar', label: 'Deitou', tipo: 'time', req: true }, { k: 'acordar', label: 'Acordou', tipo: 'time', req: true },
        { k: 'qualidade', label: 'Qualidade (1–5)', tipo: 'select', numerico: true, opcoes: [[1, '1 · ruim'], [2, '2'], [3, '3'], [4, '4'], [5, '5 · ótima']] }, { k: 'observacao', label: 'Observação' }],
      valores: s || { data: L.hoje(), deitar: c.horarioDormir || '', acordar: c.horarioAcordar || '' },
      onSalvar: v => {
        if (v.data > L.hoje()) throw new Error('A data não pode ser no futuro.');
        if (!L.duracaoSono(v.deitar, v.acordar)) throw new Error('Deitar e acordar não podem ser o mesmo horário.');
        const dup = S.find(UI.state.perfil, 'registroSono', r => r.data === v.data && (!s || r.id !== s.id));
        if (dup) throw new Error('Já existe registro de sono para este dia. Edite o existente.');
        return S.put(Object.assign(s ? JSON.parse(JSON.stringify(s)) : { tipo: 'registroSono', perfil: UI.state.perfil }, v));
      },
      onExcluir: s ? () => S.remove(s.id) : null });
  }

  function editarHabito(h) {
    UI.form({ titulo: h ? 'Editar hábito' : 'Novo hábito',
      campos: [{ k: 'nome', label: 'Hábito', req: true, ph: 'Ex.: Caminhada de 30 min' }, { k: 'diasSemana', label: 'Dias em que vale', tipo: 'dias' },
        { k: 'metaSemanal', label: 'Meta por semana (vezes)', tipo: 'number', req: true, min: 1, max: 7, inteiro: true, help: 'Use menos que o número de dias para ter folga. Ex.: 7 dias e meta 6 = 1 dia de folga.' },
        { k: 'pausado', label: 'Pausado', tipo: 'checkbox', help: 'Pausado não aparece em Hoje e não quebra a sequência.' }, { k: 'observacao', label: 'Observação' }],
      valores: h || { diasSemana: [0, 1, 2, 3, 4, 5, 6], metaSemanal: 6, pausado: false },
      onSalvar: v => {
        if (!v.diasSemana.length) throw new Error('Escolha ao menos um dia.');
        if (v.metaSemanal > v.diasSemana.length) throw new Error('A meta não pode ser maior que o número de dias escolhidos.');
        return S.put(Object.assign(h ? JSON.parse(JSON.stringify(h)) : { tipo: 'habito', perfil: UI.state.perfil }, v));
      },
      onExcluir: h ? async () => { for (const r of S.list(UI.state.perfil, 'registroHabito', r => r.habitoId === h.id)) await S.remove(r.id); await S.remove(h.id); } : null });
  }

  UI.route('sono', {
    titulo: 'Sono e hábitos',
    render() {
      const p = UI.state.perfil;
      const sonos = S.list(p, 'registroSono').sort((a, b) => (a.data < b.data ? 1 : -1));
      const ult7 = sonos.filter(s => s.data > L.addDias(L.hoje(), -7));
      const mSono = L.meta(p, 'sono', 'todos');
      const media = ult7.length ? Math.round(ult7.reduce((t, s) => t + L.duracaoSono(s.deitar, s.acordar), 0) / ult7.length) : null;
      let h = '<div class="page-head"><div><h1>Sono e hábitos</h1><div class="sub">' + esc(UI.nomePerfil()) + '</div></div></div>';
      h += '<div class="card"><div class="card-head"><h2>' + icon('sono', 'sm') + ' Sono</h2><button class="btn sm" type="button" data-a="novoSono">' + icon('plus', 'sm') + 'Registrar</button></div>' +
        '<dl class="kv" style="margin-bottom:12px"><dt>Média dos últimos 7 dias</dt><dd>' + (media ? L.fmtDuracao(media) + ' <span class="muted small">(' + ult7.length + ' noite(s) registrada(s))</span>' : 'Sem registros') + '</dd>' +
        (mSono ? '<dt>Meta</dt><dd>' + L.fmtNum(mSono.valor) + ' h ' + UI.fonte(mSono.fonte) + '</dd>' : '') + '</dl>' +
        (sonos.length ? '<div class="table-wrap"><table><thead><tr><th>Dia</th><th>Deitou</th><th>Acordou</th><th class="n">Duração</th><th class="n">Qualidade</th><th><span class="sr-only">Editar</span></th></tr></thead><tbody>' +
          sonos.slice(0, 30).map(s => '<tr><td>' + L.fmtData(s.data) + '</td><td class="num">' + s.deitar + '</td><td class="num">' + s.acordar + '</td><td class="n">' + L.fmtDuracao(L.duracaoSono(s.deitar, s.acordar)) + '</td><td class="n">' + (s.qualidade ? s.qualidade + '/5' : '—') + '</td><td><button class="btn ghost icon" type="button" data-a="editSono" data-id="' + s.id + '" aria-label="Editar sono de ' + L.fmtData(s.data) + '">' + icon('editar', 'sm') + '</button></td></tr>').join('') +
          '</tbody></table></div>' : '<p class="empty">Nenhuma noite registrada.</p>') +
        '<p class="muted tiny" style="margin-top:8px">O app registra só horários e sua percepção. Não mede fases do sono nem detecta distúrbios.</p></div>';

      const habs = S.list(p, 'habito').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const dias = L.intervalo(L.addDias(L.hoje(), -6), L.hoje());
      h += '<div class="card"><div class="card-head"><h2>Hábitos</h2><button class="btn sm" type="button" data-a="novoHabito">' + icon('plus', 'sm') + 'Hábito</button></div>';
      if (!habs.length) h += '<p class="empty">Nenhum hábito. Comece com um ou dois.</p>';
      habs.forEach(hb => {
        const seq = L.sequenciaHabito(p, hb);
        h += '<div style="padding:12px 0;border-top:1px solid var(--border)"><div class="btns" style="justify-content:space-between;flex-wrap:nowrap;align-items:center"><div><div class="title" style="font-weight:600">' + esc(hb.nome) + (hb.pausado ? ' <span class="badge">Pausado</span>' : '') + ' ' + UI.fonte(hb.fonte) + '</div>' +
          '<div class="muted small">' + UI.diasTexto(hb.diasSemana) + ' · meta ' + hb.metaSemanal + 'x/semana' + (seq ? ' · ' + seq + (seq === 1 ? ' semana' : ' semanas') + ' seguidas' : '') + '</div></div>' +
          '<div class="btns" style="flex-wrap:nowrap"><button class="btn sm" type="button" data-a="pausar" data-id="' + hb.id + '">' + (hb.pausado ? 'Retomar' : 'Pausar') + '</button><button class="btn ghost icon" type="button" data-a="editHabito" data-id="' + hb.id + '" aria-label="Editar hábito">' + icon('editar', 'sm') + '</button></div></div>' +
          '<div class="dias" style="margin-top:8px" role="group" aria-label="Últimos 7 dias: ' + esc(hb.nome) + '">' + dias.map(d => {
            const f = L.habitoFeito(p, hb, d), dev = L.habitoDevido(hb, d);
            return '<button type="button" class="chip" data-a="toggleHab" data-id="' + hb.id + '" data-v="' + d + '" aria-pressed="' + f + '" aria-label="' + L.fmtData(d) + (f ? ' feito' : dev ? ' não marcado' : ' fora dos dias do hábito') + '" style="min-width:44px;justify-content:center;flex-direction:column;gap:0;padding:4px 6px;' + (dev ? '' : 'opacity:.55') + '">' +
              '<span class="tiny">' + L.DIAS_CURTO[L.diaSemana(d)] + '</span>' + (f ? icon('check', 'sm') : '<span class="tiny">' + L.dateFromKey(d).getDate() + '</span>') + '</button>';
          }).join('') + '</div></div>';
      });
      h += '<p class="muted tiny" style="margin-top:8px">A sequência conta semanas seguidas com a meta cumprida. A semana atual nunca quebra a sequência antes de terminar.</p></div>';
      return h;
    },
    depois(view, params) {
      if (params.editar) { const s = S.get(params.editar); history.replaceState(null, '', '#sono'); if (s && s.perfil === UI.state.perfil) editarSono(s); }
    },
    acoes: {
      novoSono() { editarSono(null); },
      editSono(ds) { editarSono(S.get(ds.id)); },
      novoHabito() { editarHabito(null); },
      editHabito(ds) { editarHabito(S.get(ds.id)); },
      pausar(ds) { const h = JSON.parse(JSON.stringify(S.get(ds.id))); h.pausado = !h.pausado; UI.agir(() => S.put(h)); },
      toggleHab(ds) {
        const p = UI.state.perfil;
        const ex = S.find(p, 'registroHabito', r => r.data === ds.v && r.habitoId === ds.id);
        UI.agir(() => ex ? S.remove(ex.id) : S.put({ tipo: 'registroHabito', perfil: p, data: ds.v, habitoId: ds.id, feito: true }));
      }
    }
  });
})(window.HJ);
