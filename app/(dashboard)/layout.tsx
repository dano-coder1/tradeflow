import { Navbar } from "@/components/layout/navbar";
import { PriceAlertMonitor } from "@/components/analyze/price-alert-monitor";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <PriceAlertMonitor />
      <main className="flex-1 bg-grid-pattern">
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
