import type {ChatAction} from './chat-actions';
// Keep each card at its first appearance, while displaying its latest revision.
export function placeChatCards(turns:{id:string;artifacts:{actions?:ChatAction[]}}[]){
 const first=new Map<string,string>(),latest=new Map<string,ChatAction>();
 for(const turn of turns)for(const action of turn.artifacts.actions||[]){if(!first.has(action.id))first.set(action.id,turn.id);latest.set(action.id,action);}
 const result=new Map<string,ChatAction[]>();
 for(const [id,turn] of first){const group=result.get(turn)||[];group.push(latest.get(id)!);result.set(turn,group);}
 return result;
}
