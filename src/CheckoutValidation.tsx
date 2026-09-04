import { useEffect } from 'react';
const MESSAGE = 'Você deixou este campo em branco, Parceiro/Parceira.';
function isCheckout() { return location.pathname === '/checkout'; }
function isField(element: EventTarget | null): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement { return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement; }
function validValue(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { return field.value.trim() !== ''; }
function clearFieldError(field: HTMLElement) { field.classList.remove('checkout-field-invalid'); field.closest('label')?.querySelector('.checkout-field-error')?.remove(); }
function showFieldError(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { clearFieldError(field); field.classList.add('checkout-field-invalid'); const wrapper = field.closest('label'); if (!wrapper) return; const message = document.createElement('span'); message.className = 'checkout-field-error'; message.textContent = MESSAGE; wrapper.appendChild(message); }
function isFinalizationButton(button: HTMLButtonElement) { const text = (button.textContent || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR'); return text.includes('finalizar pedido') || text.includes('confirmar pedido') || text.includes('registrar pedido') || button.classList.contains('checkout-confirm'); }
export default function CheckoutValidation() {
  useEffect(() => {
    if (!isCheckout()) return;
    const style = document.createElement('style'); style.id = 'checkout-validation-styles';
    style.textContent = `.checkout-page label em{display:none!important}.checkout-page .checkout-field-invalid{border-color:#c62828!important;box-shadow:0 0 0 2px rgba(198,40,40,.08)!important}.checkout-page .checkout-field-error{display:block;margin-top:6px;color:#c62828;font-size:12px;font-weight:700;line-height:1.35}`;
    document.head.appendChild(style);
    const validate = (event: Event) => {
      if (!isCheckout()) return;
      const target = event.target;
      if (event.type === 'click') {
        if (!(target instanceof Element)) return;
        const button = target.closest('button');
        if (!(button instanceof HTMLButtonElement) || !isFinalizationButton(button)) return;
      } else if (!(target instanceof HTMLFormElement) || !target.closest('.checkout-page')) return;
      const root = document.querySelector('.checkout-page'); if (!root) return;
      const fields = Array.from(root.querySelectorAll('input[required],select[required],textarea[required]')).filter(isField);
      const invalid = fields.filter(field => !validValue(field));
      if (!invalid.length) return;
      event.preventDefault(); event.stopImmediatePropagation(); invalid.forEach(showFieldError); invalid[0]?.focus();
    };
    const clearOnInput = (event: Event) => { if (!isField(event.target)) return; if (validValue(event.target)) clearFieldError(event.target); };
    document.addEventListener('submit', validate, true); document.addEventListener('click', validate, true); document.addEventListener('input', clearOnInput, true); document.addEventListener('change', clearOnInput, true);
    return () => { document.removeEventListener('submit', validate, true); document.removeEventListener('click', validate, true); document.removeEventListener('input', clearOnInput, true); document.removeEventListener('change', clearOnInput, true); style.remove(); };
  }, []);
  return null;
}
