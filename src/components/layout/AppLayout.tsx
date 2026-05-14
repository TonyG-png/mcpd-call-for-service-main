import { Outlet, Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { useData } from "@/context/DataContext";
import { Loader2 } from "lucide-react";
import GlobalFilters from "@/components/filters/GlobalFilters";
import { Sun, Moon, RefreshCw, BarChart3, Map, MapPin, Layers, Table2, Menu, X, Timer, FileText, ShieldAlert } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: BarChart3 },
  { path: "/operations", label: "Operations", icon: Layers },
  { path: "/response-times", label: "Response Times", icon: Timer },
  { path: "/map", label: "Map", icon: Map },
  { path: "/locations", label: "Locations", icon: MapPin },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/use-of-force", label: "Use of Force", icon: ShieldAlert },
  { path: "/explorer", label: "Explorer", icon: Table2 },
];

export default function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { lastRefreshed, refresh, isLoading, loadProgress } = useData();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <img
              src="/mcpd-seal.png"
              alt="Montgomery County Department of Police seal"
              className="h-9 w-9 rounded-full object-cover"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold leading-tight font-display">MCPD Calls for Service</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Montgomery County, MD</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="hidden lg:block text-[10px] text-muted-foreground">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border bg-card px-4 py-2 flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Sync progress bar */}
      {isLoading && (
        <div className="sticky top-14 z-40 bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs font-medium text-primary">
            Syncing data… {loadProgress > 0 ? `Loaded ${loadProgress.toLocaleString()} records` : "Connecting…"}
          </span>
        </div>
      )}

      {/* Filters */}
      {location.pathname !== "/response-times" && <GlobalFilters />}

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
