import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resolvePostAuthPath } from "../lib/authNavigation";
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

const SOCIAL_OPTIONS = [
  { id: "google", label: "Continue with Google" },
  { id: "outlook", label: "Continue with Outlook" },
  { id: "apple", label: "Continue with Apple" }
];

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

function SocialIcon({ provider }) {
  switch (provider) {
    case "google":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12.2c0-.75-.07-1.45-.19-2.14H12v4.05h5.04a4.42 4.42 0 0 1-1.87 2.89v2.4h3.09c1.81-1.67 2.74-4.12 2.74-7.2Z" fill="currentColor" />
          <path d="M12 21c2.52 0 4.63-.84 6.17-2.28l-3.09-2.4c-.86.57-1.95.91-3.08.91-2.37 0-4.38-1.6-5.1-3.74H3.7v2.47A9.31 9.31 0 0 0 12 21Z" fill="currentColor" opacity="0.72" />
          <path d="M6.9 13.49A5.58 5.58 0 0 1 6.6 12c0-.52.1-1.03.3-1.49V8.04H3.7A9.02 9.02 0 0 0 2.75 12c0 1.45.35 2.83.95 3.96l3.2-2.47Z" fill="currentColor" opacity="0.58" />
          <path d="M12 6.78c1.37 0 2.6.47 3.56 1.4l2.67-2.67C16.63 4.02 14.52 3 12 3A9.31 9.31 0 0 0 3.7 8.04l3.2 2.47C7.62 8.38 9.63 6.78 12 6.78Z" fill="currentColor" opacity="0.86" />
        </svg>
      );
    case "outlook":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13.5 4h6.25A1.25 1.25 0 0 1 21 5.25v13.5A1.25 1.25 0 0 1 19.75 20H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.5 7.5H21l-4.35 4.11a1.7 1.7 0 0 1-2.3 0L10 7.5h3.5Z" fill="currentColor" opacity="0.28" />
          <rect x="3" y="6" width="10" height="12" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 14.6c1.66 0 3-1.43 3-3.2s-1.34-3.2-3-3.2-3 1.43-3 3.2 1.34 3.2 3 3.2Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "apple":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15.23 5.38c.74-.89 1.22-2.12 1.08-3.38-1.08.07-2.37.72-3.11 1.61-.68.8-1.28 2.04-1.12 3.22 1.21.09 2.41-.61 3.15-1.45Z" fill="currentColor" />
          <path d="M18.25 12.76c.02-2.2 1.8-3.25 1.88-3.3-1.03-1.5-2.62-1.71-3.18-1.73-1.34-.14-2.63.8-3.31.8-.7 0-1.76-.78-2.9-.76-1.48.02-2.87.87-3.63 2.2-1.57 2.72-.4 6.73 1.12 8.93.74 1.08 1.61 2.27 2.77 2.23 1.12-.05 1.54-.72 2.9-.72 1.35 0 1.73.72 2.92.69 1.2-.02 1.95-1.08 2.68-2.17.86-1.25 1.22-2.47 1.23-2.54-.02-.01-2.45-.94-2.48-3.63Z" fill="currentColor" opacity="0.88" />
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
    setStatus({
      message: "Password reset is not connected yet. Please use your existing password for now.",
      tone: "info"
    });
  }

  function handleSocialClick(providerLabel) {
    setStatus({
      message: `${providerLabel} authentication will be available soon.`,
      tone: "info"
    });
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

              <div className="auth-divider" aria-hidden="true">
                <span>or continue with</span>
              </div>

              <div className="auth-social-list">
                {SOCIAL_OPTIONS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className="auth-social-btn"
                    onClick={() => handleSocialClick(provider.label.replace("Continue with ", ""))}
                  >
                    <span className="auth-social-icon">
                      <SocialIcon provider={provider.id} />
                    </span>
                    <span>{provider.label}</span>
                  </button>
                ))}
              </div>

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
