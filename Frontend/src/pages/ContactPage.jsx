import { motion } from "framer-motion";
import { useState } from "react";
import { apiRequest } from "../lib/api";
import "./../styles/contact.css";

const INITIAL_FORM = { fullName: "", email: "", subject: "", message: "" };

function ContactPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ message: "", tone: "" });
  const [loading, setLoading] = useState(false);

  function setField(field) {
    return (e) => setForm((cur) => ({ ...cur, [field]: e.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus({ message: "", tone: "" });

    try {
      const data = await apiRequest("/api/contact", {
        method: "POST",
        body: form
      });
      setStatus({ message: data?.message || "Message sent! We'll be in touch soon.", tone: "success" });
      setForm(INITIAL_FORM);
    } catch (err) {
      setStatus({ message: err?.message || "Something went wrong. Please try again.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <main className="contact-page" data-theme-scope="contact">
        <section className="contact-intro">
          <h1>Tell us what you need for your event.</h1>
          <p>
            Whether you want to rent equipment, ask about product availability, or plan the right setup, our team
            will get back to you as soon as possible.
          </p>
        </section>

        <section className="contact-grid" aria-label="Contact details and form">
          <article className="contact-card details-card">
            <h2>Reach us directly</h2>
            <ul className="details-list">
              <li>
                <p className="label">Email</p>
                <a href="mailto:support@eventmart.com">support@eventmart.com</a>
              </li>
              <li>
                <p className="label">Phone</p>
                <a href="tel:+201286999939">+20 128 699 9939</a>
              </li>
              <li>
                <p className="label">Office Hours</p>
                <p>Sunday to Thursday, 9:00 AM - 6:00 PM</p>
              </li>
              <li>
                <p className="label">Address</p>
                <p>New Cairo, Cairo, Egypt</p>
              </li>
            </ul>
          </article>

          <article className="contact-card form-card">
            <h2>Send us a message</h2>
            <form id="contactForm" className="contact-form" onSubmit={handleSubmit}>
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Your name"
                required
                value={form.fullName}
                onChange={setField("fullName")}
              />

              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={setField("email")}
              />

              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                name="subject"
                type="text"
                placeholder="How can we help?"
                required
                value={form.subject}
                onChange={setField("subject")}
              />

              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                rows="6"
                placeholder="Tell us what you need..."
                required
                value={form.message}
                onChange={setField("message")}
              />

              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send Message"}
              </button>

              {status.message && (
                <p
                  id="formStatus"
                  className={`form-status${status.tone === "success" ? " form-status--success" : status.tone === "error" ? " form-status--error" : ""}`}
                  aria-live="polite"
                >
                  {status.message}
                </p>
              )}
            </form>
          </article>
        </section>
      </main>
    </motion.div>
  );
}

export default ContactPage;
