import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resolvePostAuthPath } from "../lib/authNavigation";

function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get("token");
    const userRaw = searchParams.get("user");
    const error = searchParams.get("error");

    if (error || !token) {
      navigate("/auth?tab=signin&error=google_failed", { replace: true });
      return;
    }

    try {
      const user = userRaw ? JSON.parse(decodeURIComponent(userRaw)) : null;
      loginWithToken(token, user);
      const returnTo = searchParams.get("returnTo");
      navigate(resolvePostAuthPath(returnTo), { replace: true });
    } catch (_err) {
      navigate("/auth?tab=signin&error=google_failed", { replace: true });
    }
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "var(--c-6, #475569)", fontFamily: "sans-serif" }}>Signing you in with Google…</p>
    </div>
  );
}

export default AuthCallbackPage;
