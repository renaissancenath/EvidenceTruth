import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./auth";
import { PublicLayout } from "./components/PublicLayout";
import { AppLayout } from "./components/AppLayout";
import { RouteError } from "./components/RouteError";
import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";
import { Privacy, Terms } from "./pages/Legal";
import { Login } from "./pages/Login";
import { Verify } from "./pages/Verify";
import { Welcome } from "./pages/Welcome";
import { Check } from "./pages/Check";
import { ScanPage } from "./pages/ScanPage";
import { Citations } from "./pages/Citations";
import { Documents } from "./pages/Documents";
import { Code } from "./pages/Code";
import { Attempts } from "./pages/Attempts";
import { History } from "./pages/History";
import { Dashboard } from "./pages/Dashboard";
import { Billing } from "./pages/Billing";
import { Settings } from "./pages/Settings";
import { Report } from "./pages/Report";
import { NotFound } from "./pages/NotFound";

function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="page muted" role="status">Loading your account</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!user.onboarded && loc.pathname !== "/app/welcome") return <Navigate to="/app/welcome" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { element: <PublicLayout />, children: [
        { path: "/", element: <Landing /> },
        { path: "/pricing", element: <Pricing /> },
        { path: "/privacy", element: <Privacy /> },
        { path: "/terms", element: <Terms /> },
        { path: "/login", element: <Login /> },
        { path: "/auth/verify", element: <Verify /> },
        { path: "/report", element: <Report /> },
        { path: "*", element: <NotFound /> },
      ] },
      { element: <RequireAuth />, children: [
        { path: "/app/welcome", element: <Welcome /> },
        { element: <AppLayout />, children: [
          { path: "/app", element: <Check /> },
          { path: "/app/scan/:id", element: <ScanPage /> },
          { path: "/app/citations", element: <Citations /> },
          { path: "/app/documents", element: <Documents /> },
          { path: "/app/code", element: <Code /> },
          { path: "/app/attempts", element: <Attempts /> },
          { path: "/app/history", element: <History /> },
          { path: "/app/dashboard", element: <Dashboard /> },
          { path: "/app/billing", element: <Billing /> },
          { path: "/app/settings", element: <Settings /> },
          { path: "/app/report", element: <Report /> },
        ] },
      ] },
    ],
  },
]);
