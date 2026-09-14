export function monthIndex(month:string){const [y,m]=month.split('-').map(Number);return y*12+m-1;}
export function monthlyShare(total:number,months:number,index:number){if(!Number.isSafeInteger(total)||total<0||!Number.isInteger(months)||months<1)throw new Error('分摊金额或月份无效');if(index<0||index>=months)return 0;return Math.floor(total/months)+(index<total%months?1:0);}
export function coverageEnd(start:string,months:number){const n=monthIndex(start)+months-1;return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;}
