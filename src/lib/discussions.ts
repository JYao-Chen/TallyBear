export type DiscussionKind='movement'|'transaction'|'project'|'schedule'|'claim';
export type DiscussionTarget={kind:DiscussionKind;id:string;scope?:string};
export type DiscussionMessage={id:string;seq:string;user_id:string;name:string;avatar:string;body:string;created_at:string;reply_to:string|null;reply_name:string|null;reply_avatar:string|null;reply_body:string|null};
