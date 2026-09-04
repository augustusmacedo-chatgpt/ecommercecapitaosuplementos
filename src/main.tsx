import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './AdminRoute';
import CheckoutPage, { hasValidCheckoutSession } from './CheckoutPage';
import CheckoutIdentityPage from './CheckoutIdentityPage';
import ReconnectPage from './ReconnectPage';
import './styles.css';

function CheckoutFlowBridge() {
  useEffect(() => {
    const goToReconnectIfExpired = () => {
      if (location.pathname === '/checkout' && !hasValidCheckoutSession()) location.replace('/reconnect');
    };
    goToReconnectIfExpired();
    const timer = window.setInterval(goToReconnectIfExpired, 5000);

    if (location.pathname === '/') {
      const verifiedDocument = localStorage.getItem('capitao-verified-document');
      const verifiedEmail = localStorage.getItem('capitao-verified-email');
      const verifiedAt = localStorage.getItem('capitao-verified-at');
      if ((verifiedDocument || verifiedEmail) && !verifiedAt) {
        localStorage.setItem('capitao-verified-at', String(Date.now()));
        try { if (JSON.parse(localStorage.getItem('capitao-cart') || '[]').length) location.replace('/checkout'); } catch { /* ignore malformed cart */ }
      }
    }

    if (location.pathname !== '/') return () => window.clearInterval(timer);
    const updateCheckoutButton = () => {
      document.querySelectorAll<HTMLButtonElement>('.cart-checkout').forEach(button => {
        if (button.textContent !== 'IR PARA O CHECKOUT') button.textContent = 'IR PARA O CHECKOUT';
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
  if (location.pathname === '/cadastro') return <CheckoutIdentityPage />;
  return <Root />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
    <CheckoutFlowBridge />
  </StrictMode>,
);
