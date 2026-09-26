export function refundFromNet(remaining:number,desiredNet:number){
 if(!Number.isSafeInteger(remaining)||!Number.isSafeInteger(desiredNet)||desiredNet>=remaining||remaining-desiredNet>100000000000)return null;
 return remaining-desiredNet;
}
