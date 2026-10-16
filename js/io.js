/* H&J Health — Camada de IMPORTAÇÃO / EXPORTAÇÃO
 * Arquivos são lidos só com JSON.parse e validados campo a campo. Nada do arquivo é executado.
 */
(function (HJ) {
  'use strict';
  const LIMITE_BYTES = 25 * 1024 * 1024;
  const NOMES = { hudson: 'Hudson', joice: 'Joice' };

  function exportarBackup(perfis) {
    perfis = perfis || HJ.schema.PERFIS.slice();
    return {
      app: 'hj-health', tipoArquivo: 'backup', schemaVersion: HJ.schema.SCHEMA_VERSION,
      exportadoEm: new Date().toISOString(), perfis, registros: HJ.Store.dump(perfis)
    };
  }

  // Analisa o texto de um arquivo. Não altera nada. Retorna o que seria importado.
  function analisar(texto, tamanho) {
    const ctx = { errors: [], warnings: [] };
    const res = { ok: false, ctx, tipoArquivo: null, perfis: [], registros: [], porPerfil: {} };
    if (tamanho > LIMITE_BYTES) { ctx.errors.push('Arquivo grande demais (limite de 25 MB).'); return res; }
    let obj;
    try { obj = JSON.parse(texto); } catch (e) { ctx.errors.push('O arquivo não é um JSON válido. Ele pode estar corrompido ou incompleto.'); return res; }
    if (!obj || typeof obj !== 'object' || obj.app !== 'hj-health') { ctx.errors.push('Este arquivo não foi gerado pelo H&J Health.'); return res; }
    if (!['seed', 'backup'].includes(obj.tipoArquivo)) { ctx.errors.push('Tipo de arquivo desconhecido: ' + JSON.stringify(obj.tipoArquivo)); return res; }
    obj = HJ.schema.migrar(obj, ctx);
    if (!obj) return res;
    if (!Array.isArray(obj.registros)) { ctx.errors.push('O arquivo não contém a lista de registros.'); return res; }
    res.tipoArquivo = obj.tipoArquivo;
    const ids = new Set();
    obj.registros.forEach((r, i) => {
      const v = HJ.schema.validateRecord(r, ctx, 'Registro ' + (i + 1));
      if (!v) return;
      if (ids.has(v.id)) { ctx.errors.push('Registro ' + (i + 1) + ': identificador repetido'); return; }
      if (obj.tipoArquivo === 'seed' && v.perfil !== obj.perfil) { ctx.errors.push('Registro ' + (i + 1) + ': perfil diferente do arquivo'); return; }
      ids.add(v.id);
      res.registros.push(v);
    });
    if (ctx.errors.length) { res.registros = []; return res; }
    res.registros.forEach(r => {
      const p = res.porPerfil[r.perfil] || (res.porPerfil[r.perfil] = { total: 0, tipos: {} });
      p.total++; p.tipos[r.tipo] = (p.tipos[r.tipo] || 0) + 1;
    });
    res.perfis = Object.keys(res.porPerfil);
    if (!res.perfis.length && obj.tipoArquivo === 'seed') { ctx.errors.push('O arquivo não tem registros.'); return res; }
    if (obj.tipoArquivo === 'backup' && Array.isArray(obj.perfis)) {
      res.perfisDeclarados = obj.perfis.filter(p => HJ.schema.PERFIS.includes(p));
      res.perfisDeclarados.forEach(p => { if (!res.perfis.includes(p)) res.perfis.push(p); });
    }
    res.exportadoEm = obj.exportadoEm || obj.geradoEm || null;
    res.descricao = typeof obj.descricao === 'string' ? obj.descricao.slice(0, 300) : null;
    res.ok = true;
    return res;
  }

  // Quantos registros do aparelho seriam afetados.
  function impacto(analise, perfis) {
    const ids = new Set(analise.registros.filter(r => perfis.includes(r.perfil)).map(r => r.id));
    if (analise.tipoArquivo === 'seed') {
      const sobrescritos = [...ids].filter(id => HJ.Store.get(id)).length;
      return { modo: 'mesclar', novos: ids.size - sobrescritos, sobrescritos, removidos: 0 };
    }
    const atuais = HJ.Store.list(null, null, r => perfis.includes(r.perfil));
    return { modo: 'substituir', novos: ids.size, sobrescritos: 0, removidos: atuais.length };
  }

  async function aplicar(analise, perfis) {
    const recs = analise.registros.filter(r => perfis.includes(r.perfil));
    if (analise.tipoArquivo === 'seed') await HJ.Store.putMany(recs);
    else await HJ.Store.replacePerfis(perfis, recs);
    return recs.length;
  }

  // Entrega um arquivo: baixa (padrão) ou abre a folha de compartilhamento do iPhone.
  async function entregarArquivo(nome, texto, mime, viaCompartilhar) {
    const blob = new Blob([texto], { type: mime });
    if (viaCompartilhar && navigator.canShare) {
      const file = new File([blob], nome, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nome }); return 'compartilhado'; }
        catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'baixado';
  }

  function lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(file);
    });
  }

  HJ.IO = { exportarBackup, analisar, impacto, aplicar, entregarArquivo, lerArquivo, NOMES };
})(window.HJ = window.HJ || {});
