import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: number; // percentage change
}

export default function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <div className="dashboard-card p-4 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold font-display">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend !== undefined && trend !== 0 && (
            <p className={`text-xs font-medium ${trend > 0 ? "text-destructive" : "text-chart-4"}`}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs prev period
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-md bg-primary/10 text-primary">{icon}</div>
        )}
      </div>
    </div>
  );
}
