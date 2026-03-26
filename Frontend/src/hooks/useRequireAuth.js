import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAuthRedirectPath } from "../lib/authNavigation";

function useRequireAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function requireAuth(options = {}) {
    const redirectPath = getAuthRedirectPath({
      isAuthenticated,
      returnTo: options.returnTo,
      location,
      tab: options.tab
    });

    if (!redirectPath) {
      return true;
    }

    navigate(redirectPath, { replace: options.replace ?? true });
    return false;
  }

  return { isAuthenticated, requireAuth };
}

export default useRequireAuth;
