let locks=0;
let original='';
// Nested dialogs may unmount together in either order.
export function lockModalScroll(){
 const root=document.documentElement;
 if(locks++===0){original=root.style.overflow;root.style.overflow='hidden';}
 let released=false;
 return ()=>{if(released)return;released=true;if(--locks===0)root.style.overflow=original;};
}
