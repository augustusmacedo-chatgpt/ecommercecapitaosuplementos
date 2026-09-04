import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './AdminRoute';
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
    Object.assign(button.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      width: '100%',
      marginBottom: '24px',
      padding: '12px 16px',
      border: '1px solid #d6d6d6',
      borderRadius: '4px',
      background: '#fff',
      color: '#171717',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '.3px',
      cursor: 'pointer',
    });
    button.addEventListener('mouseenter', () => { button.style.background = '#f5f5f5'; });
    button.addEventListener('mouseleave', () => { button.style.background = '#fff'; });
    button.addEventListener('click', () => {
      if (document.referrer.startsWith(location.origin)) history.back();
      else location.href = '/';
    });
    card.insertBefore(button, card.firstChild);
  }, []);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
    <CheckoutBackButton />
  </StrictMode>,
);
