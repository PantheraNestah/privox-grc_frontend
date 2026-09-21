import { Card } from "@/components/ui/card";

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4 shadow-none">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-navy-deep">{value}</p>
    </Card>
  );
}
