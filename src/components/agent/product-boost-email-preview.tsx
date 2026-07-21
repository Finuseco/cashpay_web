'use client';

import type { Product } from '@/lib/types';
import { Button } from '../ui/button';
import { currentPrice } from '@/lib/utils';
import Image from 'next/image';

type LayoutStyle = '2-cols' | '3-cols' | 'featured';

interface PreviewProps {
    agentName: string; // Used as Boutique Name in preview
    agentCountry: string | null;
    products: Product[];
    layout: LayoutStyle;
}

const ProductItem = ({ product, isFeatured }: { product: Product, isFeatured?: boolean }) => {
    const price = currentPrice(product, 1);
    const imageUrl = product.image;

    return (
        <div style={{
            display: 'inline-block',
            verticalAlign: 'top',
            width: isFeatured ? '100%' : '100%',
            padding: '10px',
            boxSizing: 'border-box',
        }}>
            <table cellPadding="0" cellSpacing="0" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <tbody>
                    <tr>
                        <td style={{ padding: '0' }}>
                            <div style={{ position: 'relative', width: '100%', paddingTop: '100%', borderRadius: '8px 8px 0 0', overflow: 'hidden', backgroundColor: '#f7fafc' }}>
                               {imageUrl && <img 
                                    src={imageUrl} 
                                    alt={product.name} 
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                />}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ padding: '10px' }}>
                            <h3 style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#1a202c', height: '40px', overflow: 'hidden' }}>{product.name}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#000E38' }}>
                                ${price.toFixed(2)}
                            </p>
                        </td>
                    </tr>
                    <tr>
                         <td style={{ padding: '0 10px 10px' }}>
                           <div style={{ backgroundColor: '#FF6600', color: '#ffffff', padding: '8px 12px', borderRadius: '4px', textDecoration: 'none', display: 'block', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                               Commander
                           </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export const ProductBoostEmailPreview = ({ agentName, agentCountry, products, layout }: PreviewProps) => {
    const featuredProduct = layout === 'featured' && products.length > 0 ? products[0] : null;
    const gridProducts = layout === 'featured' ? products.slice(1) : products;
    const columns = layout === '3-cols' ? 3 : 2;

    return (
        <div className="bg-gray-100 p-4 font-sans rounded-md border">
            <div className="max-w-xl mx-auto bg-white shadow-sm overflow-hidden">
                <header className="bg-[#000E38] p-6 text-center">
                    <h1 className="text-3xl font-bold text-white">JoJo</h1>
                    <p className="text-sm text-white/70">shopping online</p>
                    <h2 className="text-xl font-semibold text-white mt-4">{agentName}</h2>
                    {agentCountry && <p className="text-sm text-white/70">Magasin basé en {agentCountry}</p>}
                </header>
                <main className="p-6">
                    <p className="text-gray-700 mb-6 text-sm">Découvrez les derniers articles de notre magasin certifié !</p>

                    {featuredProduct && (
                        <div style={{ marginBottom: '20px' }}>
                            <ProductItem product={featuredProduct} isFeatured={true} />
                        </div>
                    )}
                    
                    <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                        <tbody>
                            <tr>
                                {gridProducts.slice(0, columns).map((p, i) => (
                                    <td key={p.id} style={{ width: `${100 / columns}%`, verticalAlign: 'top' }}>
                                        <ProductItem product={p} />
                                    </td>
                                ))}
                            </tr>
                            {gridProducts.length > columns && (
                                <tr>
                                     {gridProducts.slice(columns, columns * 2).map((p, i) => (
                                        <td key={p.id} style={{ width: `${100 / columns}%`, verticalAlign: 'top' }}>
                                            <ProductItem product={p} />
                                        </td>
                                    ))}
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <div style={{ backgroundColor: '#000E38', color: '#ffffff', padding: '12px 25px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block', fontWeight: 'bold' }}>
                            Visiter le magasin
                        </div>
                    </div>
                </main>
                 <footer className="bg-gray-100 p-6 text-center text-xs text-gray-600">
                    <p>&copy; {new Date().getFullYear()} {agentName} & CashPay. Tous droits réservés.</p>
                </footer>
            </div>
        </div>
    );
};
