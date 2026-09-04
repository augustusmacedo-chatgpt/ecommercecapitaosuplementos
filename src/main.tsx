import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './AdminRoute';
import CheckoutPage, { hasValidCheckoutSession } from './CheckoutPage';
import ReconnectPage from './ReconnectPage';
import './styles.css';

function CheckoutBackButton() {
  useEffect(() => {
    if (location.pathname !== '/cadastro') return;
    const card = document.querySelector('.identity-card');
    if (!card || card.querySelector('[data-checkout-back]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-checkout-back', 'true');
    button.setAttribute('aria-label', 'Voltar para a compra');
    button.textContent = '← VOLTAR PARA A COMPRA';
    Object.assign(button.style, { display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%', marginBottom:'24px', padding:'12px 16px', border:'1px solid #d6d6d6', borderRadius:'4px', background:'#fff', color:'#171717', fontSize:'13px', fontWeight:'700', letterSpacing:'.3px', cursor:'pointer' });
    button.addEventListener('mouseenter', () => { button.style.background = '#f5f5f5'; });
    button.addEventListener('mouseleave', () => { button.style.background = '#fff'; });
    button.addEventListener('click', () => { if (document.referrer.startsWith(location.origin)) history.back(); else location.href = '/'; });
    card.insertBefore(button, card.firstChild);
  }, []);
  return null;
}

function CheckoutFlowBridge() {
  useEffect(() => {
    const goToReconnectIfExpired = () => {
      if (location.pathname === '/checkout' && !hasValidCheckoutSession()) location.replace('/reconnect');
    };
    goToReconnectIfExpired();
    const timer = window.setInterval(goToReconnectIfExpired, 5000);

    if (location.pathname === '/') {
      const verifiedDocument = localStorage.getItem('capitao-verified-document');
      const verifiedAt = localStorage.getItem('capitao-verified-at');
      if (verifiedDocument && !verifiedAt) {
        localStorage.setItem('capitao-verified-at', String(Date.now()));
        try { if (JSON.parse(localStorage.getItem('capitao-cart') || '[]').length) location.replace('/checkout'); } catch { /* ignore malformed cart */ }
      }
    }

    if (location.pathname !== '/') return () => window.clearInterval(timer);
    const updateCheckoutButton = () => {
      document.querySelectorAll<HTMLButtonElement>('.cart-checkout').forEach(button => {
        button.textContent = 'IR PARA O CHECKOUT';
        if (button.dataset.checkoutBound === 'true') return;
        button.dataset.checkoutBound = 'true';
        button.addEventListener('click', event => {
          event.preventDefault(); event.stopImmediatePropagation();
          location.href = hasValidCheckoutSession() ? '/checkout' : '/cadastro';
        }, true);
      });
    };
    updateCheckoutButton();
    const observer = new MutationObserver(updateCheckoutButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, []);
  return null;
}

function Page() {
  if (location.pathname === '/checkout') return hasValidCheckoutSession() ? <CheckoutPage /> : <ReconnectPage />;
  if (location.pathname === '/reconnect') return <ReconnectPage />;
  return <Root />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
    <CheckoutBackButton />
    <CheckoutFlowBridge />
  </StrictMode>,
);
