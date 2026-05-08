import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Overview from "./pages/dashboard/Overview";
import Team from "./pages/dashboard/Team";
import Settings from "./pages/dashboard/Settings";
import Assistant from "./pages/dashboard/Assistant";
import Messages from "./pages/dashboard/Messages";
import Notifications from "./pages/dashboard/Notifications";
import Weather from "./pages/dashboard/Weather";
import Batteries from "./pages/dashboard/Batteries";
import Inverters from "./pages/dashboard/Inverters";
import RealtimeMonitoring from "./pages/dashboard/RealtimeMonitoring";
import Reports from "./pages/dashboard/Reports";
import Notes from "./pages/dashboard/Notes";
import { RequireAuth } from "./components/dashboard/RequireAuth";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster /><Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="team" element={<Team />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="weather" element={<Weather />} />
            <Route path="batteries" element={<Batteries />} />
            <Route path="inverters" element={<Inverters />} />
            <Route path="realtime" element={<RealtimeMonitoring />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notes" element={<Notes />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
  );
};

export default App;
