
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Currency } from '@/lib/types';

const data = [
  { name: 'Lundi', USD: 40, EUR: 30, LOCAL: 45000 },
  { name: 'Mardi', USD: 30, EUR: 20, LOCAL: 32000 },
  { name: 'Mercredi', USD: 20, EUR: 15, LOCAL: 25000 },
  { name: 'Jeudi', USD: 27, EUR: 22, LOCAL: 30000 },
  { name: 'Vendredi', USD: 18, EUR: 12, LOCAL: 19000 },
  { name: 'Samedi', USD: 50, EUR: 40, LOCAL: 60000 },
  { name: 'Dimanche', USD: 65, EUR: 55, LOCAL: 75000 },
];

interface CommissionsChartProps {
    localCurrencyCode: string;
}

export function CommissionsChart({ localCurrencyCode }: CommissionsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Commissions de la Semaine</CardTitle>
        <CardDescription>Aperçu des commissions générées sur les 7 derniers jours.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value/1000)}k`}/>
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))"
                    }}
                    formatter={(value, name) => {
                         if (name === localCurrencyCode) {
                            return `${Number(value).toLocaleString()} ${localCurrencyCode}`;
                         }
                         return `${Number(value).toFixed(2)} ${name}`;
                    }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="USD" fill="hsl(var(--primary))" name="Commissions (USD)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="EUR" fill="hsl(var(--chart-1))" name="Commissions (EUR)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="LOCAL" fill="hsl(var(--chart-2))" name={`Commissions (${localCurrencyCode})`} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
