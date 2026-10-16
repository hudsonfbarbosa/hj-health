/* H&J Health — inicialização */
(function (HJ) {
  'use strict';
  const { UI, L, Store, Prefs } = HJ;

  async function iniciar() {
    UI.aplicarTema();
    await Store.init();
    const padrao = Prefs.get('perfilPadrao', null);
    UI.state.perfil = HJ.schema.PERFIS.includes(padrao) ? padrao : (Prefs.get('perfilAtivo', 'hudson') === 'joice' ? 'joice' : 'hudson');
    UI.state.data = L.hoje();
    UI.init();
    UI.render();

    // Virada do dia com o app aberto: se estava em "hoje", acompanha a nova data.
    let ultimoHoje = L.hoje();
    const checarDia = () => {
      const h = L.hoje();
      if (h !== ultimoHoje) { if (UI.state.data === ultimoHoje) UI.state.data = h; ultimoHoje = h; if (!document.getElementById('dlg').open) UI.render(true); }
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checarDia(); });
    setInterval(checarDia, 60000);

    if (navigator.storage && navigator.storage.persisted) {
      try { const ok = await navigator.storage.persisted(); if (ok) await Store.setMeta('persistencia', 'concedida'); } catch (e) { /* ignorado */ }
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (w) w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) UI.toast('Nova versão disponível.', { acao: { texto: 'Atualizar', fn: () => w.postMessage('atualizar') }, dur: 15000 });
          });
        });
      }).catch(e => console.warn('Service worker não registrado:', e));
      let recarregou = false;
      const tinhaControle = !!navigator.serviceWorker.controller; // na 1ª instalação não recarrega
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle && !recarregou) { recarregou = true; location.reload(); } });
    }
  }

  window.addEventListener('error', e => { console.error(e.error || e.message); });
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); UI.toast('Erro inesperado: ' + ((e.reason && e.reason.message) || e.reason), { erro: true }); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window.HJ);
