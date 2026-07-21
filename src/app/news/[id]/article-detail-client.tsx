

'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ThumbsUp, MessageSquare, Send, Share2, Globe, Calendar, User as UserIcon, Loader2, CornerDownRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import type { Article, User } from '@/lib/types';
import type { Comment } from '@/lib/actions/comment.actions';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { likeArticle, postArticleComment } from '@/lib/actions/news.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

const ReplyForm = ({ articleId, parentCommentId, user, onReplyPosted, onCancel }: { articleId: number, parentCommentId: number, user: User, onReplyPosted: (reply: Comment) => void, onCancel: () => void }) => {
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        setIsSubmitting(true);
        const result = await postArticleComment(articleId, user.id, user.full_name, replyText, parentCommentId);
        if (result.success && result.comment) {
            onReplyPosted(result.comment);
            setReplyText('');
        }
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-2 pt-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user.profile_photo || ''} />
                <AvatarFallback>{user.first_name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="relative flex-1">
                <Textarea
                    placeholder="Écrire une réponse..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="pr-12 text-xs"
                    rows={1}
                />
                <div className="absolute bottom-1 right-1 flex gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}><X className="h-4 w-4"/></Button>
                    <Button type="submit" size="icon" className="h-7 w-7" disabled={!replyText.trim() || isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </form>
    );
};

const CommentCard = ({ comment, articleId, user, onReplySuccess }: { comment: Comment; articleId: number, user: User | null, onReplySuccess: (parentCommentId: number, newReply: Comment) => void }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);

    return (
        <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${comment.author_name}`} />
                <AvatarFallback>{comment.author_name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="bg-muted p-3 rounded-lg">
                    <p className="font-semibold text-sm">{comment.author_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}</p>
                    <p className="text-sm mt-1">{comment.text}</p>
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-muted-foreground" onClick={() => user && setShowReplyForm(!showReplyForm)}>Répondre</Button>
                </div>
                {showReplyForm && user && (
                    <ReplyForm 
                        articleId={articleId} 
                        parentCommentId={comment.id}
                        user={user} 
                        onReplyPosted={(reply) => { onReplySuccess(comment.id, reply); setShowReplyForm(false); }}
                        onCancel={() => setShowReplyForm(false)}
                    />
                )}
                 <div className="space-y-3 mt-3 pl-4 border-l-2">
                    {comment.replies?.map(reply => (
                         <div key={reply.id} className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${reply.author_name}`} />
                                <AvatarFallback>{reply.author_name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                             <div className="bg-muted/50 p-2 rounded-lg flex-1">
                                <p className="font-semibold text-xs">{reply.author_name}</p>
                                <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: fr })}</p>
                                <p className="text-sm mt-1">{reply.text}</p>
                            </div>
                         </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


export function ArticleDetailClient({ article, user, initialComments }: { article: Article, user: User | null, initialComments: Comment[] }) {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [likes, setLikes] = useState(article.likes);
    const [isLiking, setIsLiking] = useState(false);
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    
    const handleLike = async () => {
        if (!user) {
            router.push('/login');
            return;
        }
        setIsLiking(true);
        const result = await likeArticle(article.id, user.id);
        if (result.success) {
            setLikes(result.likes);
        }
        setIsLiking(false);
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;
        
        setIsPostingComment(true);
        const result = await postArticleComment(article.id, user.id, user.full_name, newComment);
        
        if (result.success && result.comment) {
            setComments(prev => [result.comment!, ...prev]);
            setNewComment('');
        } else {
            openAlert({ title: 'Erreur', description: 'Impossible de poster votre commentaire.', variant: 'error' });
        }
        setIsPostingComment(false);
    };
    
    const handleReplySuccess = (parentCommentId: number, newReply: Comment) => {
        setComments(prevComments => 
            prevComments.map(comment => {
                if (comment.id === parentCommentId) {
                    const updatedReplies = [...(comment.replies || []), newReply];
                    return { ...comment, replies: updatedReplies };
                }
                return comment;
            })
        );
    };

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux actualités
            </Button>

            <article>
                <p className="text-primary font-semibold">{article.source}</p>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight mt-2">{article.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                    {article.author && <span className="flex items-center gap-2"><UserIcon className="h-4 w-4"/> {article.author}</span>}
                    <span className="flex items-center gap-2"><Calendar className="h-4 w-4"/> {format(new Date(article.isoDate), 'd MMMM yyyy', { locale: fr })}</span>
                </div>

                {article.imageUrl && (
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden my-6">
                        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
                    </div>
                )}

                <div
                    className="prose prose-lg dark:prose-invert max-w-none article-content"
                    dangerouslySetInnerHTML={{ __html: article.content || '' }}
                />
            </article>

            <div className="flex items-center justify-between border-t border-b py-2">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" onClick={handleLike} disabled={isLiking} className="flex items-center gap-2">
                        <ThumbsUp className="h-5 w-5"/> {likes}
                    </Button>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-5 w-5"/> {comments.length}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <a href={article.link} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost"><Globe className="mr-2 h-4 w-4"/> Voir l'original</Button>
                    </a>
                    <Button variant="ghost"><Share2 className="mr-2 h-4 w-4"/> Partager</Button>
                </div>
            </div>
            
            <div className="space-y-6">
                <h3 className="font-bold text-xl">Commentaires</h3>
                
                <form onSubmit={handleCommentSubmit} className="flex items-start gap-2">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.profile_photo || ''} />
                        <AvatarFallback>{user?.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="relative flex-1">
                        <Textarea 
                            placeholder="Ajouter un commentaire..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="pr-12"
                            disabled={!user || isPostingComment}
                        />
                        <Button type="submit" size="icon" className="absolute bottom-2 right-2 h-8 w-8" disabled={!newComment.trim() || !user || isPostingComment}>
                            {isPostingComment ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </form>

                 <div className="space-y-4">
                    {comments.length > 0 ? comments.map(comment => <CommentCard key={comment.id} comment={comment} articleId={article.id} user={user} onReplySuccess={handleReplySuccess} />) : <p className="text-sm text-muted-foreground">Soyez le premier à commenter !</p>}
                 </div>
            </div>
        </div>
    );
}

    
