import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import ChartCard from "@/components/dashboard/ChartCard";
import MetricCard from "@/components/dashboard/MetricCard";
import { getCallTypeCode } from "@/lib/callTypes";
import * as analytics from "@/lib/analytics";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Clock, Calendar, Shield } from "lucide-react";

const COLORS = ["#06b6d4", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function OperationsPage() {
  const { filteredIncidents, availableFields, isLoading } = useData();

  const data = useMemo(() => {
    const inc = filteredIncidents.filter((incident) => !isDetailCallType(incident.callType));
    return {
      byHour: analytics.callsByHour(inc),
      byDow: analytics.callsByDayOfWeek(inc),
      avgByType: analytics.avgTimeByCallTypeCode(inc, 10),
      topCallTypes: getTopCallTypeShare(inc),
      categories: analytics.categoryBreakdown(inc),
      weVsWd: analytics.weekendVsWeekday(inc),
      overnight: analytics.overnightCalls(inc),
      districts: analytics.districtBreakdown(inc),
    };
  }, [filteredIncidents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const busiestHour = data.byHour.reduce((a, b) => (b.count > a.count ? b : a), data.byHour[0]);
  const busiestDay = data.byDow.reduce((a, b) => (b.count > a.count ? b : a), data.byDow[0]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold">Operations Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Busiest Hour" value={busiestHour?.hour || "—"} subtitle={`${busiestHour?.count || 0} calls`} icon={<Clock className="h-4 w-4" />} />
        <MetricCard title="Busiest Day" value={busiestDay?.day || "—"} subtitle={`${busiestDay?.count || 0} calls`} icon={<Calendar className="h-4 w-4" />} />
        <MetricCard title="Overnight Calls" value={data.overnight.toLocaleString()} subtitle="22:00 - 06:00" icon={<Shield className="h-4 w-4" />} />
        <MetricCard
          title="Weekend vs Weekday"
          value={`${data.weVsWd[1]?.count || 0} / ${data.weVsWd[0]?.count || 0}`}
          subtitle="Weekend / Weekday"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Calls by Hour">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Calls by Day of Week">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byDow}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top 5 Call Types"
          subtitle="Share of all filtered calls"
          visible={availableFields.has("callType") && data.topCallTypes.length > 0}
        >
          <div className="space-y-3 pt-2">
            {data.topCallTypes.map((item, index) => (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium text-foreground" title={item.type}>
                      {item.type}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-semibold text-foreground">{item.share.toFixed(1)}%</span>
                    <span className="ml-1 text-muted-foreground">({item.count.toLocaleString()})</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(item.share, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Avg Duration by Call Type (min)" visible={availableFields.has("endTime") && data.avgByType.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.avgByType} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis dataKey="type" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={95} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avgMinutes" fill={COLORS[2]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Calls by Service Category" visible={availableFields.has("serviceCategory") && data.categories.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.categories} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}>
                {data.categories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume by District" visible={availableFields.has("district") && data.districts.length > 0} subtitle="All filtered incidents">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.districts}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="district" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={COLORS[3]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function getTopCallTypeShare(incidents: ReturnType<typeof useData>["filteredIncidents"]) {
  const topTypes = analytics.topCallTypeCodes(incidents, 5);
  const totalCalls = incidents.length;

  return topTypes.map((row) => ({
    ...row,
    share: totalCalls > 0 ? (row.count / totalCalls) * 100 : 0,
  }));
}

function isDetailCallType(callType?: string | null) {
  return getCallTypeCode(callType) === "DT";
}
