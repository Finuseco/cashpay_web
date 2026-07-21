"use client";

import { useTranslation } from "react-i18next";
import { DollarSign, Users, CreditCard, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";

const summaryData = [
  {
    titleKey: "totalRevenue",
    defaultValue: "Total Revenue",
    value: "$45,231.89",
    change: "+20.1% from last month",
    icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
  },
  {
    titleKey: "subscriptions",
    defaultValue: "Subscriptions",
    value: "+2350",
    change: "+180.1% from last month",
    icon: <Users className="h-4 w-4 text-muted-foreground" />,
  },
  {
    titleKey: "sales",
    defaultValue: "Sales",
    value: "+12,234",
    change: "+19% from last month",
    icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
  },
  {
    titleKey: "activeNow",
    defaultValue: "Active Now",
    value: "+573",
    change: "+201 since last hour",
    icon: <Activity className="h-4 w-4 text-muted-foreground" />,
  },
];

export function AnalyticsChart() {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <section>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryData.map((item, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isClient ? t(item.titleKey, item.defaultValue) : item.defaultValue}
              </CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-xs text-muted-foreground">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
