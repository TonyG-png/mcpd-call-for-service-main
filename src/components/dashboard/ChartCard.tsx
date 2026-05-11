import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  visible?: boolean;
}

export default function ChartCard({ title, subtitle, children, visible = true }: ChartCardProps) {
  if (!visible) return null;

  return (
    <div className="dashboard-card p-4 animate-fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-semibold font-display">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
