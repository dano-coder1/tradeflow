import { SymbolDetail } from "@/features/markets/SymbolDetail";

export default async function SymbolPage(props: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await props.params;
  return <SymbolDetail symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
