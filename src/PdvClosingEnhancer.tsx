import { useEffect } from 'react';
import { KLAUS_MESSAGES, REBECA_MESSAGES } from './pdvMotivacao';

const RAW = 'https://raw.githubusercontent.com/augustusmacedo-chatgpt/ecommercecapitaosuplementos/principal/p%C3%BAblico/';
const CHARACTERS = {
  klaus: [
    `${RAW}KLAUS%20POSE%201.png`,
    `${RAW}KLAUS%20POSE%202.png`,
    `${RAW}KLAUS%20POSE%203.png`,
  ],
  rebeca: [
    `${RAW}REBECA%20POSE%201.png`,
    `${RAW}REBECA%20POSE%202.png`,
    `${RAW}REBECA%20POSE%203.png`,
  ],
};

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function enhanceClosing() {
  if (location.pathname !== '/pdv') return;
  const panel = document.querySelector<HTMLElement>('.pdv-message');
  if (!panel || panel.dataset.capitaoEnhanced === 'true') return;

  const character = Math.random() < 0.5 ? 'klaus' : 'rebeca';
  const pose = Math.floor(Math.random() * 3);
  const image = panel.querySelector<HTMLImageElement>('.char img');
  const quote = panel.querySelector<HTMLElement>('blockquote');
  if (!image || !quote) return;

  image.src = CHARACTERS[character][pose];
  image.alt = character === 'klaus' ? 'Klaus — Capitão Suplementos' : 'Rebeca — Capitão Suplementos';
  image.referrerPolicy = 'no-referrer';
  quote.textContent = pick(character === 'klaus' ? KLAUS_MESSAGES : REBECA_MESSAGES);
  panel.dataset.capitaoEnhanced = 'true';
  panel.dataset.capitaoCharacter = character;
  panel.dataset.capitaoPose = String(pose + 1);
}

export default function PdvClosingEnhancer() {
  useEffect(() => {
    enhanceClosing();
    const observer = new MutationObserver(enhanceClosing);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
