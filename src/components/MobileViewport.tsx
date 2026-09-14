'use client';
import {useI18n} from './LanguageProvider';
import {useEffect} from 'react';

// Safari resizes its visual viewport rather than the layout when the keyboard opens.
export function MobileViewport(){const {t:tr,locale}=useI18n();
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  const update=()=>{
   const editing=document.activeElement?.matches('input,textarea,[contenteditable="true"]');
   const keyboard=window.innerWidth<=730&&!!editing&&window.innerHeight-viewport.height>120;
   document.documentElement.toggleAttribute('data-keyboard',keyboard);
   document.documentElement.style.setProperty('--visible-height',`${viewport.height}px`);
   document.documentElement.style.setProperty('--keyboard-inset',`${Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)}px`);
  };
  let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
  viewport.addEventListener('resize',schedule);
  viewport.addEventListener('scroll',schedule);
  document.addEventListener('focusin',schedule);
  document.addEventListener('focusout',schedule);
  update();
  return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',schedule);viewport.removeEventListener('scroll',schedule);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule);document.documentElement.removeAttribute('data-keyboard');document.documentElement.style.removeProperty('--visible-height');document.documentElement.style.removeProperty('--keyboard-inset');};
 },[]);
 return null;
}
