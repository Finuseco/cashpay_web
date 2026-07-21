
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export default function AgentClientsPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Gestion des Clients</h1>
            <p className="text-muted-foreground mb-8">Interface pour consulter et gérer les clients.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Liste des Clients</CardTitle>
                    <CardDescription>Cette fonctionnalité est en cours de développement.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">La liste des clients et les outils de gestion seront disponibles ici.</p>
                </CardContent>
            </Card>
        </div>
    );
}
