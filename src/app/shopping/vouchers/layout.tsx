// src/app/shopping/vouchers/layout.tsx

import ShoppingLayout from '../layout';

export default function VouchersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ShoppingLayout>{children}</ShoppingLayout>;
}
