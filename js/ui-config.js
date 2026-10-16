/* H&J Health — CONFIGURAÇÕES: perfil, tema, backup, importação, armazenamento, calendário, privacidade */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S, IO } = HJ;
  const { esc, icon } = UI;
  const VERSAO = '1.0.0';
  const NOMES_TIPO = { perfilConfig: 'Perfil', planoAlimentar: 'Planos alimentares', meta: 'Metas', suplemento: 'Suplementos', medicamento: 'Medicamentos', registroDiario: 'Dias registrados', registroAgua: 'Registros de água', registroSuplemento: 'Registros de suplemento', registroMedicamento: 'Registros de medicamento', sessaoTreino: 'Sessões de treino', exercicio: 'Exercícios', objetivoCorrida: 'Objetivos de corrida', registroSono: 'Noites de sono', medicao: 'Medições', exame: 'Exames', consulta: 'Consultas', historicoSaude: 'Histórico de saúde', habito: 'Hábitos', registroHabito: 'Registros de hábito', fechamentoSemanal: 'Fechamentos semanais', receita: 'Receitas', listaCompras: 'Listas de compras' };
  let estimativa = null;

  /* ---------- Fluxos compartilhados com outras telas ---------- */
  UI.exportarBackupFluxo = async function (perfis, compartilhar) {
    try {
      const obj = IO.exportarBackup(perfis);
      const nome = 'hj-backup-' + (perfis && perfis.length === 1 ? perfis[0] + '-' : '') + L.hoje() + '.json';
      const r = await IO.entregarArquivo(nome, JSON.stringify(obj, null, 2), 'application/json', compartilhar);
      if (r === 'cancelado') return;
      await S.setMeta('ultimoBackup', new Date().toISOString());
      UI.toast('Backup gerado (' + obj.registros.length + ' registros). Guarde o arquivo fora do celular, por exemplo no iCloud Drive.');
      UI.render(true);
    } catch (e) { UI.toast('Falha ao gerar backup: ' + e.message, { erro: true }); }
  };

  UI.pedirPersistencia = async function () {
    if (!navigator.storage || !navigator.storage.persist) { UI.toast('Este navegador não oferece armazenamento persistente. Faça backups regulares.', { erro: true }); return; }
    try {
      const ok = await navigator.storage.persist();
      await S.setMeta('persistencia', ok ? 'concedida' : 'negada');
      UI.toast(ok ? 'Armazenamento persistente concedido.' : 'O navegador não concedeu agora. No iPhone, use o app pela tela inicial e faça backups.', { erro: !ok });
      UI.render(true);
    } catch (e) { UI.toast('Não foi possível pedir: ' + e.message, { erro: true }); }
  };

  UI.importarArquivo = async function (file) {
    let texto;
    try { texto = await IO.lerArquivo(file); } catch (e) { UI.toast('Não foi possível ler o arquivo.', { erro: true }); return; }
    const an = IO.analisar(texto, file.size);
    if (!an.ok) {
      const errs = an.ctx.errors;
      await UI.info('Arquivo não importado', '<div class="callout red">' + icon('alerta') + '<div>Nenhum dado foi alterado.</div></div><ul class="small">' + errs.slice(0, 15).map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' + (errs.length > 15 ? '<p class="muted small">… e mais ' + (errs.length - 15) + ' problema(s).</p>' : ''));
      return;
    }
    const resumo = an.perfis.map(p => {
      const info = an.porPerfil[p] || { total: 0, tipos: {} };
      const imp = IO.impacto(an, [p]);
      return '<div class="card flat" style="padding:12px"><h3>' + esc(IO.NOMES[p]) + ': ' + info.total + ' registro(s)</h3><p class="muted small">' + Object.entries(info.tipos).map(([t, n]) => esc(NOMES_TIPO[t] || t) + ' ' + n).join(' · ') + '</p>' +
        '<p class="small" style="margin-top:6px">' + (imp.modo === 'mesclar' ? 'Vai adicionar ' + imp.novos + ' e atualizar ' + imp.sobrescritos + ' registro(s) com o mesmo identificador. Seus registros diários são mantidos.' :
          (imp.removidos ? '<strong style="color:var(--amber)">Vai substituir os ' + imp.removidos + ' registro(s) atuais de ' + esc(IO.NOMES[p]) + ' neste aparelho</strong> pelos ' + imp.novos + ' do backup.' : 'Vai restaurar ' + imp.novos + ' registro(s).')) + '</p></div>';
    }).join('');
    const campos = [{ k: 'nota', tipo: 'nota', html:
      '<p><strong>' + (an.tipoArquivo === 'seed' ? 'Arquivo de dados iniciais' : 'Backup') + '</strong>' + (an.exportadoEm ? ' · gerado em ' + esc(new Date(an.exportadoEm).toLocaleString('pt-BR')) : '') + '</p>' +
      (an.descricao ? '<p class="muted small">' + esc(an.descricao) + '</p>' : '') + resumo +
      (an.ctx.warnings.length ? '<div class="callout amber">' + icon('alerta') + '<div><strong>Avisos</strong><ul class="small" style="margin:4px 0 0;padding-left:18px">' + an.ctx.warnings.slice(0, 10).map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div>' : '') }];
    an.perfis.forEach(p => campos.push({ k: 'p_' + p, label: 'Importar ' + IO.NOMES[p], tipo: 'checkbox' }));
    const val = {}; an.perfis.forEach(p => { val['p_' + p] = true; });
    UI.form({ titulo: 'Conferir antes de importar', campos, valores: val, salvar: 'Importar',
      onSalvar: async v => {
        const perfis = an.perfis.filter(p => v['p_' + p]);
        if (!perfis.length) throw new Error('Escolha ao menos um perfil.');
        const n = await IO.aplicar(an, perfis);
        if (!perfis.includes(UI.state.perfil)) { UI.state.perfil = perfis[0]; HJ.Prefs.set('perfilAtivo', perfis[0]); }
        UI.toast(n + ' registro(s) importado(s).');
        if (UI.state.rota !== 'config') UI.ir('hoje');
      } });
  };

  /* ---------- Calendário ---------- */
  function opcoesPadraoICS(p) {
    const bio = S.list(p, 'medicao', m => m.gorduraPct !== null).sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    const temRotina = Object.keys(((L.config(p) || {}).rotinaTreino) || {}).length > 0;
    return { suplementos: true, treino: temRotina, treinoHora: '09:15', agua: true, aguaHorarios: '10:30, 14:30, 17:30', bio: true, bioSemanas: 4,
      bioHora: bio && bio.hora ? bio.hora : '07:30', bioInicio: bio ? L.addDias(bio.data, 28) : L.addDias(L.hoje(), 7), fechamento: true, fechamentoHora: '20:00', backup: true, backupHora: '20:10', refeicoes: false };
  }
  function lerOpcoesICS(p) { return Object.assign(opcoesPadraoICS(p), HJ.Prefs.get('ics.' + p, {})); }

  function calendarioHTML(p) {
    const o = lerOpcoesICS(p);
    const ck = (k, lbl) => '<label class="checkline"><input type="checkbox" name="' + k + '"' + (o[k] ? ' checked' : '') + '>' + lbl + '</label>';
    return '<form class="card" id="sec-calendario" data-a="gerarICS"><div class="card-head"><h2>' + icon('cal', 'sm') + ' Lembretes no calendário (.ics)</h2></div>' +
      '<p class="muted small" style="margin-bottom:10px">O app não envia notificações sozinho. Este arquivo cria eventos repetidos com alerta no app Calendário do celular de ' + esc(UI.nomePerfil()) + '. Crie antes um calendário "H&J Health" no app Calendário e escolha-o ao importar; para mudar depois, apague esse calendário e importe de novo.</p>' +
      '<div class="form-grid two">' +
      '<div>' + ck('suplementos', 'Suplementos (e medicamentos com dia e horário definidos)') + '</div><div></div>' +
      '<div>' + ck('treino', 'Registrar treino, nos dias da rotina') + '</div><div class="field"><label for="ic-th">Horário</label><input id="ic-th" name="treinoHora" type="time" value="' + esc(o.treinoHora) + '"></div>' +
      '<div>' + ck('agua', 'Beber e registrar água') + '</div><div class="field"><label for="ic-ah">Horários (separados por vírgula)</label><input id="ic-ah" name="aguaHorarios" type="text" value="' + esc(o.aguaHorarios) + '"></div>' +
      '<div>' + ck('bio', 'Bioimpedância, peso e cintura') + '</div><div class="form-grid tres"><div class="field"><label for="ic-bs">A cada (semanas)</label><input id="ic-bs" name="bioSemanas" type="number" min="1" max="12" step="1" value="' + o.bioSemanas + '"></div><div class="field"><label for="ic-bh">Hora</label><input id="ic-bh" name="bioHora" type="time" value="' + esc(o.bioHora) + '"></div><div class="field"><label for="ic-bi">Próxima</label><input id="ic-bi" name="bioInicio" type="date" value="' + esc(o.bioInicio) + '"></div></div>' +
      '<div>' + ck('fechamento', 'Fechamento da semana (domingo)') + '</div><div class="field"><label for="ic-fh">Horário</label><input id="ic-fh" name="fechamentoHora" type="time" value="' + esc(o.fechamentoHora) + '"></div>' +
      '<div>' + ck('backup', 'Backup a cada 14 dias (domingo)') + '</div><div class="field"><label for="ic-bkh">Horário</label><input id="ic-bkh" name="backupHora" type="time" value="' + esc(o.backupHora) + '"></div>' +
      '<div>' + ck('refeicoes', 'Refeições do plano (gera muitos alertas)') + '</div><div></div></div>' +
      '<p class="err small" id="ic-err" role="alert"></p><div class="btns" style="margin-top:10px"><button class="btn primary" type="submit" name="acao" value="baixar">' + icon('baixar', 'sm') + 'Baixar .ics</button><button class="btn" type="button" data-a="compartilharICS">' + icon('compart', 'sm') + 'Compartilhar</button></div>' +
      '<p class="muted tiny" style="margin-top:8px">No iPhone: abra o arquivo .ics (pelo app Arquivos, Mail ou AirDrop), toque em "Adicionar tudo" e escolha o calendário H&J Health. Confira se o primeiro evento tem alerta.</p></form>';
  }

  function coletarICS(f) {
    const g = n => f.elements[n];
    const o = { suplementos: g('suplementos').checked, treino: g('treino').checked, treinoHora: g('treinoHora').value, agua: g('agua').checked, aguaHorarios: g('aguaHorarios').value,
      bio: g('bio').checked, bioSemanas: Number(g('bioSemanas').value), bioHora: g('bioHora').value, bioInicio: g('bioInicio').value,
      fechamento: g('fechamento').checked, fechamentoHora: g('fechamentoHora').value, backup: g('backup').checked, backupHora: g('backupHora').value, refeicoes: g('refeicoes').checked };
    const hr = /^([01]\d|2[0-3]):[0-5]\d$/;
    const horarios = o.aguaHorarios.split(',').map(x => x.trim()).filter(Boolean);
    if (o.treino && !hr.test(o.treinoHora)) throw new Error('Horário do lembrete de treino inválido.');
    if (o.agua && (!horarios.length || horarios.some(x => !hr.test(x)))) throw new Error('Horários de água inválidos. Use HH:MM separados por vírgula.');
    if (o.bio && (!Number.isInteger(o.bioSemanas) || o.bioSemanas < 1 || o.bioSemanas > 12 || !hr.test(o.bioHora) || !HJ.schema.validDate(o.bioInicio))) throw new Error('Confira a recorrência da bioimpedância.');
    if (o.fechamento && !hr.test(o.fechamentoHora)) throw new Error('Horário do fechamento inválido.');
    if (o.backup && !hr.test(o.backupHora)) throw new Error('Horário do backup inválido.');
    return { o, op: { suplementos: o.suplementos, treino: o.treino ? { hora: o.treinoHora } : null, agua: o.agua ? { horarios } : null, bioimpedancia: o.bio ? { semanas: o.bioSemanas, hora: o.bioHora, inicio: o.bioInicio } : null, fechamento: o.fechamento ? o.fechamentoHora : null, backup: o.backup ? o.backupHora : null, refeicoes: o.refeicoes } };
  }
  async function entregarICS(f, compartilhar) {
    const p = UI.state.perfil;
    let r;
    try { r = coletarICS(f); } catch (e) { f.querySelector('#ic-err').textContent = e.message; return; }
    HJ.Prefs.set('ics.' + p, r.o);
    const ics = L.gerarICS(p, r.op);
    if (!ics.eventos) { f.querySelector('#ic-err').textContent = 'Nenhum lembrete selecionado.'; return; }
    await IO.entregarArquivo('hj-lembretes-' + p + '.ics', ics.texto, 'text/calendar', compartilhar);
    UI.toast(ics.eventos + ' lembrete(s) recorrente(s) gerado(s).' + (ics.semHorario.length ? ' Sem horário definido (não incluídos): ' + ics.semHorario.join(', ') + '.' : ''), { dur: 7000 });
  }

  /* ---------- Tela ---------- */
  UI.route('config', {
    titulo: 'Configurações',
    render() {
      const p = UI.state.perfil;
      const c = L.config(p);
      const padrao = HJ.Prefs.get('perfilPadrao', null);
      const tema = HJ.Prefs.get('tema', 'dark');
      const ub = S.getMeta('ultimoBackup');
      const pers = S.getMeta('persistencia');
      const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      let h = '<div class="page-head"><div><h1>Configurações</h1></div></div>';
      if (S.modoMemoria) h += '<div class="callout red">' + icon('alerta') + '<div><strong>Os dados não estão sendo salvos.</strong> Este navegador bloqueou o armazenamento local (comum em janela privada). Use uma janela normal.</div></div>';
      if (location.protocol === 'file:') h += '<div class="callout amber">' + icon('alerta') + '<div>Você abriu o app como arquivo local. No computador funciona; no celular, use a versão publicada (veja o guia de publicação).</div></div>';

      h += '<div class="card"><div class="card-head"><h2>Este aparelho</h2></div><div class="form-grid two">' +
        '<div class="field"><span class="lbl">Perfil padrão ao abrir</span><div class="seg">' + HJ.schema.PERFIS.map(x => '<button type="button" data-a="padrao" data-v="' + x + '" aria-pressed="' + (padrao === x) + '">' + esc(UI.nomePerfil(x)) + '</button>').join('') + '</div></div>' +
        '<div class="field"><span class="lbl">Tema</span><div class="seg">' + [['dark', 'Escuro'], ['light', 'Claro'], ['system', 'Sistema']].map(([v, l]) => '<button type="button" data-a="tema" data-v="' + v + '" aria-pressed="' + (tema === v) + '">' + l + '</button>').join('') + '</div></div></div></div>';

      h += '<div class="card"><div class="card-head"><h2>Perfil de ' + esc(UI.nomePerfil()) + '</h2><button class="btn sm" type="button" data-a="editPerfil">' + icon('editar', 'sm') + 'Editar</button></div>' +
        (c ? '<dl class="kv"><dt>Nascimento</dt><dd>' + (c.dataNascimento ? L.fmtData(c.dataNascimento) : UI.NI) + '</dd><dt>Altura</dt><dd>' + UI.val(c.alturaCm, 'cm', 0) + '</dd><dt>Objetivo</dt><dd>' + UI.val(c.objetivo) + '</dd><dt>Dormir / acordar</dt><dd>' + UI.val(c.horarioDormir) + ' / ' + UI.val(c.horarioAcordar) + '</dd></dl>' : '<p class="empty">Perfil ainda não configurado. Importe os dados iniciais ou edite.</p>') +
        '<p class="muted small" style="margin-top:8px">Metas ficam em Nutrição › Metas. Suplementos e medicamentos, em Saúde.</p></div>';

      h += '<div class="card" id="sec-backup"><div class="card-head"><h2>Backup e importação</h2></div>' +
        '<p class="small">' + (ub ? 'Último backup: <strong>' + L.fmtData(ub.slice(0, 10)) + '</strong> (' + L.diasEntre(ub.slice(0, 10), L.hoje()) + ' dia(s) atrás).' : '<strong>Nenhum backup feito neste aparelho.</strong>') + ' Recomendado a cada 14 dias.</p>' +
        '<div class="btns" style="margin-top:10px"><button class="btn primary" type="button" data-a="exportar" data-v="todos">' + icon('baixar', 'sm') + 'Exportar backup completo</button>' +
        '<button class="btn" type="button" data-a="exportar" data-v="perfil">Só ' + esc(UI.nomePerfil()) + '</button>' +
        (navigator.canShare ? '<button class="btn" type="button" data-a="exportar" data-v="compartilhar">' + icon('compart', 'sm') + 'Compartilhar backup</button>' : '') + '</div>' +
        '<hr class="sep"><p class="small">Importe um arquivo de dados iniciais (<code>hj-seed-*.json</code>) ou um backup. Você confere o conteúdo antes de qualquer alteração.</p>' +
        '<label class="btn" style="margin-top:10px">' + icon('subir', 'sm') + 'Importar arquivo<input type="file" accept=".json,application/json" data-a="importar" class="sr-only"></label></div>';

      h += '<div class="card"><div class="card-head"><h2>Armazenamento</h2></div><dl class="kv">' +
        '<dt>Onde ficam os dados</dt><dd>Só neste aparelho, no armazenamento do navegador (IndexedDB).</dd>' +
        '<dt>Persistente</dt><dd>' + (pers === 'concedida' ? '<span class="badge ok">Concedido</span>' : pers === 'negada' ? '<span class="badge warn">Não concedido</span>' : '<span class="badge">Não verificado</span>') + '</dd>' +
        '<dt>Aberto pela tela inicial</dt><dd>' + (standalone ? 'Sim' : 'Não') + '</dd>' +
        '<dt>Espaço usado</dt><dd id="uso">' + (estimativa ? estimativa : 'Calculando…') + '</dd>' +
        '<dt>Registros</dt><dd>' + S.count() + '</dd></dl>' +
        '<div class="btns" style="margin-top:10px"><button class="btn" type="button" data-a="persistir">Pedir armazenamento persistente</button></div>' +
        '<div class="callout amber" style="margin-top:10px">' + icon('alerta') + '<div>Não há sincronização: o celular de cada um guarda os próprios dados. No iPhone, o Safari pode apagar dados de sites pouco usados; usar o app pela tela inicial e fazer backup reduz esse risco.</div></div></div>';

      h += calendarioHTML(p);

      h += '<div class="card"><div class="card-head"><h2>Privacidade</h2></div><ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">' +
        '<li>Nenhum dado é enviado para a internet. O app não faz chamadas externas, não tem conta, rastreamento nem anúncios.</li>' +
        '<li>A separação entre Hudson e Joice é organizacional: quem usa este aparelho pode abrir os dois perfis. Não é uma barreira de segurança.</li>' +
        '<li>Os dados não são criptografados pelo app. A proteção vem do bloqueio do próprio celular.</li>' +
        '<li>Arquivos de backup contêm dados de saúde. Guarde-os em local privado.</li></ul></div>';

      h += '<div class="card"><div class="card-head"><h2>Apagar dados</h2></div><p class="small muted">Faça um backup antes. Esta ação não pode ser desfeita.</p><div class="btns" style="margin-top:10px">' +
        '<button class="btn danger" type="button" data-a="apagar" data-v="perfil">' + icon('lixo', 'sm') + 'Apagar dados de ' + esc(UI.nomePerfil()) + '</button>' +
        '<button class="btn danger" type="button" data-a="apagar" data-v="tudo">' + icon('lixo', 'sm') + 'Apagar tudo deste aparelho</button></div></div>';

      h += '<div class="card"><div class="card-head"><h2>Sobre</h2></div><dl class="kv"><dt>Versão</dt><dd>' + VERSAO + '</dd><dt>Esquema de dados</dt><dd>' + HJ.schema.SCHEMA_VERSION + '</dd></dl>' +
        '<p class="small" style="margin-top:8px"><strong>Instalar no iPhone:</strong> abra o endereço do app no Safari › Compartilhar › Adicionar à Tela de Início.</p>' +
        '<p class="muted tiny" style="margin-top:8px">Metas e plano marcados como estimativa não são prescrição profissional.</p></div>';
      return h;
    },
    depois(view, params) {
      if (!estimativa && navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(e => { estimativa = (e.usage / 1024 / 1024).toFixed(2).replace('.', ',') + ' MB'; const el = document.getElementById('uso'); if (el) el.textContent = estimativa; }).catch(() => {});
      } else if (!navigator.storage) { const el = document.getElementById('uso'); if (el) el.textContent = 'Não disponível'; }
      if (params.sec) { const el = document.getElementById('sec-' + params.sec); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50); }
    },
    acoes: {
      padrao(ds) { HJ.Prefs.set('perfilPadrao', ds.v); UI.render(true); },
      tema(ds) { HJ.Prefs.set('tema', ds.v); aplicarTema(); UI.render(true); },
      exportar(ds) { UI.exportarBackupFluxo(ds.v === 'perfil' ? [UI.state.perfil] : null, ds.v === 'compartilhar'); },
      importar(ds, el) { if (el.files[0]) UI.importarArquivo(el.files[0]); el.value = ''; },
      persistir() { UI.pedirPersistencia(); },
      gerarICS(ds, f) { entregarICS(f, false); },
      compartilharICS() { entregarICS(document.getElementById('sec-calendario'), true); },
      editPerfil() {
        const p = UI.state.perfil, c = L.config(p);
        UI.form({ titulo: 'Perfil', duasColunas: true,
          campos: [{ k: 'nome', label: 'Nome', req: true }, { k: 'dataNascimento', label: 'Nascimento', tipo: 'date' }, { k: 'alturaCm', label: 'Altura (cm)', tipo: 'number', min: 100, max: 230 },
            { k: 'sexo', label: 'Sexo', tipo: 'select', opcoes: [['masculino', 'Masculino'], ['feminino', 'Feminino']] }, { k: 'horarioDormir', label: 'Horário de dormir', tipo: 'time' }, { k: 'horarioAcordar', label: 'Horário de acordar', tipo: 'time' },
            { k: 'objetivo', label: 'Objetivo', tipo: 'textarea', span2: true }],
          valores: c || { nome: IO.NOMES[p] },
          onSalvar: v => S.put(Object.assign(c ? JSON.parse(JSON.stringify(c)) : { tipo: 'perfilConfig', perfil: p, rotinaTreino: {}, observacao: null, fonte: 'usuario' }, v)) });
      },
      async apagar(ds) {
        const tudo = ds.v === 'tudo';
        const alvo = tudo ? 'todos os dados deste aparelho (Hudson e Joice)' : 'todos os dados de ' + UI.nomePerfil();
        if (!await UI.confirmar({ titulo: 'Apagar dados?', texto: 'Você vai apagar ' + esc(alvo) + '. ' + (S.getMeta('ultimoBackup') ? 'Último backup: ' + L.fmtData(S.getMeta('ultimoBackup').slice(0, 10)) + '.' : '<strong>Você não tem backup.</strong>'), ok: 'Continuar', perigo: true })) return;
        if (!await UI.confirmar({ titulo: 'Confirmação final', texto: 'Esta ação não pode ser desfeita.', ok: 'Apagar definitivamente', perigo: true, digitar: 'APAGAR' })) return;
        try {
          if (tudo) await S.clearAll(); else await S.clearPerfil(UI.state.perfil);
          UI.toast('Dados apagados.'); UI.ir('hoje');
        } catch (e) { UI.toast('Falha ao apagar: ' + e.message, { erro: true }); }
      }
    }
  });

  function aplicarTema() { document.documentElement.dataset.theme = HJ.Prefs.get('tema', 'dark'); }
  UI.aplicarTema = aplicarTema;
})(window.HJ);
