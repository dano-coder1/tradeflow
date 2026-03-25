import { TrendingUp } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#8B5CF6]">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-gradient">TradeFlow</span>
      </div>
      <div className="w-full max-w-sm animate-fade-in">{children}</div>
    </div>
  );
}
