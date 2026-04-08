"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft refresh so new messages appear without a full reload. */
export function InboxAutoRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return <>{children}</>;
}
