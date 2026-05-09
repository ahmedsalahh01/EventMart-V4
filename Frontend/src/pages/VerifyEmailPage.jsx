import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authRequest } from "../lib/api";
import "./../styles/auth.css";

function VerifyEmailPage() {
  const { user, token, updateSession } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState({ message: "", tone: "" });
  const [sending, setSending] = useState(false);
  const inputRefs = useRef([]);

  const code = digits.join("");
  const isComplete = code.length === 6 && digits.every((d) => /\d/.test(d));

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (!isComplete) return;
    setStatus({ message: "Verifying…", tone: "pending" });
    try {
      const result = await authRequest("/api/auth/verify-email", token, {
        method: "POST",
        body: { code }
      });
      updateSession({ token: result.token, user: result.user });
      setStatus({ message: "Email verified!", tone: "success" });
      setTimeout(() => navigate("/profile"), 1200);
    } catch (err) {
      setStatus({ message: err?.message || "Invalid or expired code.", tone: "error" });
    }
  }

  async function handleResend() {
    setSending(true);
    setStatus({ message: "Sending new code…", tone: "pending" });
    try {
      const result = await authRequest("/api/auth/send-verification", token, {
        method: "POST"
      });
      setStatus({ message: result?.message || "Code sent!", tone: "success" });
    } catch (err) {
      setStatus({ message: err?.message || "Could not send code.", tone: "error" });
    } finally {
      setSending(false);
    }
  }

  if (!token || !user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--c-6, #475569)" }}>You must be signed in to verify your email.</p>
          <Link to="/auth" style={{ color: "var(--auth-link, #1570ef)" }}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link to="/" className="auth-fixed-logo" aria-label="EventMart Home">
        <img className="auth-fixed-logo-image" src="/assets/eventmart-navbar-logo.png" alt="EventMart" />
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
            <div className="auth-copy">
              <p className="auth-kicker">Email Verification</p>
              <h1>Verify your email</h1>
              <p>
                We sent a 6-digit code to <strong>{user.email}</strong>. Enter it below to verify your account.
              </p>
            </div>

            {status.message && (
              <p className={`auth-status is-${status.tone}`} aria-live="polite">
                {status.message}
              </p>
            )}

            <form className="auth-form" onSubmit={handleVerify} noValidate>
              <div className="verify-digit-row" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    className="verify-digit-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={!isComplete}
              >
                Verify Email
              </button>
            </form>

            <p className="auth-footer-copy">
              Didn&apos;t get a code?{" "}
              <button
                type="button"
                className="auth-helper-link"
                onClick={handleResend}
                disabled={sending}
              >
                {sending ? "Sending…" : "Resend code"}
              </button>
            </p>

            <p className="auth-footer-copy">
              <Link to="/profile" className="auth-helper-link">
                ← Back to profile
              </Link>
            </p>
          </motion.section>
        </section>
      </motion.main>
    </>
  );
}

export default VerifyEmailPage;
