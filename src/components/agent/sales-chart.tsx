
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Lundi', Ventes: 4000 },
  { name: 'Mardi', Ventes: 3000 },
  { name: 'Mercredi', Ventes: 2000 },
  { name: 'Jeudi', Ventes: 2780 },
  { name: 'Vendredi', Ventes: 1890 },
  { name: 'Samedi', Ventes: 2390 },
  { name: 'Dimanche', Ventes: 3490 },
];

export function SalesChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventes de la Semaine</CardTitle>
        <CardDescription>Aperçu des ventes des 7 derniers jours.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))"
                    }}
                />
                <Line type="monotone" dataKey="Ventes" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} dot={false}/>
                </LineChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
