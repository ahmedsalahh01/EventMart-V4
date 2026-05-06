import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resolvePostAuthPath } from "../lib/authNavigation";
import { apiRequest } from "../lib/api";
import "./../styles/auth.css";

const INITIAL_SIGNIN_FORM = {
  identifier: "",
  password: ""
};

const INITIAL_REGISTER_FORM = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: ""
};

const INITIAL_STATUS = {
  message: "",
  tone: ""
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,}$/;

function resolveMode(searchParams) {
  return searchParams.get("tab") === "signin" ? "signin" : "signup";
}

function FieldIcon({ icon }) {
  switch (icon) {
    case "user":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 19c1.05-3.1 3.87-4.8 7-4.8S17.95 15.9 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.8v3.4M16 3.8v3.4M4 9.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
          <path d="m4.5 7 6.5 5a1.7 1.7 0 0 0 2 0l6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7.6 4.8h2.2a1.2 1.2 0 0 1 1.16.9l.54 2.4a1.2 1.2 0 0 1-.34 1.14l-1.18 1.18a13 13 0 0 0 5.02 5.02l1.18-1.18a1.2 1.2 0 0 1 1.14-.34l2.4.54a1.2 1.2 0 0 1 .9 1.16v2.2A1.6 1.6 0 0 1 19 21.2C10.72 21.2 4 14.48 4 6.2a1.6 1.6 0 0 1 1.6-1.4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function AuthField({
  action,
  actionLabel,
  autoComplete,
  error,
  icon,
  id,
  inputMode,
  label,
  max,
  name,
  onBlur,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value
}) {
  const messageId = `${id}-message`;
  const shellClassName = [
    "auth-input-shell",
    error ? "is-invalid" : "",
    type === "date" ? "is-date" : "",
    type === "date" && !value ? "is-empty" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="auth-field-block">
      <label className="auth-input-label" htmlFor={id}>
        {label}
      </label>

      <div className={shellClassName} data-placeholder={type === "date" ? placeholder : ""}>
        <span className="auth-input-icon">
          <FieldIcon icon={icon} />
        </span>

        <input
          aria-describedby={messageId}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          id={id}
          inputMode={inputMode}
          max={max}
          name={name}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={type === "date" ? "" : placeholder}
          required={required}
          type={type}
          value={value}
        />

        {action ? (
          <button
            type="button"
            className="auth-input-action"
            onClick={action}
            aria-label={actionLabel}
          >
            {actionLabel}
          </button>
        ) : (
          <span className="auth-input-action auth-input-action-spacer" aria-hidden="true" />
        )}
      </div>

      <p className={`auth-input-message ${error ? "is-visible" : ""}`.trim()} id={messageId}>
        {error || " "}
      </p>
    </div>
  );
}

function validateSignIn(form) {
  const errors = {};
  const identifier = String(form.identifier || "").trim();

  if (!identifier) {
    errors.identifier = "Enter your email address or phone number.";
  } else if (!identifier.includes("@")) {
    errors.identifier = "Phone number sign in is not available yet. Use your email for now.";
  } else if (!EMAIL_REGEX.test(identifier)) {
    errors.identifier = "Enter a valid email address.";
  }

  if (!String(form.password || "")) {
    errors.password = "Enter your password.";
  }

  return errors;
}

function validateRegister(form) {
  const errors = {};

  if (!String(form.firstName || "").trim()) {
    errors.firstName = "Enter your first name.";
  }

  if (!String(form.lastName || "").trim()) {
    errors.lastName = "Enter your last name.";
  }

  if (!String(form.birthDate || "").trim()) {
    errors.birthDate = "Select your date of birth.";
  } else if (form.birthDate > new Date().toISOString().slice(0, 10)) {
    errors.birthDate = "Date of birth cannot be in the future.";
  }

  if (!String(form.email || "").trim()) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!String(form.phone || "").trim()) {
    errors.phone = "Enter your phone number.";
  } else if (!PHONE_REGEX.test(form.phone.trim())) {
    errors.phone = "Enter a valid phone number.";
  }

  if (!String(form.password || "")) {
    errors.password = "Create a password.";
  } else if (!/[A-Z]/.test(form.password)) {
    errors.password = "Use at least one uppercase letter.";
  } else if (!/[\d\W_]/.test(form.password)) {
    errors.password = "Use at least one number or symbol.";
  } else if (form.password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }

  if (!String(form.confirmPassword || "")) {
    errors.confirmPassword = "Confirm your password.";
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, register } = useAuth();
  const mode = resolveMode(searchParams);
  const isSignUp = mode === "signup";
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [signInForm, setSignInForm] = useState(INITIAL_SIGNIN_FORM);
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM);
  const [signInErrors, setSignInErrors] = useState({});
  const [registerErrors, setRegisterErrors] = useState({});
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(null); // null | "request" | "reset"
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotGeneratedToken, setForgotGeneratedToken] = useState("");

  const maxBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const passwordRules = useMemo(
    () => [
      {
        id: "uppercase",
        label: "At least one uppercase letter",
        met: /[A-Z]/.test(registerForm.password)
      },
      {
        id: "number-symbol",
        label: "At least one number or symbol",
        met: /[\d\W_]/.test(registerForm.password)
      },
      {
        id: "length",
        label: "Minimum 8 characters",
        met: registerForm.password.length >= 8
      },
      {
        id: "match",
        label: "Passwords match",
        met: Boolean(registerForm.password) && registerForm.password === registerForm.confirmPassword
      }
    ],
    [registerForm.password, registerForm.confirmPassword]
  );

  const activeStatusMessage =
    status.message ||
    (isSignUp
      ? "Set up your EventMart account to save favorites, track orders, and check out faster."
      : "Welcome back. Sign in securely to continue to EventMart.");

  function nextRoute() {
    return resolvePostAuthPath(searchParams.get("returnTo"));
  }

  function clearStatus() {
    setStatus(INITIAL_STATUS);
  }

  function setMode(nextMode) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextMode);
    setSearchParams(nextParams, { replace: true });
    clearStatus();
  }

  function updateSignInField(field, value) {
    setSignInForm((current) => ({ ...current, [field]: value }));
    setSignInErrors((current) => ({ ...current, [field]: "" }));
    clearStatus();
  }

  function updateRegisterField(field, value) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setRegisterErrors((current) => ({ ...current, [field]: "" }));
    clearStatus();
  }

  function handleSignInBlur(field) {
    const errors = validateSignIn(signInForm);
    setSignInErrors((current) => ({ ...current, [field]: errors[field] || "" }));
  }

  function handleRegisterBlur(field) {
    const errors = validateRegister(registerForm);
    setRegisterErrors((current) => ({ ...current, [field]: errors[field] || "" }));
  }

  async function handleSignIn(event) {
    event.preventDefault();

    const errors = validateSignIn(signInForm);
    if (Object.keys(errors).length) {
      setSignInErrors(errors);
      setStatus({
        message: "Please fix the highlighted sign-in fields and try again.",
        tone: "error"
      });
      return;
    }

    setStatus({ message: "Signing you in...", tone: "pending" });

    try {
      const payload = await login({
        email: signInForm.identifier.trim(),
        password: signInForm.password
      });

      setStatus({
        message: `Welcome back, ${payload.user.name}! Redirecting...`,
        tone: "success"
      });

      window.setTimeout(() => navigate(nextRoute()), 800);
    } catch (error) {
      setStatus({
        message: error.message || "Sign in failed.",
        tone: "error"
      });
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const errors = validateRegister(registerForm);
    if (Object.keys(errors).length) {
      setRegisterErrors(errors);
      setStatus({
        message: "Please fix the highlighted sign-up fields and try again.",
        tone: "error"
      });
      return;
    }

    setStatus({ message: "Creating your account...", tone: "pending" });

    try {
      const payload = await register({
        name: `${registerForm.firstName} ${registerForm.lastName}`.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password
      });

      setStatus({
        message: `Welcome, ${payload.user.name}! Redirecting...`,
        tone: "success"
      });

      setRegisterForm(INITIAL_REGISTER_FORM);
      setRegisterErrors({});
      window.setTimeout(() => navigate(nextRoute()), 800);
    } catch (error) {
      setStatus({
        message: error.message || "Registration failed.",
        tone: "error"
      });
    }
  }

  function handleForgotPassword() {
    setForgotStep("request");
    setForgotEmail("");
    setForgotToken("");
    setForgotNewPassword("");
    setForgotGeneratedToken("");
    clearStatus();
  }

  function handleCancelForgot() {
    setForgotStep(null);
    clearStatus();
  }

  async function handleForgotRequest(event) {
    event.preventDefault();
    if (!forgotEmail.trim()) return;
    setStatus({ message: "Requesting reset code…", tone: "pending" });
    try {
      const data = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: forgotEmail.trim() }
      });
      setForgotGeneratedToken(data?.reset_token || "");
      setForgotStep("reset");
      setStatus({ message: data?.message || "Code generated.", tone: "success" });
    } catch (err) {
      setStatus({ message: err?.message || "Request failed.", tone: "error" });
    }
  }

  async function handleForgotReset(event) {
    event.preventDefault();
    if (!forgotToken.trim() || !forgotNewPassword) return;
    setStatus({ message: "Resetting password…", tone: "pending" });
    try {
      const data = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token: forgotToken.trim(), password: forgotNewPassword }
      });
      setForgotStep(null);
      setStatus({ message: data?.message || "Password updated! You can now sign in.", tone: "success" });
    } catch (err) {
      setStatus({ message: err?.message || "Reset failed.", tone: "error" });
    }
  }

  return (
    <>
      <Link to="/" className="auth-fixed-logo" aria-label="EventMart Home">
        <img className="auth-fixed-logo-image" src="/assets/eventmart-navbar-logo.png" alt="" />
      </Link>

      <motion.main
        className="auth-shell"
        data-theme-scope="auth"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <section className="auth-surface">
          <motion.section
            className="auth-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
          >
            <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={`auth-mode-pill ${isSignUp ? "is-active" : ""}`.trim()}
                role="tab"
                aria-selected={isSignUp}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
              <button
                type="button"
                className={`auth-mode-pill ${!isSignUp ? "is-active" : ""}`.trim()}
                role="tab"
                aria-selected={!isSignUp}
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
            </div>

            <div className="auth-copy">
              <p className="auth-kicker">EventMart Account</p>
              <h1>{isSignUp ? "Sign Up" : "Sign In"}</h1>
              <p>
                {isSignUp
                  ? "Fill in your details to create an EventMart account."
                  : "Welcome back. Sign in to continue to EventMart."}
              </p>
            </div>

            <p className={`auth-status ${status.tone ? `is-${status.tone}` : ""}`.trim()} aria-live="polite">
              {activeStatusMessage}
            </p>

            <motion.div
              key={mode}
              className="auth-mode-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {isSignUp ? (
                <form className="auth-form" onSubmit={handleRegister} noValidate>
                  <div className="auth-field-row auth-field-row-split">
                    <AuthField
                      autoComplete="given-name"
                      error={registerErrors.firstName}
                      icon="user"
                      id="registerFirstName"
                      label="First Name"
                      name="firstName"
                      onBlur={() => handleRegisterBlur("firstName")}
                      onChange={(event) => updateRegisterField("firstName", event.target.value)}
                      placeholder="First name"
                      required
                      value={registerForm.firstName}
                    />
                    <AuthField
                      autoComplete="family-name"
                      error={registerErrors.lastName}
                      icon="user"
                      id="registerLastName"
                      label="Last Name"
                      name="lastName"
                      onBlur={() => handleRegisterBlur("lastName")}
                      onChange={(event) => updateRegisterField("lastName", event.target.value)}
                      placeholder="Last name"
                      required
                      value={registerForm.lastName}
                    />
                  </div>

                  <AuthField
                    error={registerErrors.birthDate}
                    icon="calendar"
                    id="registerBirthDate"
                    label="Date of Birth"
                    max={maxBirthDate}
                    name="birthDate"
                    onBlur={() => handleRegisterBlur("birthDate")}
                    onChange={(event) => updateRegisterField("birthDate", event.target.value)}
                    placeholder="Date of birth"
                    required
                    type="date"
                    value={registerForm.birthDate}
                  />

                  <AuthField
                    autoComplete="email"
                    error={registerErrors.email}
                    icon="email"
                    id="registerEmail"
                    inputMode="email"
                    label="Email"
                    name="email"
                    onBlur={() => handleRegisterBlur("email")}
                    onChange={(event) => updateRegisterField("email", event.target.value)}
                    placeholder="Email address"
                    required
                    type="email"
                    value={registerForm.email}
                  />

                  <AuthField
                    autoComplete="tel"
                    error={registerErrors.phone}
                    icon="phone"
                    id="registerPhone"
                    inputMode="tel"
                    label="Phone Number"
                    name="phone"
                    onBlur={() => handleRegisterBlur("phone")}
                    onChange={(event) => updateRegisterField("phone", event.target.value)}
                    placeholder="Phone number"
                    required
                    type="tel"
                    value={registerForm.phone}
                  />

                  <AuthField
                    action={() => setShowRegisterPassword((current) => !current)}
                    actionLabel={showRegisterPassword ? "Hide" : "Show"}
                    autoComplete="new-password"
                    error={registerErrors.password}
                    icon="lock"
                    id="registerPassword"
                    label="Password"
                    name="password"
                    onBlur={() => handleRegisterBlur("password")}
                    onChange={(event) => updateRegisterField("password", event.target.value)}
                    placeholder="Create a password"
                    required
                    type={showRegisterPassword ? "text" : "password"}
                    value={registerForm.password}
                  />

                  <AuthField
                    action={() => setShowConfirmPassword((current) => !current)}
                    actionLabel={showConfirmPassword ? "Hide" : "Show"}
                    autoComplete="new-password"
                    error={registerErrors.confirmPassword}
                    icon="lock"
                    id="registerConfirmPassword"
                    label="Confirm Password"
                    name="confirmPassword"
                    onBlur={() => handleRegisterBlur("confirmPassword")}
                    onChange={(event) => updateRegisterField("confirmPassword", event.target.value)}
                    placeholder="Confirm your password"
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    value={registerForm.confirmPassword}
                  />

                  <div className="auth-password-rules" aria-label="Password requirements">
                    {passwordRules.map((rule) => (
                      <span key={rule.id} className={`auth-rule-chip ${rule.met ? "is-met" : ""}`.trim()}>
                        {rule.label}
                      </span>
                    ))}
                  </div>

                  <button type="submit" className="auth-submit-btn">
                    Create Account
                  </button>
                </form>
              ) : forgotStep === "request" ? (
                <form className="auth-form" onSubmit={handleForgotRequest} noValidate>
                  <p className="auth-forgot-hint">Enter your account email and we'll generate a reset code.</p>
                  <AuthField
                    autoComplete="email"
                    icon="email"
                    id="forgotEmail"
                    inputMode="email"
                    label="Email Address"
                    name="forgotEmail"
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={forgotEmail}
                  />
                  <button type="submit" className="auth-submit-btn">Send Reset Code</button>
                  <button type="button" className="auth-inline-link" style={{ marginTop: "8px" }} onClick={handleCancelForgot}>
                    ← Back to sign in
                  </button>
                </form>
              ) : forgotStep === "reset" ? (
                <form className="auth-form" onSubmit={handleForgotReset} noValidate>
                  {forgotGeneratedToken && (
                    <div className="auth-reset-token-box">
                      <p className="auth-forgot-hint">Your reset code (copy this):</p>
                      <code className="auth-reset-token-value">{forgotGeneratedToken}</code>
                    </div>
                  )}
                  <AuthField
                    icon="lock"
                    id="forgotToken"
                    label="Reset Code"
                    name="forgotToken"
                    onChange={(e) => setForgotToken(e.target.value)}
                    placeholder="Paste your reset code"
                    required
                    type="text"
                    value={forgotToken}
                  />
                  <AuthField
                    icon="lock"
                    id="forgotNewPassword"
                    label="New Password"
                    name="forgotNewPassword"
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    required
                    type="password"
                    value={forgotNewPassword}
                  />
                  <button type="submit" className="auth-submit-btn">Set New Password</button>
                  <button type="button" className="auth-inline-link" style={{ marginTop: "8px" }} onClick={handleCancelForgot}>
                    ← Back to sign in
                  </button>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleSignIn} noValidate>
                  <AuthField
                    autoComplete="username"
                    error={signInErrors.identifier}
                    icon="email"
                    id="signInIdentifier"
                    inputMode="email"
                    label="Email or Phone Number"
                    name="identifier"
                    onBlur={() => handleSignInBlur("identifier")}
                    onChange={(event) => updateSignInField("identifier", event.target.value)}
                    placeholder="name@example.com"
                    required
                    type="text"
                    value={signInForm.identifier}
                  />

                  <AuthField
                    action={() => setShowSignInPassword((current) => !current)}
                    actionLabel={showSignInPassword ? "Hide" : "Show"}
                    autoComplete="current-password"
                    error={signInErrors.password}
                    icon="lock"
                    id="signInPassword"
                    label="Password"
                    name="password"
                    onBlur={() => handleSignInBlur("password")}
                    onChange={(event) => updateSignInField("password", event.target.value)}
                    placeholder="Enter your password"
                    required
                    type={showSignInPassword ? "text" : "password"}
                    value={signInForm.password}
                  />

                  <div className="auth-inline-meta">
                    <button type="button" className="auth-inline-link" onClick={handleForgotPassword}>
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" className="auth-submit-btn">
                    Sign In
                  </button>
                </form>
              )}

              <p className="auth-footer-copy">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button type="button" className="auth-helper-link" onClick={() => setMode("signin")}>
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{" "}
                    <button type="button" className="auth-helper-link" onClick={() => setMode("signup")}>
                      Sign Up
                    </button>
                  </>
                )}
              </p>
            </motion.div>
          </motion.section>
        </section>
      </motion.main>
    </>
  );
}

export default AuthPage;
