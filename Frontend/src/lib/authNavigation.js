const LEGACY_RETURN_TO_MAP = {
  "Profile.html": "/profile"
};

export function resolvePostAuthPath(returnTo) {
  const requestedPath = String(returnTo || "").trim();
  const normalizedPath = LEGACY_RETURN_TO_MAP[requestedPath] || requestedPath;

  if (!normalizedPath || !normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
    return "/";
  }

  return normalizedPath;
}

export function buildReturnToFromLocation(location) {
  if (!location || typeof location !== "object") {
    return "/";
  }

  const pathname = typeof location.pathname === "string" && location.pathname ? location.pathname : "/";
  const search = typeof location.search === "string" ? location.search : "";
  const hash = typeof location.hash === "string" ? location.hash : "";

  return resolvePostAuthPath(`${pathname}${search}${hash}`);
}

export function buildAuthPath(returnTo, tab = "signin") {
  const params = new URLSearchParams();

  if (tab) {
    params.set("tab", tab);
  }

  if (returnTo != null) {
    const nextPath = resolvePostAuthPath(returnTo);
    if (nextPath !== "/") {
      params.set("returnTo", nextPath);
    }
  }

  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

export function getAuthRedirectPath({ isAuthenticated, returnTo, location, tab = "signin" } = {}) {
  if (isAuthenticated) {
    return null;
  }

  return buildAuthPath(returnTo ?? buildReturnToFromLocation(location), tab);
}

export function shouldShowCartIcon(isAuthenticated) {
  return Boolean(isAuthenticated);
}
