import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/auth";
import Layout from "./components/Layout";
import Assistant from "./components/Assistant";
import ProviderProfile from "./pages/ProviderProfile";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import Inbox from "./pages/Inbox";
function AccountAssistant() {
  const { user } = useAuth();
  return <Assistant key={user?.id || "guest"} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route
            path="/register"
            element={<AuthPage key="register" register />}
          />
          <Route path="/services/:id" element={<ProviderProfile />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/messages/:id?" element={<Inbox />} />
          <Route
            path="*"
            element={
              <div className="container empty-state">
                <h1>Page not found</h1>
                <a className="button" href="/">
                  Back to home
                </a>
              </div>
            }
          />
        </Routes>
        <AccountAssistant />
      </Layout>
    </AuthProvider>
  );
}
