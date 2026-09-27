import type {ChatAction} from './chat-actions';
// Move edited cards to the revision turn; unchanged carried-forward cards stay put.
export function placeChatCards(turns:{id:string;artifacts:{actions?:ChatAction[]}}[]){
 const first=new Map<string,string>(),latest=new Map<string,ChatAction>();
 for(const turn of turns)for(const action of turn.artifacts.actions||[]){const previous=latest.get(action.id);if(!previous||JSON.stringify(previous.data)!==JSON.stringify(action.data)||previous.bookId!==action.bookId)first.set(action.id,turn.id);latest.set(action.id,action);}
 const result=new Map<string,ChatAction[]>();
 for(const [id,turn] of first){const group=result.get(turn)||[];group.push(latest.get(id)!);result.set(turn,group);}
 return result;
}
