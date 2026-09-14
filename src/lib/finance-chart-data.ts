export function financeChartData(data:{categories:{name:string;value:number}[];daily:{date:string;income:number;expense:number}[]},dimension:string,from:string,to:string){
 if(dimension==='category')return data.categories.map(d=>({name:d.name,value:d.value/100}));
 const monthly=dimension.startsWith('monthly_'),income=dimension.endsWith('_income'),values:Record<string,number>={};for(const d of data.daily){const key=monthly?d.date.slice(0,7):d.date;values[key]=(values[key]||0)+(income?d.income:d.expense);}
 const start=new Date(from+'T00:00:00Z'),end=new Date(to+'T00:00:00Z');if(!monthly&&(end.getTime()-start.getTime())/86400000>366)throw new Error('逐日图请限制在一年内，较长区间请使用monthly_expense或monthly_income');if(monthly)start.setUTCDate(1);const points:{name:string;value:number}[]=[];for(let d=start;d<=end;monthly?d.setUTCMonth(d.getUTCMonth()+1):d.setUTCDate(d.getUTCDate()+1)){const name=d.toISOString().slice(0,monthly?7:10);points.push({name,value:(values[name]||0)/100});}return points;
}
