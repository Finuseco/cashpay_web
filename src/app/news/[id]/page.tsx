

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getArticleById, getArticleComments } from '@/lib/actions/news.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { ArticleDetailClient } from './article-detail-client';
import type { Comment } from '@/lib/actions/comment.actions';

function ArticleLoading() {
    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-80 w-full rounded-lg" />
            <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
            </div>
        </div>
    );
}

async function ArticleData({ id }: { id: number }) {
    const [article, user, initialComments] = await Promise.all([
        getArticleById(id),
        getAuthenticatedUser(),
        getArticleComments(id)
    ]);

    if (!article) {
        notFound();
    }
    
    return <ArticleDetailClient article={article} user={user} initialComments={initialComments} />;
}


export default function ArticlePage({ params }: { params: { id: string } }) {
    const articleId = parseInt(params.id, 10);
    if (isNaN(articleId)) {
        notFound();
    }

    return (
        <DashboardLayout>
            <main className="flex-1">
                <Suspense fallback={<ArticleLoading />}>
                    <ArticleData id={articleId} />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}

    
