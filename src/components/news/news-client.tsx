
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Article, User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Rss, ThumbsUp, Eye, Globe } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getArticles, syncNewsFromRssFeeds } from '@/lib/actions/news.actions';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { countryToCode } from '@/lib/utils';
import { NEWS_CATEGORIES } from '@/lib/countries';
import { useTranslation } from 'react-i18next';

const ArticleCard = ({ article }: { article: Article }) => {
    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow bg-card">
            <Link href={`/news/${article.id}`}>
                {article.imageUrl && (
                    <div className="relative aspect-video bg-muted">
                        <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="object-cover w-full h-full"
                        />
                    </div>
                )}
                <div className="p-4">
                    <p className="text-xs font-semibold text-primary uppercase">{article.source}</p>
                    <h3 className="font-bold text-lg leading-snug mt-1 line-clamp-2">{article.title}</h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                        <span>{article.author || article.source}</span>
                        <span>{formatDistanceToNow(new Date(article.isoDate), { addSuffix: true, locale: fr })}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 pt-2 border-t">
                        <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> {article.likes}</span>
                        <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {article.views}</span>
                    </div>
                </div>
            </Link>
        </Card>
    );
};


export function NewsClient() {
    const { t } = useTranslation();
    const [articles, setArticles] = useState<Article[]>([]);
    const [activeTab, setActiveTab] = useState<'international' | 'mon-pays' | 'afrique' | 'europe' | 'amerique' | 'asie'>('international');
    const [activeCategory, setActiveCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    const fetchArticles = useCallback(async (tab: typeof activeTab, category: string, currentUser: User | null) => {
        setIsLoading(true);

        const filter: any = { filterType: 'recent' };
        if (category !== 'all') {
            filter.category = category;
        }

        let countryCodeForSync: string | undefined = undefined;
        let continentForSync: string | undefined = undefined;

        if (tab === 'mon-pays' && currentUser?.country) {
            const userCountryCode = countryToCode(currentUser.country);
            if (userCountryCode) {
                filter.countryCode = userCountryCode;
                countryCodeForSync = userCountryCode;
            }
        } else if (tab !== 'international') {
            filter.continent = tab.charAt(0).toUpperCase() + tab.slice(1);
            continentForSync = filter.continent;
        }

        await syncNewsFromRssFeeds({ 
            countryCode: countryCodeForSync,
            continent: continentForSync,
            category: category === 'all' ? undefined : category as any 
        });
        
        const fetchedArticles = await getArticles(filter);
        setArticles(fetchedArticles);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            // The main fetch is now triggered by the change in 'user' state
        }
        init();
    }, []);
    
    useEffect(() => {
        // Run fetchArticles whenever user or tabs change.
        // The check for `user !== null` ensures it runs after the initial user fetch.
        if (user !== null) {
            fetchArticles(activeTab, activeCategory, user);
        }
    }, [activeTab, activeCategory, user, fetchArticles]);

    const newsCategories = ['all', ...Object.keys(NEWS_CATEGORIES)];

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Rss/> {t('pageTitleNews')}</h1>
                        <p className="text-muted-foreground">{t('newsDescription', 'The latest news from around the world.')}</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full mb-6">
                    <TabsList>
                        <TabsTrigger value="international"><Globe className="mr-2 h-4 w-4"/>{t('newsTabInternational')}</TabsTrigger>
                        {user?.country && <TabsTrigger value="mon-pays">{t('newsTabMyCountry')}</TabsTrigger>}
                        <TabsTrigger value="afrique">{t('newsTabAfrica')}</TabsTrigger>
                        <TabsTrigger value="europe">{t('newsTabEurope')}</TabsTrigger>
                        <TabsTrigger value="amerique">{t('newsTabAmerica')}</TabsTrigger>
                        <TabsTrigger value="asie">{t('newsTabAsia')}</TabsTrigger>
                    </TabsList>
                </Tabs>
                
                 <div className="mb-6">
                    <Select onValueChange={setActiveCategory} defaultValue={activeCategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('newsCategoryFilterPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {newsCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{t(`newsCategory_${cat}`, cat === 'all' ? 'Toutes les catégories' : cat)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {isLoading ? (
                    <div className="space-y-6">
                        {[...Array(3)].map((_, i) => (
                           <Card key={i} className="overflow-hidden"><Skeleton className="h-40 w-full"/><div className="p-4 space-y-2"><Skeleton className="h-4 w-1/4"/><Skeleton className="h-6 w-full"/><Skeleton className="h-4 w-3/4"/></div></Card>
                        ))}
                    </div>
                ) : articles.length > 0 ? (
                    <div className="space-y-6">
                        {articles.map((article) => (
                            <ArticleCard key={article.id} article={article} />
                        ))}
                    </div>
                ) : (
                     <div className="text-center py-20 text-muted-foreground">
                        <p>{t('newsNoArticlesFound')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}