
'use client';

import ShoppingLayout from '../shopping-layout';

export default function VouchersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ShoppingLayout>{children}</ShoppingLayout>;
}
