export const themes={bear:{label:'小熊陪伴',icon:'/brand/tallybear-192.png',name:'TallyBear',assistant:'小熊对话',color:'#faf7f2',manifest:'/manifest.webmanifest'},minimal:{label:'极简清爽',icon:'/ledger-minimal.svg',name:'TallyBear',assistant:'智能对话',color:'#f5f7fa',manifest:'/manifest-minimal.webmanifest'}} as const;
export type Theme=keyof typeof themes;
export function validTheme(value:unknown):Theme{return value==='minimal'?'minimal':'bear';}
