'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User } from '@/lib/types';

export interface Comment {
    id: number;
    product_id?: string | null;
    article_id?: number | null; 
    user_id: number;
    author_name: string;
    author_photo?: string | null;
    text: string;
    created_at: string;
    parent_comment_id?: number | null;
    replies?: Comment[];
}

/**
 * Récupère les commentaires pour un produit, incluant les avatars des auteurs.
 */
export async function getCommentsForProduct(productId: string): Promise<Comment[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                pc.*, 
                u.profile_photo as "author_photo"
            FROM product_comments pc
            JOIN users u ON pc.user_id = u.id
            WHERE pc.product_id = $1 
            ORDER BY pc.created_at DESC
        `, [productId]);
        
        const comments: Comment[] = rows.map(c => ({
            ...c, 
            created_at: new Date(c.created_at).toISOString()
        }));

        const commentMap = new Map(comments.map(c => [c.id, { ...c, replies: [] as Comment[] }]));
        const topLevelComments: Comment[] = [];

        for (const comment of comments) {
            if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
                commentMap.get(comment.parent_comment_id)!.replies!.push(comment);
            } else {
                topLevelComments.push(commentMap.get(comment.id)!);
            }
        }

        for (const comment of Array.from(commentMap.values())) {
            comment.replies?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }

        return topLevelComments;

    } catch (error) {
        handleDbError(error, 'fetching product comments');
        return [];
    }
}

interface PostCommentArgs {
    productId: string;
    user: User;
    text: string;
    parentCommentId?: number | null;
}

/**
 * Enregistre un nouveau commentaire sur un produit.
 */
export async function postComment({ productId, user, text, parentCommentId }: PostCommentArgs): Promise<{ success: boolean; comment?: Comment; error?: string }> {
    if (!text.trim()) {
        return { success: false, error: 'Le commentaire ne peut pas être vide.' };
    }

    try {
        const { rows } = await db.query(`
            INSERT INTO product_comments (product_id, user_id, author_name, text, parent_comment_id) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
        `, [productId, user.id, user.full_name, text, parentCommentId || null]);
        
        const createdCommentData = rows[0];
        const createdComment: Comment = {
            id: createdCommentData.id,
            product_id: createdCommentData.product_id,
            user_id: createdCommentData.user_id,
            author_name: createdCommentData.author_name,
            author_photo: user.profile_photo,
            text: createdCommentData.text,
            created_at: new Date(createdCommentData.created_at).toISOString(),
            parent_comment_id: createdCommentData.parent_comment_id,
        };

        return { success: true, comment: createdComment };

    } catch (error) {
        const dbError = await handleDbError(error, 'posting product comment');
        return { success: false, error: dbError.error };
    }
}
