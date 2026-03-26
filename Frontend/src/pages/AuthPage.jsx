import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resolvePostAuthPath } from "../lib/authNavigation";
import "./../styles/auth.css";

const INITIAL_REGISTER_FORM = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: ""
};

function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  const [status, setStatus] = useState("");
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM);

  const passwordRules = [
    {
      id: "uppercase",
      label: "1 capital letter",
      met: /[A-Z]/.test(registerForm.password)
    },
    {
      id: "number-symbol",
      label: "1 number or symbol",
      met: /[\d\W_]/.test(registerForm.password)
    },
    {
      id: "match",
      label: "Both passwords must match",
      met: Boolean(registerForm.password) && registerForm.password === registerForm.confirmPassword
    },
    {
      id: "length",
      label: "Minimum 8 characters",
      met: registerForm.password.length >= 8
    }
  ];

  function nextRoute() {
    return resolvePostAuthPath(searchParams.get("returnTo"));
  }

  function updateRegisterField(field, value) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setStatus("Signing in...");

    try {
      const payload = await login(signInForm);
      setStatus(`Welcome back, ${payload.user.name}! Redirecting...`);
      window.setTimeout(() => navigate(nextRoute()), 800);
    } catch (error) {
      setStatus(error.message || "Sign in failed.");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const fullName = `${registerForm.firstName} ${registerForm.lastName}`.trim();

    if (
      !fullName ||
      !registerForm.birthDate ||
      !registerForm.email ||
      !registerForm.phone ||
      !registerForm.password ||
      !registerForm.confirmPassword
    ) {
      setStatus("Please complete all sign-up fields.");
      return;
    }

    if (!/[A-Z]/.test(registerForm.password)) {
      setStatus("Password needs at least 1 capital letter.");
      return;
    }

    if (!/[\d\W_]/.test(registerForm.password)) {
      setStatus("Password needs at least 1 number or symbol.");
      return;
    }

    if (registerForm.password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setStatus("Both passwords must match.");
      return;
    }

    setStatus("Creating your account...");

    try {
      const payload = await register({
        name: fullName,
        email: registerForm.email,
        password: registerForm.password
      });

      setStatus(`Welcome, ${payload.user.name}! Redirecting...`);
      setRegisterForm(INITIAL_REGISTER_FORM);
      window.setTimeout(() => navigate(nextRoute()), 800);
    } catch (error) {
      setStatus(error.message || "Registration failed.");
    }
  }

  const statusTone =
    /welcome|account created/i.test(status) ? "status-success" : status && !status.endsWith("...") ? "status-error" : "";

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
        transition={{ duration: 0.4 }}
      >
        <section className="auth-stack">
          <section className="login-box auth-panel auth-panel-login">
            <div className="auth-panel-head">
              <p className="auth-kicker">Access your account</p>
              <h2>Login</h2>
            </div>

            <form className="login-form auth-login-form" onSubmit={handleSignIn}>
              <label className="field" htmlFor="signInEmail">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m4.5 7 6.5 5a1.7 1.7 0 0 0 2 0l6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  id="signInEmail"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  required
                  value={signInForm.email}
                  onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>

              <label className="field" htmlFor="signInPassword">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4.5" y="10.5" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  id="signInPassword"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  required
                  value={signInForm.password}
                  onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>

              <button type="submit" className="sign-btn">
                Log In
              </button>
            </form>

            <p className="auth-switch">
              Don&apos;t have an account yet? <a href="#register-panel">Create one below</a>
            </p>
          </section>

          <div className="auth-flow" aria-hidden="true">
            <span className="auth-flow-line" />
            <span className="auth-flow-arrow">↓</span>
            <p>New to Eventmart?</p>
          </div>

          <section id="register-panel" className="auth-register-stage">
            <aside className="auth-requirements">
              <h3>Keep your new account secure.</h3>
              <ul className="auth-rule-list">
                {passwordRules.map((rule) => (
                  <li key={rule.id} className={`auth-rule-item ${rule.met ? "is-met" : ""}`}>
                    {rule.label}
                  </li>
                ))}
              </ul>
            </aside>

            <section className="register-box auth-panel auth-panel-register">
              <div className="auth-panel-head">
                <h2>Sign Up</h2>
                <p className="auth-panel-copy">Fill in your details to create an EventMart account.</p>
              </div>

              <form className="login-form auth-register-form" onSubmit={handleRegister}>
                <div className="form-grid form-grid-register">
                  <label className="field" htmlFor="registerFirstName">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5 20c.9-3.2 3.72-5 7-5s6.1 1.8 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                      id="registerFirstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      placeholder="First Name"
                      required
                      value={registerForm.firstName}
                      onChange={(event) => updateRegisterField("firstName", event.target.value)}
                    />
                  </label>

                  <label className="field" htmlFor="registerLastName">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5 20c.9-3.2 3.72-5 7-5s6.1 1.8 7 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                      id="registerLastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Last Name"
                      required
                      value={registerForm.lastName}
                      onChange={(event) => updateRegisterField("lastName", event.target.value)}
                    />
                  </label>
                </div>

                <label
                  className={`field field-date ${registerForm.birthDate ? "" : "is-empty"}`.trim()}
                  htmlFor="registerBirthDate"
                  data-placeholder="Date of birth"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="4" y="5.5" width="16" height="14" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 3.8v3.4M16 3.8v3.4M4 9.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    id="registerBirthDate"
                    name="birthDate"
                    type="date"
                    aria-label="Date of birth"
                    placeholder="Date of birth"
                    required
                    value={registerForm.birthDate}
                    onChange={(event) => updateRegisterField("birthDate", event.target.value)}
                  />
                </label>

                <label className="field" htmlFor="registerEmail">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m4.5 7 6.5 5a1.7 1.7 0 0 0 2 0l6.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="registerEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    required
                    value={registerForm.email}
                    onChange={(event) => updateRegisterField("email", event.target.value)}
                  />
                </label>

                <label className="field" htmlFor="registerPhone">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M7.6 4.8h2.2a1.2 1.2 0 0 1 1.16.9l.54 2.4a1.2 1.2 0 0 1-.34 1.14l-1.18 1.18a13 13 0 0 0 5.02 5.02l1.18-1.18a1.2 1.2 0 0 1 1.14-.34l2.4.54a1.2 1.2 0 0 1 .9 1.16v2.2A1.6 1.6 0 0 1 19 21.2C10.72 21.2 4 14.48 4 6.2a1.6 1.6 0 0 1 1.6-1.4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <input
                    id="registerPhone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Phone Number"
                    required
                    value={registerForm.phone}
                    onChange={(event) => updateRegisterField("phone", event.target.value)}
                  />
                </label>

                <label className="field" htmlFor="registerPassword">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="4.5" y="10.5" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    id="registerPassword"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Set Password"
                    required
                    value={registerForm.password}
                    onChange={(event) => updateRegisterField("password", event.target.value)}
                  />
                </label>

                <label className="field" htmlFor="registerConfirmPassword">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="4.5" y="10.5" width="15" height="9" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="m9.6 15.2 1.6 1.6 3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="registerConfirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm Password"
                    required
                    value={registerForm.confirmPassword}
                    onChange={(event) => updateRegisterField("confirmPassword", event.target.value)}
                  />
                </label>

                <button type="submit" className="sign-btn">
                  Sign Up
                </button>
              </form>
            </section>
          </section>
        </section>

        <p className={`auth-status ${statusTone}`} aria-live="polite">
          {status}
        </p>
      </motion.main>
    </>
  );
}

export default AuthPage;
