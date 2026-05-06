import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import "./../styles/about.css";

const STATS = [
  { value: "500+", label: "Products" },
  { value: "Buy & Rent", label: "Both Options" },
  { value: "Egypt-Wide", label: "Delivery" }
];

const STEPS = [
  {
    number: "01",
    title: "Browse the Catalog",
    body: "Explore curated categories across sound, lighting, stage, furniture, and more — all in one place."
  },
  {
    number: "02",
    title: "Configure Your Setup",
    body: "Choose to buy or rent per item, pick your variations, and build a package that fits your event."
  },
  {
    number: "03",
    title: "Order & Deliver",
    body: "Place your order and we handle delivery to your venue across Egypt — tracked end to end."
  }
];

const TEAM = [
  { name: "Ahmed Salah", role: "CEO & Founder" },
  { name: "Adham Hegab", role: "COO & Co-Founder" },
  { name: "Ahmed Abdo", role: "Operations Manager" }
];

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

function AboutPage() {
  useEffect(() => {
    document.documentElement.classList.add("about-snap-page");
    document.body.classList.add("about-snap-page");
    return () => {
      document.documentElement.classList.remove("about-snap-page");
      document.body.classList.remove("about-snap-page");
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <main className="about-page" data-theme-scope="about">
        <h1 className="sr-only">About EventMart</h1>

        {/* ── Hero ─────────────────────────────────────── */}
        <section className="about-hero" aria-labelledby="about-hero-title">
          <div className="about-hero-inner">
            <motion.div
              className="about-hero-copy"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <p className="about-kicker">WHAT WE DO</p>
              <h2 id="about-hero-title">We make event planning simple.</h2>
              <p>
                EventMart is Egypt's destination for discovering, buying, and renting event
                equipment — sound, lighting, stage, furniture, and more — all in one place.
              </p>
              <div className="about-hero-actions">
                <Link to="/shop" className="about-btn-primary">Shop Now</Link>
                <Link to="/packages" className="about-btn-ghost">View Packages</Link>
              </div>
            </motion.div>

            <motion.div
              className="about-hero-stats"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              {STATS.map((s) => (
                <div key={s.label} className="about-stat-card">
                  <span className="about-stat-value">{s.value}</span>
                  <span className="about-stat-label">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────── */}
        <section className="about-story" aria-labelledby="about-story-title">
          <div className="about-section-inner">
            <motion.div
              className="about-section-head"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={fadeUp}
              transition={{ duration: 0.45 }}
            >
              <p className="about-kicker">HOW IT WORKS</p>
              <h2 id="about-story-title">Three steps from idea to event.</h2>
            </motion.div>

            <div className="about-steps">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.number}
                  className="about-step-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <span className="about-step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Team ─────────────────────────────────────── */}
        <section className="about-team" aria-labelledby="about-team-title">
          <div className="about-section-inner">
            <motion.div
              className="about-section-head"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={fadeUp}
              transition={{ duration: 0.45 }}
            >
              <p className="about-kicker">THE TEAM</p>
              <h2 id="about-team-title">Built by people who plan events.</h2>
              <p className="about-section-sub">
                EventMart is built for planners of all sizes — weddings, corporate events, parties,
                and celebrations. We're here to make it feel easy.
              </p>
            </motion.div>

            <div className="about-team-grid">
              {TEAM.map((member, i) => (
                <motion.article
                  key={member.name}
                  className="about-team-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <div className="about-avatar" aria-hidden="true">
                    {getInitials(member.name)}
                  </div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────── */}
        <section className="about-cta" aria-labelledby="about-cta-title">
          <motion.div
            className="about-cta-inner"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeUp}
            transition={{ duration: 0.45 }}
          >
            <p className="about-kicker">GET STARTED</p>
            <h2 id="about-cta-title">Ready to plan your event?</h2>
            <p>Browse the full catalog or explore pre-built event packages.</p>
            <div className="about-hero-actions">
              <Link to="/shop" className="about-btn-primary">Browse Products</Link>
              <Link to="/packages" className="about-btn-ghost">View Packages</Link>
            </div>
          </motion.div>
        </section>
      </main>
    </motion.div>
  );
}

export default AboutPage;
