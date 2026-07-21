import { MarketingClient } from '@/components/agent/marketing-client';
import type { User, SmsPackage, SmsPurchase, SentSmsCampaign, Country } from '@/lib/types';
import { getAuthenticatedUser, getAllUsers } from '@/lib/actions/user.actions';
import { getSmsBalance, getSmsHistory } from '@/lib/actions/marketing.actions';
import { getCountriesList } from '@/lib/actions/countries.actions';

export default async function AgentMarketingPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return <div>Veuillez vous connecter.</div>;
    }

    // Fetch all necessary data in parallel
    const [clients, initialSmsBalance, smsHistory, countries] = await Promise.all([
        getAllUsers(),
        getSmsBalance(user.id),
        getSmsHistory(user.id),
        getCountriesList(),
    ]);
    
    // SMS packages can remain static as they represent available offers
    const smsPackages: SmsPackage[] = [
        { id: 1, name: 'Découverte', smsCount: 100, price: 5, currency: 'USD' },
        { id: 2, name: 'Standard', smsCount: 500, price: 20, currency: 'USD' },
        { id: 3, name: 'Pro', smsCount: 1000, price: 35, currency: 'USD' },
        { id: 4, name: 'Business', smsCount: 5000, price: 150, currency: 'USD' },
    ];


    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Marketing & Communication</h1>
            <p className="text-muted-foreground mb-8">Achetez des packs SMS et envoyez des campagnes à vos clients.</p>
            <MarketingClient 
                initialClients={clients} 
                initialSmsPackages={smsPackages} 
                agent={user}
                initialSmsBalance={initialSmsBalance}
                initialPurchaseHistory={smsHistory.purchases}
                initialSentHistory={smsHistory.campaigns}
                countries={countries}
            />
        </div>
    );
}
