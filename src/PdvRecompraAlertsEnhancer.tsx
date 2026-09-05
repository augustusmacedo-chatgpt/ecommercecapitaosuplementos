import { useEffect } from 'react';
import { BellRing, PhoneCall, MessageCircle, X } from 'lucide-react';

const DEMO_ALERTS = [
  { customer: 'Aguardando dados do cliente', product: 'Produto em análise', days: 5, stage: 'PRÓXIMA MENSAGEM' },
];

export default function PdvRecompraAlertsEnhancer() {
  useEffect(() => {
    if (location.pathname !== '/pdv') return;

    let overlay: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;

    const closePanel = () => {
      overlay?.remove();
      overlay = null;
    };

    const openPanel = () => {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'pdv-recompra-overlay';
      overlay.innerHTML = `
        <div class="pdv-recompra-panel">
          <div class="pdv-recompra-head">
            <div><span>VIGIA • RELACIONAMENTO</span><h2>ALERTAS DE RECOMPRA</h2><p>Clientes próximos do fim estimado de consumo.</p></div>
            <button data-close aria-label="Fechar"><span>×</span></button>
          </div>
          <div class="pdv-recompra-flow">
            <div class="pdv-recompra-step"><b>D-5</b><span>WhatsApp 1</span></div>
            <div class="pdv-recompra-step"><b>D-3</b><span>WhatsApp 2</span></div>
            <div class="pdv-recompra-step urgent"><b>D-1</b><span>Ligação do vendedor</span></div>
          </div>
          <div class="pdv-recompra-list">
            ${DEMO_ALERTS.map(item => `
              <div class="pdv-recompra-card">
                <div class="pdv-recompra-icon"><span>⚓</span></div>
                <div class="pdv-recompra-info"><strong>${item.customer}</strong><b>${item.product}</b><small>${item.days} dias • ${item.stage}</small></div>
                <div class="pdv-recompra-actions"><button data-action="whatsapp"><span>◉</span> WhatsApp</button><button data-action="call"><span>☎</span> Ligar</button></div>
              </div>`).join('')}
          </div>
          <div class="pdv-recompra-note"><b>Motor de consumo</b><span>Os alertas reais serão alimentados pelo histórico de vendas, consumo estimado por produto e recompra do cliente. O sistema deve alertar somente o produto identificado como próximo de acabar.</span></div>
        </div>`;

      const style = document.createElement('style');
      style.id = 'pdv-recompra-alerts-style';
      style.textContent = `
        .pdv-recompra-overlay{position:fixed;inset:0;background:#000b;z-index:100;display:flex;justify-content:flex-end}.pdv-recompra-panel{width:min(760px,100%);height:100%;background:#111;color:#f5f2ea;border-left:1px solid #3a3730;box-shadow:-20px 0 60px #0008;padding:28px;overflow:auto;font-family:Inter,system-ui,sans-serif}.pdv-recompra-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #302e29;padding-bottom:20px}.pdv-recompra-head span{font-size:9px;letter-spacing:1.7px;color:#a9823b;font-weight:900}.pdv-recompra-head h2{margin:7px 0 4px;font-size:22px;letter-spacing:.5px}.pdv-recompra-head p{margin:0;color:#918e86;font-size:11px}.pdv-recompra-head button{width:40px;height:40px;border:1px solid #3b3933;background:#1a1917;color:#fff;border-radius:8px;cursor:pointer;font-size:24px}.pdv-recompra-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.pdv-recompra-step{padding:14px;border:1px solid #36332d;background:#181816;border-radius:9px}.pdv-recompra-step b{display:block;font-size:15px;color:#c19345}.pdv-recompra-step span{display:block;margin-top:4px;font-size:10px;color:#aaa}.pdv-recompra-step.urgent{border-color:#76502a}.pdv-recompra-list{display:grid;gap:10px}.pdv-recompra-card{display:flex;align-items:center;gap:14px;padding:15px;border:1px solid #36332d;background:#171715;border-radius:10px}.pdv-recompra-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#241d12;color:#c19345}.pdv-recompra-info{flex:1}.pdv-recompra-info strong,.pdv-recompra-info b{display:block;font-size:12px}.pdv-recompra-info b{margin-top:4px;color:#d4cfc4}.pdv-recompra-info small{display:block;margin-top:6px;color:#8f8b83;font-size:9px}.pdv-recompra-actions{display:flex;gap:7px}.pdv-recompra-actions button{border:1px solid #3c3932;background:#211f1c;color:#eee;border-radius:7px;padding:9px 11px;font-size:9px;font-weight:800;cursor:pointer}.pdv-recompra-actions button:hover{border-color:#a9823b}.pdv-recompra-note{margin-top:18px;padding:15px;border:1px dashed #49443a;background:#151412;border-radius:9px}.pdv-recompra-note b{display:block;font-size:10px;color:#c19345;margin-bottom:6px}.pdv-recompra-note span{display:block;color:#918d84;font-size:10px;line-height:1.5}.pdv-recompra-actions button[data-action="call"]{color:#d9c28f}.pdv-recompra-actions button[data-action="whatsapp"]{color:#b8d1bd}@media(max-width:700px){.pdv-recompra-panel{padding:18px}.pdv-recompra-flow{grid-template-columns:1fr}.pdv-recompra-card{align-items:flex-start;flex-wrap:wrap}.pdv-recompra-actions{width:100%}.pdv-recompra-actions button{flex:1}}
      `;
      document.head.appendChild(style);
      document.body.appendChild(overlay);
      overlay.querySelector('[data-close]')?.addEventListener('click', closePanel);
      overlay.addEventListener('click', event => { if (event.target === overlay) closePanel(); });
    };

    const injectMenuItem = () => {
      const menu = document.querySelector<HTMLElement>('.pdv-menu');
      if (!menu || menu.querySelector('[data-pdv-recompra-alerts]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.pdvRecompraAlerts = 'true';
      button.innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px">◉</span><span>ALERTAS DE RECOMPRA</span>';
      button.addEventListener('click', openPanel);
      menu.appendChild(button);
    };

    injectMenuItem();
    observer = new MutationObserver(injectMenuItem);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      closePanel();
      document.getElementById('pdv-recompra-alerts-style')?.remove();
    };
  }, []);

  return null;
}
