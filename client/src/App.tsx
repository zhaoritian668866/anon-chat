import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useRoute } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ChatUserProvider } from "./contexts/ChatUserContext";
import AccessGate from "./components/AccessGate";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";

function ProtectedRoutes() {
  return (
    <AccessGate>
      <ChatUserProvider>
        <Switch>
          <Route path={"/"} component={Home} />
          <Route path={"/chat"} component={Chat} />
          <Route path={"/profile"} component={Profile} />
          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </ChatUserProvider>
    </AccessGate>
  );
}

function Router() {
  const [isAdmin] = useRoute("/admin");

  if (isAdmin) {
    return <Admin />;
  }

  return <ProtectedRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
