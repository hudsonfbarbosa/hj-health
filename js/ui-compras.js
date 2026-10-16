/* H&J Health — RECEITAS E LISTA DE COMPRAS */
(function (HJ) {
  'use strict';
  const { UI, L, Store: S } = HJ;
  const { esc, icon } = UI;
  let aba = 'lista';
  const CATS = ['Proteínas', 'Hortifruti', 'Mercearia', 'Laticínios', 'Padaria', 'Outros'];
  const RX_UN = '(kg|g|mg|ml|l|un|unidades?|fatias?|colheres? de sopa|colheres? de chá|dúzias?|pacotes?|latas?|potes?|maços?|dentes?)';

  // "1,5 kg Batata" -> {quantidade:1.5, unidade:'kg', nome:'Batata'}; "Cebola" -> sem quantidade.
  function parseLinha(txt) {
    const t = txt.trim(); if (!t) return null;
    const m = t.match(new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*' + RX_UN + '?\\s+(.+)$', 'i'));
    if (m) return { quantidade: L.parseNum(m[1]), unidade: m[2] ? m[2].toLowerCase() : null, nome: m[3].trim() };
    return { quantidade: null, unidade: null, nome: t };
  }
  const linhaTexto = i => (i.quantidade !== null ? L.fmtNum(i.quantidade, 3) + ' ' + (i.unidade ? i.unidade + ' ' : '') : '') + i.nome;
  const qtdTexto = i => (i.quantidade !== null ? L.fmtNum(i.quantidade, 3) + (i.unidade ? ' ' + i.unidade : '') : '') + (i.semQuantidade ? (i.quantidade !== null ? ' + ' : '') + 'quantidade não informada' : '');

  function lista(p) {
    let l = S.find(p, 'listaCompras');
    return l;
  }
  async function garantirLista(p) {
    return lista(p) || S.put({ tipo: 'listaCompras', perfil: p, nome: 'Compras da semana', itens: [] });
  }
  async function addItens(p, itens) {
    const l = JSON.parse(JSON.stringify(await garantirLista(p)));
    itens.forEach(i => l.itens.push({ id: HJ.schema.uuid(), nome: i.nome, quantidade: i.quantidade, unidade: i.unidade, categoria: i.categoria || 'Outros', marcado: false, origem: i.origem || null }));
    await S.put(l);
  }

  function listaHTML(p) {
    const l = lista(p);
    const rec = S.list(p, 'receita');
    const tags = [...new Set(rec.flatMap(r => r.tags))].sort();
    let h = '<div class="card no-print"><div class="card-head"><h2>Adicionar</h2></div><div class="btns">' +
      tags.map(t => '<button class="btn sm" type="button" data-a="addTag" data-v="' + esc(t) + '">' + icon('plus', 'sm') + 'Receitas: ' + esc(t) + '</button>').join('') +
      '<button class="btn sm" type="button" data-a="addManual">' + icon('plus', 'sm') + 'Item avulso</button></div></div>';
    const agg = l ? L.agregarIngredientes(l.itens) : [];
    h += '<div class="card"><div class="card-head"><h2>' + esc(l ? l.nome : 'Lista de compras') + '</h2><span class="meta">' + agg.filter(x => x.marcado).length + ' de ' + agg.length + '</span></div>';
    if (!agg.length) return h + '<p class="empty">Lista vazia. Adicione receitas do lote ou itens avulsos.</p></div>';
    const porCat = {};
    agg.forEach(x => { (porCat[x.categoria] = porCat[x.categoria] || []).push(x); });
    Object.keys(porCat).sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b)).forEach(c => {
      h += '<h3 style="margin:12px 0 4px">' + esc(c) + '</h3><div class="list">' + porCat[c].map(x =>
        '<div class="row"><button type="button" class="check" data-a="marcar" data-v="' + x.ids.join(',') + '" aria-pressed="' + x.marcado + '" aria-label="' + esc(x.nome) + (x.marcado ? ': comprado' : ': marcar como comprado') + '">' + icon('check') + '</button>' +
        '<div class="grow"><div class="title"' + (x.marcado ? ' style="text-decoration:line-through;color:var(--text-2)"' : '') + '>' + esc(x.nome) + '</div><div class="desc">' + esc(qtdTexto(x)) + (x.origem ? ' · ' + esc(x.origem) : '') + '</div></div>' +
        '<button class="btn ghost icon no-print" type="button" data-a="rmItem" data-v="' + x.ids.join(',') + '" aria-label="Remover ' + esc(x.nome) + '">' + icon('x', 'sm') + '</button></div>').join('') + '</div>';
    });
    h += '<p class="muted tiny" style="margin-top:10px">Quantidades só são somadas quando as unidades são compatíveis (g com kg, ml com l). Unidades diferentes aparecem em linhas separadas.</p>' +
      '<div class="btns no-print" style="margin-top:12px"><button class="btn sm" type="button" data-a="imprimir">' + icon('imprimir', 'sm') + 'Imprimir</button><button class="btn sm" type="button" data-a="limparMarcados">Remover comprados</button><button class="btn sm danger" type="button" data-a="limparTudo">Esvaziar lista</button></div></div>';
    return h;
  }

  function receitasHTML(p) {
    const rec = S.list(p, 'receita').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    let h = '<div class="btns"><button class="btn sm" type="button" data-a="novaRec">' + icon('plus', 'sm') + 'Nova receita</button></div>';
    if (!rec.length) return h + '<p class="empty">Nenhuma receita.</p>';
    return h + rec.map(r => '<div class="card"><div class="card-head"><div><h2>' + esc(r.nome) + ' ' + UI.fonte(r.fonte) + '</h2><p class="muted small">' + (r.rendimento ? 'Rende: ' + esc(r.rendimento) : '') + (r.tags.length ? ' · ' + r.tags.map(esc).join(', ') : '') + '</p></div>' +
      '<button class="btn sm" type="button" data-a="editRec" data-id="' + r.id + '">' + icon('editar', 'sm') + 'Editar</button></div>' +
      '<ul style="margin:0 0 8px;padding-left:18px">' + r.ingredientes.map(i => '<li>' + esc(i.nome) + (i.quantidade !== null ? ' — ' + L.fmtNum(i.quantidade, 3) + ' ' + esc(i.unidade || '') : ' — <span class="muted">a gosto / não informado</span>') + '</li>').join('') + '</ul>' +
      (r.preparo ? '<p class="small">' + esc(r.preparo) + '</p>' : '') +
      '<div class="btns" style="margin-top:10px"><button class="btn sm" type="button" data-a="addRec" data-id="' + r.id + '">' + icon('compras', 'sm') + 'Adicionar à lista</button></div></div>').join('');
  }

  UI.route('compras', {
    titulo: 'Receitas e compras',
    render() {
      const p = UI.state.perfil;
      return '<div class="page-head"><div><h1>Receitas e compras</h1><div class="sub">' + esc(UI.nomePerfil()) + '</div></div></div>' +
        '<div class="no-print">' + UI.tabs([['lista', 'Lista de compras'], ['receitas', 'Receitas']], aba, 'aba') + '</div>' +
        '<p class="print-only">Lista de compras · ' + esc(UI.nomePerfil()) + ' · ' + L.fmtData(L.hoje()) + '</p>' +
        (aba === 'lista' ? listaHTML(p) : receitasHTML(p));
    },
    acoes: {
      aba(ds) { aba = ds.v; UI.render(true); },
      addTag(ds) {
        const p = UI.state.perfil;
        const itens = S.list(p, 'receita', r => r.tags.includes(ds.v)).flatMap(r => r.ingredientes.map(i => Object.assign({}, i, { origem: r.nome })));
        UI.agir(async () => { await addItens(p, itens); UI.toast(itens.length + ' ingrediente(s) adicionados.'); });
      },
      addRec(ds) {
        const r = S.get(ds.id);
        UI.agir(async () => { await addItens(UI.state.perfil, r.ingredientes.map(i => Object.assign({}, i, { origem: r.nome }))); UI.toast('Ingredientes de "' + r.nome + '" adicionados à lista.'); });
      },
      addManual() {
        UI.form({ titulo: 'Item avulso', duasColunas: true,
          campos: [{ k: 'nome', label: 'Item', req: true, span2: true }, { k: 'quantidade', label: 'Quantidade', tipo: 'number', min: 0 }, { k: 'unidade', label: 'Unidade', lista: ['g', 'kg', 'ml', 'l', 'un'] }, { k: 'categoria', label: 'Categoria', tipo: 'select', req: true, opcoes: CATS.map(c => [c, c]) }],
          valores: { categoria: 'Outros' }, salvar: 'Adicionar',
          onSalvar: v => addItens(UI.state.perfil, [v]) });
      },
      marcar(ds) {
        const ids = ds.v.split(',');
        const l = JSON.parse(JSON.stringify(lista(UI.state.perfil)));
        const todos = l.itens.filter(i => ids.includes(i.id));
        const novo = !todos.every(i => i.marcado);
        todos.forEach(i => { i.marcado = novo; });
        UI.agir(() => S.put(l));
      },
      rmItem(ds) { const ids = ds.v.split(','); const l = JSON.parse(JSON.stringify(lista(UI.state.perfil))); l.itens = l.itens.filter(i => !ids.includes(i.id)); UI.agir(() => S.put(l)); },
      limparMarcados() { const l = JSON.parse(JSON.stringify(lista(UI.state.perfil))); l.itens = l.itens.filter(i => !i.marcado); UI.agir(() => S.put(l)); },
      async limparTudo() {
        if (!await UI.confirmar({ titulo: 'Esvaziar a lista?', texto: 'Todos os itens serão removidos.', ok: 'Esvaziar', perigo: true })) return;
        const l = JSON.parse(JSON.stringify(lista(UI.state.perfil))); l.itens = []; UI.agir(() => S.put(l));
      },
      imprimir() { window.print(); },
      novaRec() { editarRec(null); },
      editRec(ds) { editarRec(S.get(ds.id)); }
    }
  });

  function editarRec(r) {
    UI.form({ titulo: r ? 'Editar receita' : 'Nova receita',
      campos: [{ k: 'nome', label: 'Nome', req: true }, { k: 'rendimento', label: 'Rendimento', ph: 'Ex.: 4 marmitas' },
        { k: 'ingredientes', label: 'Ingredientes (um por linha)', tipo: 'textarea', req: true, help: 'Formato: quantidade, unidade e nome. Ex.: "500 g Feijão", "1,5 kg Batata", "Cebola" (sem quantidade).' },
        { k: 'categoriaPadrao', label: 'Categoria para ingredientes novos', tipo: 'select', req: true, opcoes: CATS.map(c => [c, c]) },
        { k: 'preparo', label: 'Modo de preparo', tipo: 'textarea' }, { k: 'tags', label: 'Etiquetas (separadas por vírgula)', ph: 'sábado, lote' }],
      valores: r ? { nome: r.nome, rendimento: r.rendimento, ingredientes: r.ingredientes.map(linhaTexto).join('\n'), categoriaPadrao: 'Outros', preparo: r.preparo, tags: r.tags.join(', ') } : { categoriaPadrao: 'Outros' },
      onSalvar: v => {
        const ants = r ? r.ingredientes : [];
        const ing = v.ingredientes.split('\n').map(parseLinha).filter(Boolean).map(i => {
          if (Number.isNaN(i.quantidade)) throw new Error('Quantidade inválida em "' + i.nome + '".');
          const ant = ants.find(a => a.nome.toLowerCase() === i.nome.toLowerCase());
          return Object.assign(i, { categoria: ant ? ant.categoria : v.categoriaPadrao });
        });
        if (!ing.length) throw new Error('Inclua ao menos um ingrediente.');
        const tags = (v.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        return S.put(Object.assign(r ? JSON.parse(JSON.stringify(r)) : { tipo: 'receita', perfil: UI.state.perfil, fonte: 'usuario' }, { nome: v.nome, rendimento: v.rendimento, ingredientes: ing, preparo: v.preparo, tags }));
      },
      onExcluir: r ? () => S.remove(r.id) : null });
  }
})(window.HJ);
