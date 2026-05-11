import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import MetricCard from "@/components/dashboard/MetricCard";
import ChartCard from "@/components/dashboard/ChartCard";
import * as analytics from "@/lib/analytics";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, Clock, AlertTriangle, TrendingUp, Moon } from "lucide-react";

const COLORS = ["#06b6d4", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];
const PRIORITY_ZERO_COLOR = "#ef4444";
const PRIORITY_THREE_COLOR = "#10b981";

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function ExecutiveOverview() {
  const { filteredIncidents, availableFields, isLoading, error } = useData();

  const metrics = useMemo(() => {
    const inc = filteredIncidents;
    const byDay = analytics.callsByDay(inc);
    const byHour = analytics.callsByHour(inc);
    const topTypes = analytics.topCallTypes(inc, 10);
    const priorities = analytics.priorityBreakdown(inc);
    const districts = analytics.districtBreakdown(inc);
    const rolling = analytics.rollingAverage(byDay, 7);
    const dur = analytics.avgDuration(inc);
    const overnight = analytics.overnightCalls(inc);
    const avgPerDay = byDay.length > 0 ? Math.round(inc.length / byDay.length) : 0;
    const highPri = priorities.find(
      (p) => p.priority?.toLowerCase().includes("emergency") || p.priority === "1" || p.priority?.toLowerCase().includes("high")
    );
    return { byDay, byHour, topTypes, priorities, districts, rolling, dur, overnight, avgPerDay, highPri };
  }, [filteredIncidents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading data from Socrata…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2 text-destructive">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold">Executive Overview</h2>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard title="Total Calls" value={filteredIncidents.length.toLocaleString()} icon={<Activity className="h-4 w-4" />} />
        <MetricCard title="Avg / Day" value={metrics.avgPerDay} icon={<TrendingUp className="h-4 w-4" />} />
        {metrics.dur !== null && (
          <MetricCard title="Avg Duration" value={`${metrics.dur} min`} icon={<Clock className="h-4 w-4" />} />
        )}
        {metrics.highPri && (
          <MetricCard title="High Priority" value={metrics.highPri.count.toLocaleString()} icon={<AlertTriangle className="h-4 w-4" />} />
        )}
        <MetricCard title="Overnight (22-06)" value={metrics.overnight.toLocaleString()} icon={<Moon className="h-4 w-4" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Calls by Day" visible={metrics.byDay.length > 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Calls by Hour of Day" visible={metrics.byHour.some((h) => h.count > 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Call Types" visible={availableFields.has("callType") && metrics.topTypes.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.topTypes} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis dataKey="type" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={95} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[2]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Breakdown" visible={availableFields.has("priority") && metrics.priorities.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={metrics.priorities} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={100} label={({ priority, percent }) => `${priority} (${(percent * 100).toFixed(0)}%)`}>
                {metrics.priorities.map((_, i) => (
                  <Cell key={i} fill={getPriorityColor(metrics.priorities[i].priority, i)} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="District Breakdown" visible={availableFields.has("district") && metrics.districts.length > 0}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metrics.districts}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="district" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={COLORS[3]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="7-Day Rolling Average" visible={metrics.rolling.length > 3}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metrics.rolling}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={1} dot={false} name="Daily" />
              <Line type="monotone" dataKey="avg" stroke={COLORS[2]} strokeWidth={2} dot={false} name="7-day Avg" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function getPriorityColor(priority: unknown, index: number) {
  const value = String(priority ?? "").trim();
  if (value === "0") return PRIORITY_ZERO_COLOR;
  if (value === "3") return PRIORITY_THREE_COLOR;
  return COLORS[index % COLORS.length];
}
