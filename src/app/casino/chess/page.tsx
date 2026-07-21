import { ChessClient } from '@/components/casino/chess/chess-client';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function ChessPage() {
    const user: User | null = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    return <ChessClient user={user} />;
}
