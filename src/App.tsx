import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/context/DataContext";
import AppLayout from "@/components/layout/AppLayout";
import ExecutiveOverview from "./pages/Index";
import MapPage from "./pages/MapPage";
import TopLocationsPage from "./pages/TopLocationsPage";
import OperationsPage from "./pages/OperationsPage";
import IncidentExplorer from "./pages/IncidentExplorer";
import ResponseTimesPage from "./pages/ResponseTimesPage";
import ReportsPage from "./pages/ReportsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <DataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<ExecutiveOverview />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/locations" element={<TopLocationsPage />} />
                <Route path="/operations" element={<OperationsPage />} />
                <Route path="/explorer" element={<IncidentExplorer />} />
                <Route path="/response-times" element={<ResponseTimesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </DataProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
