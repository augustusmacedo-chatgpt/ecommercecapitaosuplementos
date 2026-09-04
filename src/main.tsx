import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './AdminRoute';
import CheckoutPage, { hasValidCheckoutSession } from './CheckoutPage';
import CheckoutIdentityPage from './CheckoutIdentityPage';
import CheckoutValidation from './CheckoutValidation';
import OrderPage from './OrderPage';
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
    const updateCheckoutButton = () => {
      document.querySelectorAll<HTMLButtonElement>('.cart-checkout').forEach(button => {
        if (button.textContent !== 'IR PARA O CHECKOUT') button.textContent = 'IR PARA O CHECKOUT';
        if (button.dataset.checkoutBound === 'true') return;
        button.dataset.checkoutBound = 'true';
        button.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); location.href = hasValidCheckoutSession() ? '/checkout' : '/cadastro'; }, true);
      });
    };
    const updateOrderActions = () => {
      if (location.pathname !== '/checkout') return;
      const success = document.querySelector<HTMLElement>('.checkout-success');
      const continueButton = success?.querySelector<HTMLAnchorElement>('a.checkout-primary');
      if (!success || !continueButton) return;
      continueButton.textContent = 'CONTINUAR COMPRANDO';
      if (success.querySelector('.checkout-view-order')) return;
      const viewOrder = document.createElement('a');
      viewOrder.href = '/pedido'; viewOrder.className = 'checkout-primary checkout-view-order'; viewOrder.textContent = 'VER PEDIDO'; viewOrder.setAttribute('aria-label', 'Ver pedido');
      success.insertBefore(viewOrder, continueButton);
      if (!document.getElementById('checkout-order-action-styles')) {
        const style = document.createElement('style'); style.id = 'checkout-order-action-styles';
        style.textContent = '.checkout-success .checkout-view-order{margin-bottom:10px;background:#b57d18!important;color:#fff!important}.checkout-success .checkout-primary:not(.checkout-view-order){border:1px solid #171717;background:#fff!important;color:#171717!important}';
        document.head.appendChild(style);
      }
    };
    updateCheckoutButton(); updateOrderActions();
    if (location.pathname === '/') {
      const observer = new MutationObserver(updateCheckoutButton); observer.observe(document.body, { childList: true, subtree: true });
      return () => { observer.disconnect(); window.clearInterval(timer); };
    }
    const observer = new MutationObserver(updateOrderActions); observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, []);
  return null;
}
function Page() {
  if (location.pathname === '/checkout') return hasValidCheckoutSession() ? <CheckoutPage /> : <ReconnectPage />;
  if (location.pathname === '/reconnect') return <ReconnectPage />;
  if (location.pathname === '/cadastro') return <CheckoutIdentityPage />;
  if (location.pathname === '/pedido') return <OrderPage />;
  return <Root />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Page /><CheckoutValidation /><CheckoutFlowBridge /></StrictMode>);
