/* H&J Health — Camada de PERSISTÊNCIA
 * IndexedDB com cache em memória. Toda a interface lê do cache e grava por aqui.
 * Para trocar por um serviço remoto no futuro, basta reimplementar este objeto com a mesma API.
 */
(function (HJ) {
  'use strict';
  const DB_NAME = 'hj-health';
  const DB_VERSION = 1;
  const S_REG = 'registros';
  const S_META = 'meta';

  let db = null;
  let modoMemoria = false;
  const cache = new Map();
  const meta = {};
  const ouvintes = new Set();

  function abrir() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB indisponível'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(S_REG)) {
          const s = d.createObjectStore(S_REG, { keyPath: 'id' });
          s.createIndex('perfil', 'perfil');
        }
        if (!d.objectStoreNames.contains(S_META)) d.createObjectStore(S_META, { keyPath: 'chave' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Banco bloqueado por outra aba aberta'));
    });
  }

  function tx(stores, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      const res = fn(t);
      t.oncomplete = () => resolve(res);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transação abortada'));
    });
  }

  function getAll(store) {
    return new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function notificar(tipo) { ouvintes.forEach(fn => { try { fn(tipo); } catch (e) { console.error(e); } }); }
  const agora = () => new Date().toISOString();

  const Store = {
    async init() {
      try {
        db = await abrir();
        (await getAll(S_REG)).forEach(r => cache.set(r.id, r));
        (await getAll(S_META)).forEach(m => { meta[m.chave] = m.valor; });
      } catch (e) {
        console.warn('Sem IndexedDB, usando memória:', e);
        modoMemoria = true;
      }
      return { modoMemoria };
    },
    get modoMemoria() { return modoMemoria; },
    onSalvo(fn) { ouvintes.add(fn); },

    get(id) { return cache.get(id) || null; },
    list(perfil, tipo, filtro) {
      const out = [];
      for (const r of cache.values()) {
        if (perfil && r.perfil !== perfil) continue;
        if (tipo && r.tipo !== tipo) continue;
        if (filtro && !filtro(r)) continue;
        out.push(r);
      }
      return out;
    },
    find(perfil, tipo, filtro) {
      for (const r of cache.values()) if (r.perfil === perfil && r.tipo === tipo && (!filtro || filtro(r))) return r;
      return null;
    },
    count() { return cache.size; },

    // Grava (cria ou atualiza). Preenche id, datas e fonte padrão.
    async put(rec) {
      const r = JSON.parse(JSON.stringify(rec));
      const t = agora();
      if (!r.id) r.id = HJ.schema.uuid();
      const antigo = cache.get(r.id);
      r.criadoEm = r.criadoEm || (antigo && antigo.criadoEm) || t;
      r.atualizadoEm = t;
      if (!r.fonte) r.fonte = 'usuario';
      const n = HJ.schema.normalizar(r);
      cache.set(n.id, n);
      try { if (!modoMemoria) await tx([S_REG], 'readwrite', x => x.objectStore(S_REG).put(n)); }
      catch (e) { if (antigo) cache.set(antigo.id, antigo); else cache.delete(n.id); throw e; }
      notificar('put');
      return n;
    },
    async remove(id) {
      cache.delete(id);
      if (!modoMemoria) await tx([S_REG], 'readwrite', x => x.objectStore(S_REG).delete(id));
      notificar('remove');
    },
    // Grava vários de uma vez, preservando as datas originais (usado na importação).
    async putMany(recs, { preservarDatas = true } = {}) {
      const t = agora();
      const lista = recs.map(r => {
        const c = JSON.parse(JSON.stringify(r));
        if (!preservarDatas) c.atualizadoEm = t;
        return c;
      });
      if (!modoMemoria) await tx([S_REG], 'readwrite', x => { const s = x.objectStore(S_REG); lista.forEach(r => s.put(r)); });
      lista.forEach(r => cache.set(r.id, r));
      notificar('putMany');
    },
    // Substitui todos os registros dos perfis informados por `recs`, numa única transação.
    async replacePerfis(perfis, recs) {
      const remover = [...cache.values()].filter(r => perfis.includes(r.perfil)).map(r => r.id);
      if (!modoMemoria) await tx([S_REG], 'readwrite', x => {
        const s = x.objectStore(S_REG);
        remover.forEach(id => s.delete(id));
        recs.forEach(r => s.put(r));
      });
      remover.forEach(id => cache.delete(id));
      recs.forEach(r => cache.set(r.id, JSON.parse(JSON.stringify(r))));
      notificar('replace');
    },
    async clearPerfil(perfil) { await this.replacePerfis([perfil], []); },
    async clearAll() {
      if (!modoMemoria) await tx([S_REG, S_META], 'readwrite', x => { x.objectStore(S_REG).clear(); x.objectStore(S_META).clear(); });
      cache.clear(); Object.keys(meta).forEach(k => delete meta[k]);
      notificar('clear');
    },
    dump(perfis) {
      return [...cache.values()].filter(r => !perfis || perfis.includes(r.perfil))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        .map(r => JSON.parse(JSON.stringify(r)));
    },

    getMeta(chave) { return meta[chave] === undefined ? null : meta[chave]; },
    async setMeta(chave, valor) {
      meta[chave] = valor;
      if (!modoMemoria) await tx([S_META], 'readwrite', x => x.objectStore(S_META).put({ chave, valor }));
    }
  };

  // Preferências simples do aparelho (não são dados de saúde).
  const Prefs = {
    get(k, padrao) { try { const v = localStorage.getItem('hj.' + k); return v === null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
    set(k, v) { try { localStorage.setItem('hj.' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  };

  HJ.Store = Store;
  HJ.Prefs = Prefs;
})(window.HJ = window.HJ || {});
