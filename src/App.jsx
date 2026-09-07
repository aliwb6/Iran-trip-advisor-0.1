import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { I18nProvider } from '@/lib/i18n.jsx';
import { ThemeProvider } from '@/lib/ThemeContext.jsx';
import { NotificationsProvider } from '@/lib/NotificationsContext';
import { preloadRoute, routeLoaders } from '@/lib/route-loaders';

import Layout from '@/components/layout/Layout';
// Home is the landing route — kept eager so first paint never waits on a chunk.
import Home from '@/pages/Home';

// Heavy / secondary routes are code-split so they don't bloat the initial bundle.
const Tours = lazy(routeLoaders.tours);
const TourDetails = lazy(routeLoaders.tourDetails);
const PackageDetails = lazy(routeLoaders.packageDetails);
const Dashboard = lazy(routeLoaders.dashboard);
const AdminDashboard = lazy(routeLoaders.adminDashboard);
const Guides = lazy(routeLoaders.guides);
const Agencies = lazy(routeLoaders.agencies);
const GuideDetails = lazy(routeLoaders.guideDetails);
const AgencyProfile = lazy(routeLoaders.agencyProfile);
const TripRequest = lazy(routeLoaders.tripRequest);
const AIAssistant = lazy(routeLoaders.aiAssistant);
const About = lazy(routeLoaders.about);
const Blog = lazy(routeLoaders.blog);
const ArticleDetails = lazy(routeLoaders.articleDetails);
const Chat = lazy(routeLoaders.chat);
const ProfilePage = lazy(routeLoaders.profile);
const SettingsPage = lazy(routeLoaders.settings);
const RequestsPage = lazy(routeLoaders.requests);
const CityPage = lazy(routeLoaders.city);
const FindJobs = lazy(routeLoaders.findJobs);
const MyTripRequests = lazy(routeLoaders.myTrips);
const RequestDetailPage = lazy(routeLoaders.requestDetails);
const Signup = lazy(routeLoaders.signup);
const Login = lazy(routeLoaders.login);
const GuideOnboarding = lazy(routeLoaders.guideOnboarding);
const Toaster = lazy(() => import('@/components/ui/toaster').then((module) => ({ default: module.Toaster })));
const SonnerToaster = lazy(() => import('@/components/ui/sonner').then((module) => ({ default: module.Toaster })));

function DeferredToasters() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const showToasters = () => setReady(true);
    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(showToasters, { timeout: 2400 })
      : window.setTimeout(showToasters, 1400);

    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <Toaster />
      <SonnerToaster richColors position="top-right" />
    </Suspense>
  );
}

function NavigationIntentPreloader() {
  useEffect(() => {
    const warmRoute = (event) => {
      const link = event.target?.closest?.('a[href]');
      if (!link) return;
      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        preloadRoute(url.pathname);
      } catch {
        // Ignore malformed/non-navigational href values.
      }
    };

    document.addEventListener('pointerdown', warmRoute, { passive: true });
    document.addEventListener('focusin', warmRoute);
    return () => {
      document.removeEventListener('pointerdown', warmRoute);
      document.removeEventListener('focusin', warmRoute);
    };
  }, []);

  return null;
}

function PublicStandaloneShell({ children }) {
  return <div className="public-site-shell min-h-screen">{children}</div>;
}

function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-full border-2 border-gold flex items-center justify-center">
        <div className="w-3 h-3 bg-accent rounded-full animate-pulse" />
      </div>
    </div>
  );
}

function TripRequestsRedirect() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-accent animate-spin border-t-transparent" />
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // ALL roles (tourist, guide, agency) go to /profile/requests — the tourist-style trip request page.
  return <Navigate to="/profile/requests" replace />;
}

const AuthenticatedApp = () => {
  return (
    <>
      <NavigationIntentPreloader />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/tours/:slug" element={<TourDetails />} />
            <Route path="/package/:id" element={<PackageDetails />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/:id" element={<GuideDetails />} />
            <Route path="/agencies" element={<Agencies />} />
            <Route path="/agencies/:id" element={<AgencyProfile />} />
            <Route path="/request-trip/:guideId" element={<TripRequest />} />
            <Route path="/request-trip/agency/:guideId" element={<TripRequest />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<ArticleDetails />} />
            <Route path="/destinations/:citySlug" element={<CityPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/settings" element={<SettingsPage />} />
            <Route path="/profile/requests" element={<RequestsPage />} />
            <Route path="/profile/requests/:id" element={<RequestDetailPage />} />
            <Route path="/find-jobs" element={<FindJobs />} />
            <Route path="/my-trips" element={<MyTripRequests />} />
          </Route>
          <Route path="/ai-assistant" element={<PublicStandaloneShell><AIAssistant /></PublicStandaloneShell>} />
          <Route path="/signup" element={<PublicStandaloneShell><Signup /></PublicStandaloneShell>} />
          <Route path="/login" element={<PublicStandaloneShell><Login /></PublicStandaloneShell>} />
          <Route path="/register" element={<PublicStandaloneShell><Signup /></PublicStandaloneShell>} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/guide-onboarding" element={<PublicStandaloneShell><GuideOnboarding /></PublicStandaloneShell>} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:section" element={<Dashboard />} />
          <Route path="/chat/:guideId" element={<PublicStandaloneShell><Chat /></PublicStandaloneShell>} />
          <Route path="/trip-requests" element={<TripRequestsRedirect />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <QueryClientProvider client={queryClientInstance}>
          <ThemeProvider>
            <I18nProvider>
              <Router>
                <AuthenticatedApp />
              </Router>
              <DeferredToasters />
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;
