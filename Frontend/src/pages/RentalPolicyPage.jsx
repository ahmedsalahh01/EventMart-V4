import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import "../styles/info-pages.css";

const SECTIONS = [
  {
    title: "Rental Period",
    body: "Rentals are charged per day. The minimum rental period is 1 day. Rental days are counted from the delivery date to the scheduled pickup date."
  },
  {
    title: "Advance Payment",
    body: "A 30% deposit is required at the time of booking to confirm your rental. The remaining balance is collected on or before delivery."
  },
  {
    title: "Equipment Condition",
    body: "All equipment is inspected and tested before dispatch. You are responsible for any damage, loss, or theft that occurs during the rental period beyond normal wear and tear."
  },
  {
    title: "Cancellations",
    body: "Cancellations made more than 48 hours before the delivery date are eligible for a full refund of the deposit. Cancellations within 48 hours may forfeit the deposit."
  },
  {
    title: "Extensions",
    body: "Need the equipment longer? Contact us before your rental period ends and we will arrange an extension subject to availability. Additional days are billed at the standard daily rate."
  },
  {
    title: "Returns",
    body: "Equipment must be returned in its original packaging and condition. Our team will inspect items upon return. Damage fees will be assessed if applicable."
  },
  {
    title: "Delivery & Pickup",
    body: "We handle delivery and pickup directly. Ensure someone is present at the venue during the agreed time window. Re-scheduling fees may apply for missed appointments."
  }
];

function RentalPolicyPage() {
  return (
    <motion.main
      className="info-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="info-page-inner">
        <p className="info-page-eyebrow">Legal</p>
        <h1 className="info-page-title">Rental Policy</h1>
        <p className="info-page-lead">Please read our rental terms carefully before placing an order. By renting from EventMart you agree to the conditions below.</p>

        <div className="info-sections">
          {SECTIONS.map((s) => (
            <div className="info-section" key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          ))}
        </div>

        <div className="info-page-cta">
          <p>Questions about the policy?</p>
          <Link to="/contact" className="info-page-btn">Contact Us</Link>
        </div>
      </div>
    </motion.main>
  );
}

export default RentalPolicyPage;
