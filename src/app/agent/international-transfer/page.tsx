
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export default function AgentInternationalTransferPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Transfert International</h1>
            <p className="text-muted-foreground mb-8">Permet de soumettre une demande de retrait pour un transfert international.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Formulaire de Réclamation</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Le formulaire pour réclamer un transfert international sera bientôt disponible ici.</p>
                </CardContent>
            </Card>
        </div>
    );
}
