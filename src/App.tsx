import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { RouteTracker } from "./components/RouteTracker";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/About"));
const Coaching = lazy(() => import("./pages/Coaching"));
const Appointment = lazy(() => import("./pages/Appointment"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const EmailConfirmation = lazy(() => import("./pages/EmailConfirmation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EnAttente = lazy(() => import("./pages/EnAttente"));
const DashboardCoach = lazy(() => import("./pages/DashboardCoach"));
const DashboardSportif = lazy(() => import("./pages/DashboardSportif"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PolitiqueRGPD = lazy(() => import("./pages/PolitiqueRGPD"));
const MentionsLegales = lazy(() => import("./pages/MentionsLegales"));
const CGV = lazy(() => import("./pages/CGV"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PaiementSuccesStandalone = lazy(() => import("./pages/PaiementSuccesStandalone"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <RouteTracker />
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-foreground">Chargement...</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/coaching" element={<Coaching />} />
              <Route path="/appointment" element={<Appointment />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<EmailConfirmation />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/en-attente" element={<EnAttente />} />
              <Route path="/politique-rgpd" element={<PolitiqueRGPD />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/cgv" element={<CGV />} />
              <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
              <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
              {/* Route standalone pour le retour Stripe - ne nécessite pas d'auth immédiate */}
              <Route path="/paiement-succes" element={<PaiementSuccesStandalone />} />
              <Route path="/coach/*" element={<DashboardCoach />} />
              <Route path="/dashboard-sportif/*" element={<DashboardSportif />} />
              <Route path="/sportif/*" element={<DashboardSportif />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
