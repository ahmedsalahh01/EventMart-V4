import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import "../styles/info-pages.css";

const SECTIONS = [
  {
    title: "Delivery Areas",
    body: "We currently deliver across Cairo and Greater Cairo, including Nasr City, New Cairo, Heliopolis, Maadi, Zamalek, 6th of October, and surrounding areas."
  },
  {
    title: "Same-Day Delivery",
    body: "Orders placed before 12:00 PM are eligible for same-day delivery within Cairo. Orders placed after noon are scheduled for the next available delivery slot."
  },
  {
    title: "Scheduled Delivery",
    body: "You can choose a preferred delivery date and time window during checkout. We will confirm availability within a few hours of placing your order."
  },
  {
    title: "Delivery Fees",
    body: "Delivery fees are calculated based on your location and order size. The exact fee is shown at checkout before you confirm your order."
  },
  {
    title: "Setup Support",
    body: "Our team can assist with on-site setup of equipment upon request. Please mention this in the special requests field at checkout or contact us in advance."
  },
  {
    title: "Packaging",
    body: "All equipment is packed and handled by our logistics team to ensure it arrives in perfect condition. Do not attempt to repackage rental items — use the original packaging for return."
  },
  {
    title: "Delays & Issues",
    body: "In the rare event of a delivery delay, our team will contact you immediately to reschedule. Contact us at info@eventmart.com or call (+20) 128 6399 9939 for urgent support."
  }
];

function ShippingInfoPage() {
  return (
    <motion.main
      className="info-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="info-page-inner">
        <p className="info-page-eyebrow">Logistics</p>
        <h1 className="info-page-title">Shipping & Delivery Info</h1>
        <p className="info-page-lead">Everything you need to know about how we get your equipment to your event, on time.</p>

        <div className="info-sections">
          {SECTIONS.map((s) => (
            <div className="info-section" key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          ))}
        </div>

        <div className="info-page-cta">
          <p>Need a custom delivery arrangement?</p>
          <Link to="/contact" className="info-page-btn">Contact Us</Link>
        </div>
      </div>
    </motion.main>
  );
}

export default ShippingInfoPage;
