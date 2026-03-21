import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import Checklists from "./pages/Checklists";
import Schedule from "./pages/Schedule";
import MobileAudit from "./pages/MobileAudit";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import ChecklistTemplate from "./pages/ChecklistTemplate";
import MyAudits from "./pages/MyAudits";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/checklists" element={<Checklists />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/mobile-audit" element={<MobileAudit />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/checklist-template" element={<ChecklistTemplate />} />
        <Route path="/my-audits" element={<MyAudits />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
