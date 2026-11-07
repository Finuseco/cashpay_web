import {db} from '@/lib/db';
export async function markChatRead(conversationId:string,userId:number) {
 if(!conversationId || !Number.isSafeInteger(userId)||userId<=0)throw new Error('Conversation invalide.');
 await db.query('SELECT onchat_mark_read($1,$2)',[conversationId,userId]);
}
