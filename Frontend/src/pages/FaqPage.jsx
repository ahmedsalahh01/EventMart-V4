import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import "../styles/info-pages.css";

const FAQS = [
  {
    q: "How do I place an order?",
    a: "Browse the shop, add items to your cart, and proceed to checkout. You'll need an account to complete your order."
  },
  {
    q: "Can I rent equipment instead of buying?",
    a: "Yes. Many products support both buy and rent options. Select your preferred mode on the product page before adding to cart."
  },
  {
    q: "What areas do you deliver to?",
    a: "We deliver across Cairo and Greater Cairo. Same-day delivery is available for orders placed before noon."
  },
  {
    q: "How does the 30% advance payment work?",
    a: "A 30% deposit is collected at checkout to secure your order. The remaining balance is due upon delivery."
  },
  {
    q: "Can I cancel or modify my order?",
    a: "Contact us as soon as possible via email or phone. Modifications can be made before the order is dispatched."
  },
  {
    q: "Do you offer setup support?",
    a: "Yes, setup support is available on request. Mention it in the special requests field during checkout or contact us directly."
  },
  {
    q: "How do I track my order?",
    a: "Visit your profile page to see the status of all your orders in real time."
  },
  {
    q: "Is the AI Planner free to use?",
    a: "Yes. The AI Planner is available to all registered users at no extra cost."
  }
];

function FaqPage() {
  return (
    <motion.main
      className="info-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="info-page-inner">
        <p className="info-page-eyebrow">Support</p>
        <h1 className="info-page-title">Frequently Asked Questions</h1>
        <p className="info-page-lead">Everything you need to know about ordering, delivery, and renting from EventMart.</p>

        <div className="info-faq-list">
          {FAQS.map((item) => (
            <div className="info-faq-item" key={item.q}>
              <h2>{item.q}</h2>
              <p>{item.a}</p>
            </div>
          ))}
        </div>

        <div className="info-page-cta">
          <p>Still have questions?</p>
          <Link to="/contact" className="info-page-btn">Contact Us</Link>
        </div>
      </div>
    </motion.main>
  );
}

export default FaqPage;
