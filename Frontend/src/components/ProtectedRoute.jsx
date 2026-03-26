import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAuthRedirectPath } from "../lib/authNavigation";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const redirectPath = getAuthRedirectPath({ isAuthenticated, location });

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return children ?? <Outlet />;
}

export default ProtectedRoute;
