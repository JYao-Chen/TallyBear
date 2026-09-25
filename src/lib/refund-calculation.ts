export function refundFromNet(remaining:number,desiredNet:number){
 if(!Number.isInteger(remaining)||!Number.isInteger(desiredNet)||desiredNet<0||desiredNet>=remaining)return null;
 return remaining-desiredNet;
}
