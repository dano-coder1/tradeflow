import { TradeForm } from "@/components/trades/trade-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewTradePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Trade</span>
      </div>

      <h1 className="text-2xl font-bold">Add Trade</h1>
      <TradeForm />
    </div>
  );
}
