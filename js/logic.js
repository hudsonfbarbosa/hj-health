/* H&J Health — Camada de REGRAS DE NEGÓCIO
 * Funções puras sobre os dados do Store. Nenhuma manipula a interface.
 */
(function (HJ) {
  'use strict';
  const S = () => HJ.Store;
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  /* ---------- Datas (sempre no fuso local do aparelho) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const keyFromDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dateFromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const hoje = () => keyFromDate(new Date());
  const addDias = (k, n) => { const d = dateFromKey(k); d.setDate(d.getDate() + n); return keyFromDate(d); };
  const diaSemana = k => dateFromKey(k).getDay();
  const inicioSemana = k => addDias(k, -((diaSemana(k) + 6) % 7)); // segunda-feira
  const diasEntre = (a, b) => Math.round((dateFromKey(b) - dateFromKey(a)) / 86400000);
  const horaAgora = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  function intervalo(ini, fim) { const out = []; for (let k = ini; k <= fim; k = addDias(k, 1)) out.push(k); return out; }
  function fmtData(k, estilo) {
    if (!k) return 'Não informado';
    const d = dateFromKey(k);
    if (estilo === 'longo') return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (estilo === 'curto') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return d.toLocaleDateString('pt-BR');
  }
  function fmtNum(n, dec) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec === undefined ? 1 : dec });
  }
  function parseNum(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).trim().replace(/\s/g, '');
    if (!t) return null;
    const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
    const v = Number(norm);
    return isFinite(v) ? v : NaN;
  }
  function fmtDuracao(min) {
    if (min === null || min === undefined || !isFinite(min)) return '—';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h + 'h' + (m ? pad(m) : '');
  }
  function fmtSeg(seg) {
    if (!isFinite(seg) || seg === null) return '—';
    seg = Math.round(seg);
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
  }
  function parseDuracaoSeg(s) {
    // aceita "28:30", "1:02:10" ou minutos "28"
    if (!s) return null;
    const p = String(s).trim().split(':').map(x => x.trim());
    if (p.some(x => !/^\d+$/.test(x))) return NaN;
    const n = p.map(Number);
    if (n.length === 1) return n[0] * 60;
    if (n.length === 2) return n[1] < 60 ? n[0] * 60 + n[1] : NaN;
    if (n.length === 3) return n[1] < 60 && n[2] < 60 ? n[0] * 3600 + n[1] * 60 + n[2] : NaN;
    return NaN;
  }

  /* ---------- Perfil, plano e metas ---------- */
  const config = perfil => S().find(perfil, 'perfilConfig');
  function treinoPlanejado(perfil, data) {
    const c = config(perfil);
    const t = c && c.rotinaTreino ? c.rotinaTreino[String(diaSemana(data))] : null;
    return t && t.modalidade !== 'descanso' ? t : null;
  }
  const ehTreinoForte = t => t && ['musculacao', 'corrida'].includes(t.modalidade);
  function planos(perfil) { return S().list(perfil, 'planoAlimentar').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); }
  function registroDiario(perfil, data) { return S().find(perfil, 'registroDiario', r => r.data === data); }
  function planoDoDia(perfil, data) {
    const reg = registroDiario(perfil, data);
    if (reg && reg.planoId) { const p = S().get(reg.planoId); if (p && p.perfil === perfil) return p; }
    const ativos = planos(perfil).filter(p => p.ativo);
    return ativos.find(p => p.diasSemana.includes(diaSemana(data))) || null;
  }
  function variantePlano(perfil, plano) {
    if (!plano) return 'todos';
    const c = config(perfil);
    const rot = (c && c.rotinaTreino) || {};
    return plano.diasSemana.some(d => ehTreinoForte(rot[String(d)])) ? 'treino' : 'descanso';
  }
  function meta(perfil, chave, variante) {
    const ms = S().list(perfil, 'meta', m => m.chave === chave);
    return ms.find(m => m.variante === variante) || ms.find(m => m.variante === 'todos') || null;
  }
  function metaDoDia(perfil, chave, data) { return meta(perfil, chave, variantePlano(perfil, planoDoDia(perfil, data))); }

  /* ---------- Itens do dia ---------- */
  const aguaRegistros = (perfil, data) => S().list(perfil, 'registroAgua', r => r.data === data).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
  const aguaTotal = (perfil, data) => aguaRegistros(perfil, data).reduce((s, r) => s + r.ml, 0);
  const devidoNoDia = (item, data) => item.ativo && (item.frequencia === 'diario' || item.frequencia === 'semanal') && item.diasSemana.includes(diaSemana(data));
  function suplementosDoDia(perfil, data) {
    const regs = S().list(perfil, 'registroSuplemento', r => r.data === data);
    return S().list(perfil, 'suplemento').filter(s => devidoNoDia(s, data) || regs.some(r => r.suplementoId === s.id))
      .sort((a, b) => (a.horario || '99').localeCompare(b.horario || '99') || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(s => ({ sup: s, devido: devidoNoDia(s, data), reg: regs.find(r => r.suplementoId === s.id) || null }));
  }
  function medicamentosDoDia(perfil, data) {
    const regs = S().list(perfil, 'registroMedicamento', r => r.data === data);
    return S().list(perfil, 'medicamento', m => m.ativo || regs.some(r => r.medicamentoId === m.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => ({
      med: m,
      semDia: m.frequencia === 'semanal' && m.diasSemana.length === 0,
      devido: devidoNoDia(m, data),
      reg: regs.find(r => r.medicamentoId === m.id) || null
    })).filter(x => x.devido || x.reg || x.semDia);
  }
  const sessoesDoDia = (perfil, data) => S().list(perfil, 'sessaoTreino', s => s.data === data);
  const sonoDoDia = (perfil, data) => S().find(perfil, 'registroSono', r => r.data === data);

  // Progresso do dia: só itens aplicáveis. Retorna null se não houver nada aplicável.
  function progressoDia(perfil, data) {
    const itens = [];
    const reg = registroDiario(perfil, data);
    const plano = planoDoDia(perfil, data);
    if (plano) plano.refeicoes.forEach(r => itens.push({ area: 'refeicoes', feito: reg && reg.refeicoes && reg.refeicoes[r.id] ? 1 : 0 }));
    const mAgua = metaDoDia(perfil, 'agua', data);
    if (mAgua && mAgua.valor > 0) itens.push({ area: 'agua', feito: Math.min(1, aguaTotal(perfil, data) / mAgua.valor) });
    suplementosDoDia(perfil, data).filter(x => x.devido).forEach(x => itens.push({ area: 'suplementos', feito: x.reg && x.reg.status === 'tomado' ? 1 : 0 }));
    medicamentosDoDia(perfil, data).filter(x => x.devido).forEach(x => itens.push({ area: 'medicamentos', feito: x.reg && x.reg.status === 'aplicado' ? 1 : 0 }));
    const tp = treinoPlanejado(perfil, data);
    const st = reg ? reg.treinoStatus : null;
    if (tp && st !== 'descanso') itens.push({ area: 'treino', feito: st === 'feito' ? 1 : 0 });
    if (!itens.length) return null;
    const feitos = itens.reduce((s, i) => s + i.feito, 0);
    return { feitos, total: itens.length, pct: feitos / itens.length, itens };
  }

  // Existe algum registro do usuário nesse dia?
  function temRegistro(perfil, data) {
    const tipos = ['registroDiario', 'registroAgua', 'registroSuplemento', 'registroMedicamento', 'sessaoTreino', 'registroSono', 'registroHabito'];
    return S().list(perfil, null, r => r.data === data && tipos.includes(r.tipo)).some(r =>
      r.tipo !== 'registroDiario' || Object.keys(r.refeicoes || {}).length || r.treinoStatus || r.recuperacao);
  }

  // Resumo diário para Semana, Relatórios e gráficos. Dias sem registro ficam marcados, nunca preenchidos.
  function resumoDia(perfil, data) {
    const sem = !temRegistro(perfil, data);
    const reg = registroDiario(perfil, data);
    const plano = planoDoDia(perfil, data);
    const planejadas = plano ? plano.refeicoes.length : 0;
    const feitas = plano && reg && reg.refeicoes ? plano.refeicoes.filter(r => reg.refeicoes[r.id]).length : 0;
    const sups = suplementosDoDia(perfil, data).filter(x => x.devido);
    const tp = treinoPlanejado(perfil, data);
    const sono = sonoDoDia(perfil, data);
    const mA = metaDoDia(perfil, 'agua', data);
    const prog = progressoDia(perfil, data);
    return {
      data, semRegistro: sem,
      refeicoes: { feitas, planejadas },
      agua: { ml: aguaTotal(perfil, data), meta: mA ? mA.valor : null },
      suplementos: { tomados: sups.filter(x => x.reg && x.reg.status === 'tomado').length, devidos: sups.length },
      treino: { planejado: tp ? tp.nome : null, status: reg ? reg.treinoStatus : null, sessoes: sessoesDoDia(perfil, data).length },
      sonoMin: sono ? duracaoSono(sono.deitar, sono.acordar) : null,
      sonoQualidade: sono ? sono.qualidade : null,
      progresso: sem || !prog ? null : prog.pct
    };
  }

  /* ---------- Sono, corrida, hábitos ---------- */
  function duracaoSono(deitar, acordar) {
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!re.test(deitar || '') || !re.test(acordar || '')) return null;
    const m = t => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
    const d = (m(acordar) - m(deitar) + 1440) % 1440;
    return d === 0 ? null : d; // mesmo horário = inválido
  }
  function ritmoSegKm(km, seg) { return km > 0 && seg > 0 ? seg / km : null; }
  function statusObjetivo(perfil, obj) {
    // Registro compatível: corrida com distância entre a meta e +4% (não extrapola tempos de outras distâncias).
    const compat = S().list(perfil, 'sessaoTreino', s => s.modalidade === 'corrida' && s.distanciaKm >= obj.distanciaKm && s.distanciaKm <= obj.distanciaKm * 1.04 && s.duracaoSeg > 0);
    if (!compat.length) return { atingido: false, melhor: null, registros: 0 };
    const melhor = compat.reduce((a, b) => (b.duracaoSeg < a.duracaoSeg ? b : a));
    return { atingido: melhor.duracaoSeg < obj.tempoAlvoSeg, melhor, registros: compat.length };
  }
  const habitoDevido = (h, data) => !h.pausado && h.diasSemana.includes(diaSemana(data));
  const habitoFeito = (perfil, h, data) => !!S().find(perfil, 'registroHabito', r => r.habitoId === h.id && r.data === data && r.feito);
  // Sequência tolerante em semanas: conta semanas seguidas em que a meta semanal foi cumprida.
  // A semana atual nunca quebra a sequência enquanto não terminou.
  function sequenciaHabito(perfil, h, ref) {
    ref = ref || hoje();
    const inicioHabito = (h.criadoEm || '').slice(0, 10) || '1970-01-01';
    let semana = inicioSemana(ref), n = 0;
    for (let guard = 0; guard < 520; guard++) {
      const dias = intervalo(semana, addDias(semana, 6)).filter(d => d <= ref);
      const devidos = dias.filter(d => habitoDevido(h, d)).length;
      const feitos = dias.filter(d => habitoFeito(perfil, h, d)).length;
      const atual = semana === inicioSemana(ref);
      const metaSem = Math.min(h.metaSemanal, intervalo(semana, addDias(semana, 6)).filter(d => habitoDevido(h, d)).length);
      if (metaSem > 0 && feitos >= metaSem) n++;
      else if (!atual && devidos > 0) break;
      semana = addDias(semana, -7);
      if (addDias(semana, 6) < inicioHabito) break;
    }
    return n;
  }

  /* ---------- Semana ---------- */
  function resumoSemana(perfil, semanaInicio) {
    const dias = intervalo(semanaInicio, addDias(semanaInicio, 6)).filter(d => d <= hoje());
    const todos = dias.map(d => resumoDia(perfil, d));
    const r = todos.filter(x => !x.semRegistro); // porcentagens só sobre dias registrados
    const soma = (f) => r.reduce((s, x) => s + f(x), 0);
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
    const comAgua = r.filter(x => x.agua.meta);
    const treinoPlan = r.filter(x => x.treino.planejado && x.treino.status !== 'descanso');
    const sonos = r.filter(x => x.sonoMin);
    const habitos = S().list(perfil, 'habito', h => !h.pausado);
    const diasReg = r.map(x => x.data);
    const habDev = habitos.reduce((s, h) => s + diasReg.filter(d => habitoDevido(h, d)).length, 0);
    const habFeito = habitos.reduce((s, h) => s + diasReg.filter(d => habitoFeito(perfil, h, d)).length, 0);
    return {
      dias: dias.length,
      diasComRegistro: r.length,
      refeicoes: pct(soma(x => x.refeicoes.feitas), soma(x => x.refeicoes.planejadas)),
      agua: pct(comAgua.filter(x => x.agua.ml >= x.agua.meta).length, comAgua.length),
      suplementos: pct(soma(x => x.suplementos.tomados), soma(x => x.suplementos.devidos)),
      treino: pct(treinoPlan.filter(x => x.treino.status === 'feito').length, treinoPlan.length),
      treinosFeitos: r.filter(x => x.treino.status === 'feito').length,
      treinosPlanejados: treinoPlan.length,
      sonoMedioMin: sonos.length ? Math.round(sonos.reduce((s, x) => s + x.sonoMin, 0) / sonos.length) : null,
      noitesSono: sonos.length,
      habitos: pct(habFeito, habDev)
    };
  }

  /* ---------- Lista de compras ---------- */
  const UNIDADES = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], l: ['ml', 1000], un: ['un', 1], unidade: ['un', 1], unidades: ['un', 1] };
  function baseUnidade(u) { const k = (u || '').trim().toLowerCase(); return UNIDADES[k] || (k ? [k, 1] : [null, 1]); }
  function agregarIngredientes(lista) {
    const mapa = new Map();
    lista.forEach(i => {
      const [ub, f] = baseUnidade(i.unidade);
      const chave = i.nome.trim().toLowerCase() + '|' + (ub || '');
      const atual = mapa.get(chave) || { nome: i.nome.trim(), unidade: ub, quantidade: null, semQuantidade: false, categoria: i.categoria || 'Outros', origens: new Set(), ids: [], marcados: 0 };
      if (i.quantidade === null || i.quantidade === undefined) atual.semQuantidade = true;
      else atual.quantidade = (atual.quantidade || 0) + i.quantidade * f;
      if (i.origem) atual.origens.add(i.origem);
      if (i.id) atual.ids.push(i.id);
      if (i.marcado) atual.marcados++;
      mapa.set(chave, atual);
    });
    return [...mapa.values()].map(x => {
      let q = x.quantidade, u = x.unidade;
      if (q !== null && u === 'g' && q >= 1000) { q = q / 1000; u = 'kg'; }
      if (q !== null && u === 'ml' && q >= 1000) { q = q / 1000; u = 'l'; }
      return { nome: x.nome, quantidade: q === null ? null : Math.round(q * 1000) / 1000, unidade: u, semQuantidade: x.semQuantidade, categoria: x.categoria, origem: [...x.origens].join(', ') || null, ids: x.ids, marcado: x.ids.length > 0 && x.marcados === x.ids.length };
    }).sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /* ---------- Calendário (.ics) ---------- */
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = []; let cur = '';
    for (const ch of line) {
      if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  function proximaData(dias, apartirDe) {
    for (let i = 0; i < 7; i++) { const k = addDias(apartirDe, i); if (dias.includes(diaSemana(k))) return k; }
    return apartirDe;
  }
  // opcoes: { inicio, suplementos, treino:{hora}, agua:{horarios[]}, bioimpedancia:{semanas, hora, inicio}, fechamento, backup, refeicoes }
  function gerarICS(perfil, op) {
    const c = config(perfil);
    const nome = c ? c.nome : perfil;
    const inicio = op.inicio || hoje();
    const ev = [];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    function add(uid, titulo, desc, dataK, hora, rrule) {
      const dt = dataK.replace(/-/g, '') + 'T' + hora.replace(':', '') + '00';
      const fimMin = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + 10;
      const fim = dataK.replace(/-/g, '') + 'T' + pad(Math.min(23, Math.floor(fimMin / 60))) + pad(fimMin >= 1440 ? 59 : fimMin % 60) + '00';
      ev.push(['BEGIN:VEVENT', 'UID:' + uid + '@hj-health', 'DTSTAMP:' + stamp, 'DTSTART;TZID=America/Sao_Paulo:' + dt, 'DTEND;TZID=America/Sao_Paulo:' + fim,
        rrule ? 'RRULE:' + rrule : null, 'SUMMARY:' + icsEsc(titulo), desc ? 'DESCRIPTION:' + icsEsc(desc) : null, 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(titulo), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].filter(Boolean));
    }
    const semHorario = [];
    if (op.suplementos) {
      const grupos = new Map();
      S().list(perfil, 'suplemento', s => s.ativo && s.frequencia !== 'condicional').forEach(s => {
        if (!s.horario || !s.diasSemana.length) { semHorario.push(s.nome); return; }
        const k = s.horario + '|' + s.diasSemana.slice().sort().join(',');
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(s);
      });
      grupos.forEach((lista, k) => {
        const [hora, dias] = k.split('|'); const d = dias.split(',').map(Number);
        const titulo = 'Suplementos: ' + lista.map(s => s.nome + (s.dose !== null ? ' ' + fmtNum(s.dose) + (s.unidade ? ' ' + s.unidade : '') : '')).join(', ');
        const rr = d.length === 7 ? 'FREQ=DAILY' : 'FREQ=WEEKLY;BYDAY=' + d.map(x => BYDAY[x]).join(',');
        add(perfil + '-sup-' + hora.replace(':', '') + '-' + d.join(''), titulo, 'Marque no H&J Health (Hoje > Suplementos).', proximaData(d, inicio), hora, rr);
      });
      S().list(perfil, 'medicamento', m => m.ativo).forEach(m => {
        if (!m.diasSemana.length || !m.horario) { semHorario.push(m.nome); return; }
        add(perfil + '-med-' + m.id, 'Registrar: ' + m.nome, 'Lembrete de registro. Dose e conduta: conforme o médico.', proximaData(m.diasSemana, inicio), m.horario,
          m.frequencia === 'diario' ? 'FREQ=DAILY' : 'FREQ=WEEKLY;BYDAY=' + m.diasSemana.map(x => BYDAY[x]).join(','));
      });
    }
    if (op.treino && op.treino.hora) {
      const rot = (c && c.rotinaTreino) || {};
      Object.keys(rot).forEach(d => {
        const t = rot[d]; if (!t || t.modalidade === 'descanso') return;
        add(perfil + '-treino-' + d, 'Registrar treino: ' + t.nome, 'Marque feito, não feito ou descanso no H&J Health.', proximaData([Number(d)], inicio), op.treino.hora, 'FREQ=WEEKLY;BYDAY=' + BYDAY[d]);
      });
    }
    if (op.agua && op.agua.horarios) {
      const mA = meta(perfil, 'agua', 'todos') || meta(perfil, 'agua', 'treino');
      op.agua.horarios.forEach(h => add(perfil + '-agua-' + h.replace(':', ''), 'Água: beber e registrar', mA ? 'Meta do dia: ' + fmtNum(mA.valor / 1000) + ' L.' : 'Registre no H&J Health.', inicio, h, 'FREQ=DAILY'));
    }
    if (op.refeicoes) {
      planos(perfil).filter(p => p.ativo).forEach(p => p.refeicoes.forEach(r => {
        if (!r.horario || !p.diasSemana.length) return;
        add(perfil + '-ref-' + r.id, r.nome, 'Plano: ' + p.nome, proximaData(p.diasSemana, inicio), r.horario,
          p.diasSemana.length === 7 ? 'FREQ=DAILY' : 'FREQ=WEEKLY;BYDAY=' + p.diasSemana.map(x => BYDAY[x]).join(','));
      }));
    }
    if (op.bioimpedancia && op.bioimpedancia.semanas > 0) {
      const b = op.bioimpedancia;
      let d = b.inicio || inicio;
      while (d < inicio) d = addDias(d, 7 * b.semanas);
      add(perfil + '-bio', 'Bioimpedância, peso e cintura', 'Mesmo aparelho, mesmo horário, em jejum, após ir ao banheiro e sem treinar antes. Registre em Evolução.', d, b.hora || '07:30', 'FREQ=WEEKLY;INTERVAL=' + b.semanas);
    }
    if (op.fechamento) add(perfil + '-fechamento', 'Fechamento da semana (2 min)', 'Abra Semana no H&J Health: adesão, um destaque, um ponto de atenção, uma intenção.', proximaData([0], inicio), op.fechamento, 'FREQ=WEEKLY;BYDAY=SU');
    if (op.backup) add(perfil + '-backup', 'Backup do H&J Health', 'Configurações > Exportar backup. Guarde o arquivo no iCloud Drive.', proximaData([0], inicio), op.backup, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU');

    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//H&J Health//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEsc('H&J Health — ' + nome), 'X-WR-TIMEZONE:America/Sao_Paulo',
      'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];
    ev.forEach(e => e.forEach(l => linhas.push(l)));
    linhas.push('END:VCALENDAR');
    return { texto: linhas.map(icsFold).join('\r\n') + '\r\n', eventos: ev.length, semHorario };
  }

  /* ---------- CSV (padrão brasileiro: ; e vírgula decimal) ---------- */
  function toCSV(colunas, linhas) {
    const cel = v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      const s = String(v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '\uFEFF' + [colunas.map(c => cel(c.titulo)).join(';')].concat(linhas.map(l => colunas.map(c => cel(l[c.chave])).join(';'))).join('\r\n');
  }

  HJ.L = {
    DIAS, DIAS_CURTO, pad, keyFromDate, dateFromKey, hoje, addDias, diaSemana, inicioSemana, diasEntre, horaAgora, intervalo,
    fmtData, fmtNum, parseNum, fmtDuracao, fmtSeg, parseDuracaoSeg,
    config, treinoPlanejado, planos, registroDiario, planoDoDia, variantePlano, meta, metaDoDia,
    aguaRegistros, aguaTotal, suplementosDoDia, medicamentosDoDia, sessoesDoDia, sonoDoDia, progressoDia, temRegistro, resumoDia,
    duracaoSono, ritmoSegKm, statusObjetivo, habitoDevido, habitoFeito, sequenciaHabito, resumoSemana,
    agregarIngredientes, gerarICS, toCSV
  };
})(window.HJ = window.HJ || {});
