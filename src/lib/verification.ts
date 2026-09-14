import {verifyItemTotal,type LineItem} from './line-items';
export class VerificationError extends Error {name='VerificationError';}
export function requiresVerification(items:LineItem[],amount:number){return ['mismatch','incomplete'].includes(verifyItemTotal(items,amount).status);}
export function checkVerification(items:LineItem[],amount:number,reason:string){if(requiresVerification(items,amount)&&!reason.trim())throw new VerificationError('明细尚未核验通过，请修正明细或填写确认入账的原因');}
