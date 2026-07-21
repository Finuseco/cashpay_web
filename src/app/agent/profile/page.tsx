import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Wallet, Mail, Phone } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";

export default async function AgentProfilePage() {
    const agent = await getAuthenticatedUser();
    
    if (!agent) {
        redirect('/agent/login');
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Profil de l'Agent</h1>
            <p className="text-muted-foreground mb-8">Consultez et gérez vos informations personnelles.</p>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar className="h-20 w-20 border-2 border-primary">
                        <AvatarImage src={agent.profile_photo || ''} alt={agent.full_name} />
                        <AvatarFallback>{agent.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-2xl">{agent.full_name}</CardTitle>
                        <CardDescription>{agent.profession}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="mt-4 space-y-4">
                     <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">ID Portefeuille</p>
                            <p className="font-semibold">{agent.id_wallet}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="font-semibold">{agent.email}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Téléphone</p>
                            <p className="font-semibold">{agent.phone}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
