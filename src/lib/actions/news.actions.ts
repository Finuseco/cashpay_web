
      
'use server';

import type { Article, User } from '@/lib/types';
import Parser from 'rss-parser';
import { db } from '../db';
import { handleDbError } from './helpers';
import type { Comment } from './comment.actions';
import { countries, NEWS_FEEDS_BY_CONTINENT, NEWS_CATEGORIES } from '../countries';
import { countryToCode } from '../utils';

type RssItem = {
    [key: string]: any;
    link?: string;
    guid?: string;
    title?: string;
    pubDate?: string;
    creator?: string;
    author?: string;
    content?: string;
    contentSnippet?: string;
    encodedContent?: string;
    enclosure?: { url: string; [key: string]: any; };
    'media:content'?: { '$': { url: string; } }
};

const parser = new Parser({
    customFields: {
        item: [['media:content', 'media:content'], 'content:encoded'],
    }
});


function sanitizeAuthor(author: string | undefined | { name: string }): string | undefined {
    if (!author) return undefined;
    
    let authorName: string;
    if (typeof author === 'object' && author.name) {
        authorName = author.name;
    } else if (typeof author === 'string') {
        authorName = author;
    } else {
        return undefined;
    }
    
    // Remove HTML tags
    return authorName.replace(/<[^>]*>?/gm, '').trim();
}


function extractImageUrl(item: RssItem): string | undefined {
    try {
        // 1. Check for media:content which is common and often higher quality
        if (item['media:content']?.$?.url) {
            return item['media:content'].$.url;
        }

        // 2. Check for enclosure, a standard RSS way to attach media
        if (item.enclosure?.url && item.enclosure.type?.startsWith('image')) {
            return item.enclosure.url;
        }
        
        // 3. Look for an <img> tag in the full content
        if (item.encodedContent) {
            const match = item.encodedContent.match(/<img.*?src=["'](.*?)["']/);
            if (match?.[1]) {
                return match[1];
            }
        }
        
        // 4. Fallback to the shorter content field
        if (item.content) {
            const match = item.content.match(/<img.*?src=["'](.*?)["']/);
            if (match?.[1]) {
                return match[1];
            }
        }
    } catch (e) {
        console.error("Error extracting image from RSS item:", e);
    }
    return undefined;
}

interface SyncOptions {
    countryCode?: string;
    continent?: string;
    category?: keyof typeof NEWS_CATEGORIES;
}

export async function syncNewsFromRssFeeds(options: SyncOptions = {}): Promise<{ success: boolean, count: number }> {
    console.log(`[News Action] Syncing news with options:`, options);
    let newArticlesCount = 0;
    
    const feedsToFetch: {name: string, url: string, country: string, continent: string, category: string}[] = [];

    if (options.category && NEWS_CATEGORIES[options.category]) {
        feedsToFetch.push({ name: options.category, url: NEWS_CATEGORIES[options.category], country: 'INTL', continent: 'International', category: options.category });
    } else if (options.continent && NEWS_FEEDS_BY_CONTINENT[options.continent]) {
        const feed = NEWS_FEEDS_BY_CONTINENT[options.continent];
        feedsToFetch.push({ name: feed.name, url: feed.url, country: 'INTL', continent: options.continent, category: 'General' });
    } else if (options.countryCode) {
        const country = countries.find(c => c.code === options.countryCode);
        if (country?.news_feeds) {
            country.news_feeds.forEach(feed => feedsToFetch.push({ ...feed, country: country.code, continent: country.continent, category: feed.category || 'General' }));
        }
    } else { // Default to international feeds
        feedsToFetch.push({ name: 'RFI Monde', url: 'https://www.rfi.fr/fr/rss', country: 'INTL', continent: 'International', category: 'General' });
        feedsToFetch.push({ name: 'Jeune Afrique', url: 'https://www.jeuneafrique.com/rss.xml', country: 'INTL', continent: 'Afrique', category: 'General' });
    }

    for (const feedInfo of feedsToFetch) {
        try {
            const feed = await parser.parseURL(feedInfo.url);
            if (feed.items) {
                for (const item of feed.items) {
                    const articleLink = item.link || item.guid;
                    if (!articleLink) continue;

                    const { rows: existing } = await db.query('SELECT id FROM news_articles WHERE link = $1', [articleLink]);

                    if (existing.length === 0) {
                        const articleData = {
                            source: feed.title || feedInfo.name,
                            title: item.title || 'Sans titre',
                            link: articleLink,
                            pub_date: item.pubDate ? new Date(item.pubDate) : new Date(),
                            content: item.contentSnippet || item.content?.substring(0, 255) || '',
                            full_content: item.encodedContent || item.content || item.contentSnippet || '',
                            content_snippet: item.contentSnippet?.substring(0, 255) || '',
                            author: sanitizeAuthor(item.creator || item.author),
                            image_url: extractImageUrl(item),
                            country_code: feedInfo.country,
                            continent: feedInfo.continent,
                            category: feedInfo.category,
                        };
                        await db.query('INSERT INTO news_articles (source, title, link, pub_date, content, full_content, content_snippet, author, image_url, country_code, continent, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', Object.values(articleData));
                        newArticlesCount++;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to fetch or parse RSS feed for ${feedInfo.name}:`, error);
        }
    }
    
    console.log(`[News Action] Sync complete. Added ${newArticlesCount} new articles.`);
    return { success: true, count: newArticlesCount };
}

interface ArticleFilter {
    filterType: 'recent' | 'popular' | 'mostViewed';
    countryCode?: string;
    continent?: string;
    category?: string;
}

export async function getArticles(filter: ArticleFilter): Promise<Article[]> {
    let orderByClause = 'ORDER BY pub_date DESC';
    if (filter.filterType === 'popular') {
        orderByClause = 'ORDER BY likes DESC, views DESC';
    } else if (filter.filterType === 'mostViewed') {
        orderByClause = 'ORDER BY views DESC, pub_date DESC';
    }

    const whereClauses: string[] = [];
    const queryParams: (string | number)[] = [];
    let paramIndex = 1;

    if (filter.countryCode) {
        whereClauses.push(`country_code = $${paramIndex++}`);
        queryParams.push(filter.countryCode);
    }
    if (filter.continent && filter.continent !== 'International') {
        whereClauses.push(`continent = $${paramIndex++}`);
        queryParams.push(filter.continent);
    }
    if (filter.category && filter.category !== 'all') {
        whereClauses.push(`category = $${paramIndex++}`);
        queryParams.push(filter.category);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
        const query = `SELECT id, source, title, link, pub_date as isoDate, author, image_url, views, likes, country_code, continent, category FROM news_articles ${whereClause} ${orderByClause} LIMIT 50`;
        const { rows } = await db.query(query, queryParams);

        return rows.map(row => ({
            ...row,
            pubDate: new Date(row.isoDate).toUTCString(),
            isoDate: new Date(row.isoDate).toISOString(),
        })) as Article[];
    } catch (error) {
        await handleDbError(error, `fetching articles with filter: ${JSON.stringify(filter)}`);
        return [];
    }
}


export async function getArticleById(id: number): Promise<Article | null> {
    try {
        await db.query('UPDATE news_articles SET views = views + 1 WHERE id = $1', [id]);

        const { rows } = await db.query('SELECT * FROM news_articles WHERE id = $1', [id]);
        if (rows.length === 0) return null;

        const row = rows[0];
         return {
            id: row.id,
            source: row.source,
            title: row.title,
            link: row.link,
            pubDate: new Date(row.pub_date).toUTCString(),
            content: row.full_content || row.content, // Prioritize full_content
            contentSnippet: row.content_snippet,
            isoDate: new Date(row.pub_date).toISOString(),
            author: row.author,
            imageUrl: row.image_url,
            views: row.views,
            likes: row.likes,
            country_code: row.country_code,
            continent: row.continent,
            category: row.category,
        } as Article;

    } catch (error) {
        await handleDbError(error, `fetching article with id: ${id}`);
        return null;
    }
}

export async function getArticleComments(articleId: number): Promise<Comment[]> {
     try {
        const { rows } = await db.query(`SELECT * FROM news_comments WHERE article_id = $1 ORDER BY created_at DESC`, [articleId]);
        
        const comments: Comment[] = rows.map(c => ({...c, created_at: new Date(c.created_at).toISOString()}));
        const commentMap = new Map(comments.map(c => [c.id, { ...c, replies: [] as Comment[] }]));
        const topLevelComments: Comment[] = [];

        for (const comment of comments) {
            if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
                commentMap.get(comment.parent_comment_id)!.replies!.push(comment);
            } else {
                topLevelComments.push(commentMap.get(comment.id)!);
            }
        }

        // Sort replies chronologically
        for (const comment of Array.from(commentMap.values())) {
            comment.replies?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }

        return topLevelComments;

    } catch (error) {
        handleDbError(error, 'fetching article comments');
        return [];
    }
}

export async function postArticleComment(articleId: number, userId: number, authorName: string, text: string, parentCommentId?: number): Promise<{ success: boolean; comment?: Comment; error?: string }> {
    try {
        const newComment = {
            article_id: articleId,
            user_id: userId,
            author_name: authorName,
            text,
            parent_comment_id: parentCommentId || null
        };
        const { rows } = await db.query('INSERT INTO news_comments (article_id, user_id, author_name, text, parent_comment_id) VALUES ($1, $2, $3, $4, $5) RETURNING *', Object.values(newComment));
        
        const createdCommentData = rows[0];
        const createdComment: Comment = {
            id: createdCommentData.id,
            article_id: createdCommentData.article_id,
            user_id: createdCommentData.user_id,
            author_name: createdCommentData.author_name,
            text: createdCommentData.text,
            created_at: new Date(createdCommentData.created_at).toISOString(),
            parent_comment_id: createdCommentData.parent_comment_id,
        };
        
        return { success: true, comment: createdComment };

    } catch (error) {
        const dbError = await handleDbError(error, 'posting article comment');
        return { success: false, error: dbError.error };
    }
}


export async function likeArticle(articleId: number, userId: number): Promise<{ success: boolean; likes: number }> {
    try {
        await db.query('UPDATE news_articles SET likes = likes + 1 WHERE id = $1', [articleId]);
        const { rows } = await db.query('SELECT likes FROM news_articles WHERE id = $1', [articleId]);
        return { success: true, likes: rows[0].likes };
    } catch (error) {
        await handleDbError(error, 'liking article');
        return { success: false, likes: 0 };
    }
}
