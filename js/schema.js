/* H&J Health — Camada de MODELOS
 * Esquema versionado, validação de tipos e migrações.
 * Linguagem de campo: 'str' 'num' 'int' 'bool' 'date' (AAAA-MM-DD) 'time' (HH:MM) 'iso' 'id'
 * 'enum:a|b' 'arr:<sub|str|int>' 'obj:<sub>' 'map:<sub>' 'any'. Sufixo '?' = opcional/nulo.
 */
(function (HJ) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const PERFIS = ['hudson', 'joice'];
  const FONTE = 'enum:profissional|usuario|estimativa';

  const SUB = {
    itemAlimentar: { id: 'id', nome: 'str', quantidade: 'num?', unidade: 'str?', medidaCaseira: 'str?', kcal: 'num?', proteina: 'num?', carboidrato: 'num?', gordura: 'num?', observacao: 'str?', fonte: FONTE },
    substituicao: { id: 'id', descricao: 'str', autorizada: 'bool', observacao: 'str?', fonte: FONTE },
    refeicao: { id: 'id', nome: 'str', horario: 'time?', funcao: 'str?', itens: 'arr:itemAlimentar', substituicoes: 'arr:substituicao', observacao: 'str?', fonte: FONTE },
    refeicaoDia: { status: 'enum:feito|substituido', hora: 'time?', substituto: 'str?', observacao: 'str?', fome: 'int?', saciedade: 'int?' },
    recuperacao: { fadiga: 'int?', dor: 'int?', disposicao: 'int?', observacao: 'str?' },
    diaTreino: { nome: 'str', modalidade: 'enum:musculacao|cardio|corrida|caminhada|descanso|outro' },
    serie: { reps: 'int?', carga: 'num?' },
    exercicioSessao: { exercicioId: 'id?', nome: 'str', series: 'arr:serie', observacao: 'str?' },
    ingrediente: { nome: 'str', quantidade: 'num?', unidade: 'str?', categoria: 'str?' },
    itemCompra: { id: 'id', nome: 'str', quantidade: 'num?', unidade: 'str?', categoria: 'str?', marcado: 'bool', origem: 'str?' }
  };

  // Entidades persistidas. Todas recebem também os campos BASE.
  const TIPOS = {
    perfilConfig: { nome: 'str', dataNascimento: 'date?', alturaCm: 'num?', sexo: 'enum:masculino|feminino?', objetivo: 'str?', rotinaTreino: 'map:diaTreino', horarioDormir: 'time?', horarioAcordar: 'time?', observacao: 'str?' },
    planoAlimentar: { nome: 'str', diasSemana: 'arr:int', ativo: 'bool', refeicoes: 'arr:refeicao', observacao: 'str?' },
    meta: { chave: 'enum:agua|calorias|proteina|carboidrato|gordura|fibras|sono|passos', valor: 'num', valorMax: 'num?', unidade: 'str', variante: 'enum:todos|treino|descanso', observacao: 'str?' },
    suplemento: { nome: 'str', dose: 'num?', unidade: 'str?', frequencia: 'enum:diario|semanal|condicional', diasSemana: 'arr:int', horario: 'time?', ativo: 'bool', observacao: 'str?' },
    medicamento: { nome: 'str', dose: 'str?', frequencia: 'enum:diario|semanal|outro', diasSemana: 'arr:int', horario: 'time?', prescritoPor: 'str?', ativo: 'bool', observacao: 'str?' },
    registroDiario: { data: 'date', planoId: 'id?', refeicoes: 'map:refeicaoDia', treinoStatus: 'enum:feito|nao_feito|descanso?', recuperacao: 'obj:recuperacao?', observacao: 'str?' },
    registroAgua: { data: 'date', hora: 'time', ml: 'num' },
    registroSuplemento: { data: 'date', suplementoId: 'id', status: 'enum:tomado|pulado' },
    registroMedicamento: { data: 'date', medicamentoId: 'id', status: 'enum:aplicado|nao_aplicado' },
    sessaoTreino: { data: 'date', nome: 'str?', modalidade: 'enum:musculacao|corrida|caminhada|cardio|outro', duracaoMin: 'num?', esforco: 'int?', exercicios: 'arr:exercicioSessao', distanciaKm: 'num?', duracaoSeg: 'int?', fcMedia: 'int?', observacao: 'str?' },
    exercicio: { nome: 'str', grupo: 'str?' },
    objetivoCorrida: { nome: 'str', distanciaKm: 'num', tempoAlvoSeg: 'int', ativo: 'bool' },
    registroSono: { data: 'date', deitar: 'time', acordar: 'time', qualidade: 'int?', observacao: 'str?' },
    medicao: { data: 'date', hora: 'time?', peso: 'num?', cintura: 'num?', gorduraPct: 'num?', gorduraKg: 'num?', musculoEsqKg: 'num?', massaMagraKg: 'num?', aguaKg: 'num?', visceral: 'num?', tmb: 'num?', equipamento: 'str?', condicoes: 'str?', observacao: 'str?' },
    exame: { nome: 'str', data: 'date?', resultado: 'num?', resultadoTexto: 'str?', unidade: 'str?', refMin: 'num?', refMax: 'num?', refTexto: 'str?', laboratorio: 'str?', observacao: 'str?' },
    consulta: { data: 'date?', hora: 'time?', profissional: 'str?', especialidade: 'str?', status: 'enum:realizada|agendada', orientacoes: 'str?', examesSolicitados: 'str?', pendencias: 'str?', observacao: 'str?' },
    historicoSaude: { categoria: 'enum:condicao|alergia|intolerancia|cirurgia|vacina|outro', descricao: 'str', data: 'date?', observacao: 'str?' },
    habito: { nome: 'str', diasSemana: 'arr:int', metaSemanal: 'int', pausado: 'bool', observacao: 'str?' },
    registroHabito: { data: 'date', habitoId: 'id', feito: 'bool' },
    fechamentoSemanal: { semanaInicio: 'date', resumo: 'any', destaque: 'str?', atencao: 'str?', intencao: 'str?' },
    receita: { nome: 'str', rendimento: 'str?', ingredientes: 'arr:ingrediente', preparo: 'str?', tags: 'arr:str' },
    listaCompras: { nome: 'str', itens: 'arr:itemCompra' }
  };

  const BASE = { id: 'id', perfil: 'enum:hudson|joice', tipo: 'str', criadoEm: 'iso', atualizadoEm: 'iso', fonte: FONTE };

  const RX = {
    date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    time: /^([01]\d|2[0-3]):[0-5]\d$/,
    iso: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
    id: /^[A-Za-z0-9_-]{1,64}$/
  };

  function validDate(s) {
    if (!RX.date.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  // Valida um valor contra uma especificação. Retorna valor limpo; acumula erros/avisos.
  function checkValue(spec, v, path, ctx) {
    let opt = false;
    if (spec.endsWith('?')) { opt = true; spec = spec.slice(0, -1); }
    if (v === undefined || v === null) {
      if (opt || spec === 'any') return null;
      ctx.errors.push(path + ': campo obrigatório ausente');
      return undefined;
    }
    const [kind, arg] = spec.split(/:(.*)/s);
    switch (kind) {
      case 'any': return JSON.parse(JSON.stringify(v));
      case 'str': if (typeof v !== 'string') return bad(); return v.slice(0, 5000);
      case 'num': if (typeof v !== 'number' || !isFinite(v)) return bad(); return v;
      case 'int': if (!Number.isInteger(v)) return bad(); return v;
      case 'bool': if (typeof v !== 'boolean') return bad(); return v;
      case 'date': if (typeof v !== 'string' || !validDate(v)) return bad('data inválida (use AAAA-MM-DD)'); return v;
      case 'time': if (typeof v !== 'string' || !RX.time.test(v)) return bad('horário inválido (use HH:MM)'); return v;
      case 'iso': if (typeof v !== 'string' || !RX.iso.test(v) || isNaN(Date.parse(v))) return bad('data/hora inválida'); return v;
      case 'id': if (typeof v !== 'string' || !RX.id.test(v)) return bad('identificador inválido'); return v;
      case 'enum': if (!arg.split('|').includes(v)) return bad('valor não permitido: ' + JSON.stringify(v)); return v;
      case 'arr': {
        if (!Array.isArray(v)) return bad('esperava lista');
        return v.map((x, i) => {
          if (arg === 'str' || arg === 'int' || arg === 'num') return checkValue(arg, x, path + '[' + i + ']', ctx);
          return checkObject(SUB[arg], x, path + '[' + i + ']', ctx);
        });
      }
      case 'obj': return checkObject(SUB[arg], v, path, ctx);
      case 'map': {
        if (typeof v !== 'object' || Array.isArray(v)) return bad('esperava objeto');
        const out = {};
        for (const k of Object.keys(v)) {
          if (!RX.id.test(k)) { ctx.errors.push(path + ': chave inválida'); continue; }
          out[k] = checkObject(SUB[arg], v[k], path + '.' + k, ctx);
        }
        return out;
      }
      default: ctx.errors.push(path + ': tipo de esquema desconhecido'); return undefined;
    }
    function bad(msg) { ctx.errors.push(path + ': ' + (msg || 'tipo inválido, esperava ' + kind)); return undefined; }
  }

  function checkObject(fields, obj, path, ctx) {
    if (!fields) { ctx.errors.push(path + ': estrutura desconhecida'); return undefined; }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) { ctx.errors.push(path + ': esperava objeto'); return undefined; }
    const out = {};
    for (const k of Object.keys(obj)) {
      if (!(k in fields)) ctx.warnings.push(path + '.' + k + ': campo desconhecido ignorado');
    }
    for (const [k, spec] of Object.entries(fields)) out[k] = checkValue(spec, obj[k], path + '.' + k, ctx);
    return out;
  }

  // Valida um registro completo (BASE + campos do tipo).
  function validateRecord(rec, ctx, label) {
    label = label || 'registro';
    if (!rec || typeof rec !== 'object') { ctx.errors.push(label + ': não é um objeto'); return null; }
    const fields = TIPOS[rec.tipo];
    if (!fields) { ctx.errors.push(label + ': tipo desconhecido ' + JSON.stringify(rec.tipo)); return null; }
    const before = ctx.errors.length;
    const out = checkObject(Object.assign({}, BASE, fields), rec, label + ' (' + rec.tipo + ')', ctx);
    if (out && Array.isArray(out.diasSemana) && out.diasSemana.some(d => d < 0 || d > 6)) ctx.errors.push(label + ': diasSemana deve conter números de 0 (dom) a 6 (sáb)');
    return ctx.errors.length === before ? out : null;
  }

  // Migrações: chave = versão de origem; cada função converte o arquivo para a versão seguinte.
  const MIGRACOES = {
    // 1: arquivo => { ...arquivo, schemaVersion: 2 }
  };
  function migrar(arquivo, ctx) {
    let v = arquivo.schemaVersion;
    if (!Number.isInteger(v) || v < 1) { ctx.errors.push('schemaVersion ausente ou inválido'); return null; }
    if (v > SCHEMA_VERSION) { ctx.errors.push('Arquivo criado por uma versão mais nova do app (esquema ' + v + '). Atualize o app antes de importar.'); return null; }
    while (v < SCHEMA_VERSION) {
      const fn = MIGRACOES[v];
      if (!fn) { ctx.errors.push('Sem migração disponível do esquema ' + v); return null; }
      arquivo = fn(arquivo); v = arquivo.schemaVersion;
      ctx.warnings.push('Arquivo migrado para o esquema ' + v);
    }
    return arquivo;
  }

  function uuid() {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Valida e normaliza um registro antes de gravar (ordem de campos estável, opcionais ausentes = null).
  function normalizar(rec) {
    const ctx = { errors: [], warnings: [] };
    const out = validateRecord(rec, ctx);
    if (!out) throw new Error('Dado inválido: ' + ctx.errors.slice(0, 3).join('; '));
    return out;
  }

  HJ.schema = { normalizar, SCHEMA_VERSION, PERFIS, TIPOS, SUB, validateRecord, migrar, uuid, validDate };
})(typeof window !== 'undefined' ? (window.HJ = window.HJ || {}) : (globalThis.HJ = globalThis.HJ || {}));
