
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { CarouselApi } from '@/components/ui/carousel';
import { Card } from '@/components/ui/card';
import type { Product } from '@/lib/types';
import { ProductCard } from './product-card';
import { Heart, Layers, BadgePercent, Album } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useRouter } from 'next/navigation';


const QuickLink = ({ icon: Icon, label, onClick }: { icon: React.ElementType, label: string, onClick?: () => void }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 text-center w-full">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted">
            <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <span className="text-xs font-medium">{label}</span>
    </button>
);

export function JojoMarketClient({ products }: { products: Product[] }) {
    const { openAlert } = useAlertDialog();
    const router = useRouter();
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();
    const [headerSlide, setHeaderSlide] = useState(0);

    const headerSlides = [
        { image: "/images/banner1.png", title: "Women's", subtitle: "Fashion", action: "Shop Now >>", alt: "Mode femme" },
        { image: "/images/banner2.png", title: "Men's", subtitle: "Fashion", action: "Discover Now >>", alt: "Mode homme" },
        { image: "/images/banner3.png", title: "International", subtitle: "Shopping", action: "Explore Now >>", alt: "Shopping international" },
        { image: "/images/banner4.png", title: "Worldwide", subtitle: "Delivery", action: "Discover >>", alt: "Livraison internationale" },
        { image: "/images/banner5.png", title: "Fast", subtitle: "Delivery", action: "Shop Now >>", alt: "Livraison rapide" },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setHeaderSlide((current) => (current + 1) % headerSlides.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!carouselApi) return;

        const interval = setInterval(() => {
            carouselApi.scrollNext();
        }, 5000);

        return () => clearInterval(interval);
    }, [carouselApi]);

    const handleComingSoon = (featureName: string) => {
        openAlert({
            title: "Bientôt disponible",
            description: `La fonctionnalité "${featureName}" sera bientôt disponible.`,
            variant: "info",
        });
    };
    
    return (
        <div className="space-y-4">
            {/* Animated Top Banner - display only */}
            <div className="relative h-40 overflow-hidden bg-pink-200">
                {headerSlides.map((slide, index) => (
                    <div
                        key={slide.image}
                        className={`absolute inset-0 flex items-center p-4 transition-all duration-700 ease-in-out ${
                            index === headerSlide
                                ? "translate-x-0 opacity-100"
                                : "translate-x-2 opacity-0 pointer-events-none"
                        }`}
                        aria-hidden={index !== headerSlide}
                    >
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold text-pink-800">{slide.title}</h2>
                            <h2 className="text-2xl font-bold text-pink-800">{slide.subtitle}</h2>
                            <Button variant="link" className="p-0 text-pink-700 font-bold">
                                {slide.action}
                            </Button>
                        </div>

                        <div className="absolute right-0 bottom-0 h-full w-[58%]">
                            <Image
                                src={slide.image}
                                fill
                                sizes="58vw"
                                alt={slide.alt}
                                className="object-contain object-right-bottom"
                            />
                        </div>
                    </div>
                ))}

                <div className="absolute bottom-2 left-4 z-20 flex gap-1.5">
                    {headerSlides.map((slide, index) => (
                        <span
                            key={slide.image}
                            className={`h-1 rounded-full transition-all duration-500 ${
                                index === headerSlide
                                    ? "w-5 bg-pink-800"
                                    : "w-1.5 bg-pink-400"
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-4 gap-4 px-4">
                <QuickLink icon={Heart} label="Wish List" onClick={() => router.push('/shopping/wishlist')} />
                <QuickLink icon={Layers} label="Wholesale" onClick={() => handleComingSoon('Wholesale')} />
                <QuickLink icon={BadgePercent} label="Bargain Zone" onClick={() => handleComingSoon('Bargain Zone')} />
                <QuickLink icon={Album} label="New Arrival" onClick={() => handleComingSoon('New Arrival')} />
            </div>

             {/* JoJo Shopping Banner */}
            <div className="px-2">
                <Carousel
                    opts={{
                        align: "start",
                        loop: true,
                    }}
                    setApi={setCarouselApi}
                >
                    <CarouselContent>
                        {Array.from({ length: 10 }, (_, index) => `jojo${index + 1}.png`).map((image, index) => (
                            <CarouselItem key={image}>
                                <Card className="overflow-hidden">
                                    <Image
                                        src={`/images/jojo/${image}`}
                                        width={600}
                                        height={200}
                                        alt={`JoJo Shopping - Bannière ${index + 1}`}
                                        className="w-full"
                                    />
                                </Card>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
            </div>

            <Tabs defaultValue="recommend" className="w-full">
                <TabsList className="w-full justify-start rounded-none bg-transparent p-0 px-4 gap-4 border-b">
                    <TabsTrigger value="recommend" className="text-base data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none p-2 bg-transparent">Recommander</TabsTrigger>
                    <TabsTrigger value="new" className="text-base data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none p-2 bg-transparent">Nouveau</TabsTrigger>
                </TabsList>
                <TabsContent value="recommend" className="mt-4 px-2">
                    <div className="grid grid-cols-2 gap-2">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="new" className="mt-4 px-2">
                     <div className="grid grid-cols-2 gap-2">
                        {[...products].reverse().map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
