"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
export function EnterpriseEntry() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/enterprise", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (active)
          setAllowed(
            data.success &&
              Array.isArray(data.companies) &&
              data.companies.length > 0,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return allowed ? (
    <Link
      href="/enterprise"
      className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
    >
      <Building2 className="h-4 w-4" />
      Espace entreprise
    </Link>
  ) : null;
}
