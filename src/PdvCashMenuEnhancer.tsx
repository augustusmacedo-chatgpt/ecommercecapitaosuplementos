import { useEffect } from 'react';

export default function PdvCashMenuEnhancer(){
  useEffect(()=>{
    if(location.pathname!=='/pdv') return;
    let observer:MutationObserver|null=null;
    const inject=()=>{
      const menu=document.querySelector<HTMLElement>('.pdv-menu');
      if(!menu) return;
      const add=(key:string,label:string,icon:string,eventName:string)=>{
        if(menu.querySelector(`[data-pdv-cash="${key}"]`)) return;
        const button=document.createElement('button');
        button.type='button';button.dataset.pdvCash=key;button.innerHTML=`<span style="display:inline-flex;align-items:center;justify-content:center;width:18px">${icon}</span><span>${label}</span>`;
        button.addEventListener('click',()=>window.dispatchEvent(new CustomEvent(eventName)));
        menu.appendChild(button);
      };
      add('handoff','TROCA DE CAIXA','⇄','pdv-cash-handoff');
      add('close','FECHAMENTO TOTAL DO CAIXA','▣','pdv-cash-close');
    };
    inject();observer=new MutationObserver(inject);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer?.disconnect();
  },[]);
  return null;
}
