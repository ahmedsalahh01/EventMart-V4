import { motion } from "framer-motion";
import { Fragment, useEffect, useState } from "react";
import { getEventTypeConfig, listEventTypes, resolveEventType } from "../lib/eventTypeConfig";
import { loadProducts } from "../lib/products";
import { rankProductsForEventType } from "../lib/recommendationEngine";
import "./../styles/ai-planner.css";
import { sendAIPlannerMessage } from "../lib/api";
import { trackEventTypeSelection } from "../lib/userBehavior";

const EVENT_TYPES = listEventTypes();
const VENUE_TYPES = ["Indoor", "Outdoor", "Hybrid", "Rooftop", "Open Hall"];
const PLANNER_MODES = ["quick", "creative", "intelligent"];

const WELCOME_MESSAGE = [
  "Welcome to the AI Event Planner!",
  "",
  "I'll help you build the perfect event setup. You can either:",
  "- Use the quick planner to get instant recommendations",
  "- Chat to describe your event in detail",
  "",
  "Let's create something amazing!"
].join("\n");

function formatMoney(value, currency = "USD") {
  if (!Number.isFinite(Number(value))) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value));
}

function getModeLabel(product) {
  if (product.buy_enabled && product.rent_enabled) return "Buy / Rent";
  if (product.buy_enabled) return "Buy";
  if (product.rent_enabled) return "Rent";
  return "Unavailable";
}

function getDisplayPrice(product) {
  if (product.buy_enabled && Number.isFinite(Number(product.buy_price))) {
    return formatMoney(product.buy_price, product.currency);
  }
  if (product.rent_enabled && Number.isFinite(Number(product.rent_price_per_day))) {
    return `${formatMoney(product.rent_price_per_day, product.currency)}/day`;
  }
  return "Price unavailable";
}

function pickProductsByEventType(eventType, products) {
  const resolvedEventType = resolveEventType(eventType);
  if (!resolvedEventType) return products.slice(0, 5);
  return rankProductsForEventType(products, resolvedEventType).slice(0, 5);
}

function buildLocalPlannerReply(prompt, context, products) {
  const resolvedEventType = resolveEventType(context?.eventType);
  const eventTypeConfig = getEventTypeConfig(resolvedEventType);
  const eventType = eventTypeConfig?.plannerLabel || context?.eventType || "Event";
  const attendees = Number(context?.attendees || 0) || 100;
  const budget = Number(context?.budget || 0) || 5000;
  const venue = context?.venue || "Indoor";
  const picked = pickProductsByEventType(resolvedEventType, products);

  const lines = [
    `### Your ${eventType} Plan`,
    `- **Attendees:** ${attendees}`,
    `- **Venue:** ${venue}`,
    `- **Budget:** ${formatMoney(budget)}`,
    "",
    "### Recommended Products"
  ];

  if (!picked.length) {
    lines.push("- Add products in Admin to get exact recommendations from your catalog.");
  } else {
    picked.forEach((product) => {
      lines.push(`- **${product.name}** (${getModeLabel(product)}) - ${getDisplayPrice(product)}`);
    });
  }

  lines.push(
    "",
    "### Suggested Timeline",
    "- 72 Hours before (For Rented Products): confirm order and major equipment.",
    "- 48 Hours Before: lock product quantities and delivery.",
    "- Event day: setup starts 6-12 hours before opening time.",
    "",
    `I can refine this plan further. Tell me changes for: "${prompt}".`
  );

  return lines.join("\n");
}

function renderInlineText(text) {
  const parts = String(text).split(/(\*\*.*?\*\*)/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function expandInlinePlannerMarkdown(content) {
  return String(content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/([^\n])\s+(###\s+)/g, "$1\n\n$2")
    .replace(/([^\n])\s+-\s+(?=(?:\*\*|[A-Za-z0-9]))/g, "$1\n- ")
    .replace(/\s+(You can refine this plan|I can refine this plan further)\b/g, "\n\n$1")
    .trim();
}

function stripPlannerFollowUp(content) {
  const text = String(content || "").trim();
  const match = text.match(/\b(?:You can refine this plan|I can refine this plan further)\b[\s\S]*$/i);

  if (!match || typeof match.index !== "number") {
    return { content: text, followUp: "" };
  }

  return {
    content: text.slice(0, match.index).trim(),
    followUp: match[0].trim()
  };
}

function collectFormattedMatches(content, expression, formatter) {
  const lines = [];

  for (const match of String(content || "").matchAll(expression)) {
    const line = formatter(match).trim();
    if (line) lines.push(line);
  }

  return lines;
}

function splitBulletLikeItems(content) {
  const normalized = String(content || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^- /, "");

  if (!normalized) return [];

  return normalized
    .split(/\s+-\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);
}

function normalizePlannerSection(section) {
  const trimmedSection = String(section || "").trim();
  if (!trimmedSection) return "";

  const headingMatch = trimmedSection.match(/^###\s+(.+?)(?=\n|\s+-\s+|$)/);
  if (!headingMatch) return trimmedSection;

  const heading = headingMatch[1].trim();
  const body = trimmedSection.slice(headingMatch[0].length).trim();

  if (!body) {
    return `### ${heading}`;
  }

  let bodyLines = [];

  if (/recommended products/i.test(heading)) {
    bodyLines = collectFormattedMatches(
      body,
      /-\s+\*\*(.+?)\*\*\s*\((.+?)\)\s*-\s*([\s\S]*?)(?=(?:\s+-\s+\*\*.+?\*\*\s*\(.+?\)\s*-\s*|$))/g,
      (_match) => `- **${_match[1].trim()}** (${_match[2].trim()}) - ${_match[3].trim()}`
    );
  } else if (/plan/i.test(heading)) {
    bodyLines = collectFormattedMatches(
      body,
      /-\s+\*\*(.+?):\*\*\s*([\s\S]*?)(?=(?:\s+-\s+\*\*.+?:\*\*|$))/g,
      (_match) => `- **${_match[1].trim()}:** ${_match[2].trim()}`
    );
  } else if (/timeline/i.test(heading)) {
    bodyLines = splitBulletLikeItems(body);
  }

  if (!bodyLines.length) {
    bodyLines = splitBulletLikeItems(body);
  }

  if (!bodyLines.length) {
    bodyLines = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [`### ${heading}`, ...bodyLines].join("\n");
}

function normalizePlannerMessage(content) {
  const raw = expandInlinePlannerMarkdown(content);
  if (!raw.includes("###")) return raw;

  const { content: strippedContent, followUp } = stripPlannerFollowUp(raw);
  const sections = strippedContent
    .split(/(?=###\s+)/)
    .map((section) => normalizePlannerSection(section))
    .filter(Boolean);

  if (!sections.length) {
    return raw;
  }

  return [sections.join("\n\n"), followUp].filter(Boolean).join("\n\n");
}

function renderMessageContent(content, { normalizePlanner = false } = {}) {
  const normalizedContent = normalizePlanner ? normalizePlannerMessage(content) : String(content || "");
  const lines = normalizedContent.split("\n");
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineText(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      blocks.push(<p key={`empty-${blocks.length}`} />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push(<h3 key={`heading-${blocks.length}`}>{trimmed.slice(4)}</h3>);
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();
    blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInlineText(trimmed)}</p>);
  });

  flushList();
  return blocks;
}

function normalizeStructuredReply(data) {
  if (!data || typeof data !== "object") return null;

  const summary =
    typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim()
      : typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "";

  const normalized = {
    summary,
    questions: Array.isArray(data.questions) ? data.questions.filter(Boolean) : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations.filter(Boolean) : [],
    timeline: Array.isArray(data.timeline) ? data.timeline.filter(Boolean) : [],
    budgetBreakdown: Array.isArray(data.budgetBreakdown)
      ? data.budgetBreakdown.filter(Boolean)
      : Array.isArray(data.budget_breakdown)
        ? data.budget_breakdown.filter(Boolean)
        : [],
    creativeIdeas: Array.isArray(data.creativeIdeas)
      ? data.creativeIdeas.filter(Boolean)
      : Array.isArray(data.creative_ideas)
        ? data.creative_ideas.filter(Boolean)
        : [],
    warnings: Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : []
  };

  const hasStructuredContent =
    normalized.summary ||
    normalized.questions.length ||
    normalized.recommendations.length ||
    normalized.timeline.length ||
    normalized.budgetBreakdown.length ||
    normalized.creativeIdeas.length ||
    normalized.warnings.length;

  return hasStructuredContent ? normalized : null;
}

function renderStructuredMessage(data) {
  if (!data) return null;

  return (
    <div className="ai-structured-reply">
      {data.summary ? <p>{data.summary}</p> : null}

      {data.questions.length ? (
        <div className="ai-structured-section warning-section">
          <h3>Questions</h3>
          <ul>
            {data.questions.map((question, index) => (
              <li key={`${question}-${index}`}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.recommendations.length ? (
        <div className="ai-structured-section warning-section">
          <h3>Recommendations</h3>
          <div className="ai-recommendation-list">
            {data.recommendations.map((item, index) => {
              const price =
                item?.estimatedCost != null
                  ? formatMoney(item.estimatedCost, item.currency || "USD")
                  : item?.price != null
                    ? formatMoney(item.price, item.currency || "USD")
                    : null;

              return (
                <div key={`${item?.name || "recommendation"}-${index}`} className="ai-recommendation-card">
                  <strong>{item?.name || "Recommended Item"}</strong>
                  {item?.reason ? <p>{item.reason}</p> : null}
                  {price ? <small>Estimated Cost: {price}</small> : null}
                  {item?.priority ? <small>Priority: {item.priority}</small> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {data.budgetBreakdown.length ? (
        <div className="ai-structured-section">
          <h3>Budget Breakdown</h3>
          <ul>
            {data.budgetBreakdown.map((item, index) => (
              <li key={`${item?.label || "budget"}-${index}`}>
                <strong>{item?.label || "Item"}:</strong>{" "}
                {item?.amount != null ? formatMoney(item.amount, item.currency || "USD") : "N/A"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.creativeIdeas.length ? (
        <div className="ai-structured-section">
          <h3>Creative Ideas</h3>
          <ul>
            {data.creativeIdeas.map((idea, index) => (
              <li key={`${idea}-${index}`}>{idea}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.timeline.length ? (
        <div className="ai-structured-section">
          <h3>Suggested Timeline</h3>
          <ul>
            {data.timeline.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.warnings.length ? (
        <div className="ai-structured-section">
          <h3>Warnings</h3>
          <ul>
            {data.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AIPlannerPage() {
  const [planner, setPlanner] = useState({
    eventType: "",
    attendees: "",
    budget: "",
    venue: "",
    mode: "intelligent"
  });

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: WELCOME_MESSAGE, structured: null }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    loadProducts().then((rows) => {
      if (!cancelled) setProducts(rows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function addMessage(role, content, structured = null) {
    setMessages((current) => [
      ...current,
      {
        role,
        content: String(content || ""),
        structured: structured || null
      }
    ]);
  }

  async function requestPlanner(prompt, context) {
    try {
      const data = await sendAIPlannerMessage({
        prompt,
        context: context || {},
        products: products.slice(0, 40)
      });

      const structured = normalizeStructuredReply(data);

      if (structured) {
        return {
          content: structured.summary || "Here is your event plan.",
          structured
        };
      }

      if (typeof data?.message === "string" && data.message.trim()) {
        return {
          content: data.message.trim(),
          structured: null
        };
      }
    } catch (_error) {
      // Fall back to local planner reply below.
    }

    return {
      content: buildLocalPlannerReply(prompt, context, products),
      structured: null
    };
  }

  async function submitPlannerPrompt(prompt, context) {
    setIsTyping(true);
    try {
      const reply = await requestPlanner(prompt, context);
      addMessage("assistant", reply.content, reply.structured);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleQuickPlannerSubmit(event) {
    event.preventDefault();
    if (isTyping) return;

    const eventTypeConfig = getEventTypeConfig(planner.eventType);
    const context = {
      eventType: planner.eventType,
      eventTypeLabel: eventTypeConfig?.plannerLabel || planner.eventType,
      attendees: Number(planner.attendees),
      budget: Number(planner.budget),
      venue: planner.venue,
      mode: planner.mode,
      previousMessages: messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    };

    if (planner.eventType) {
      trackEventTypeSelection(planner.eventType, { source: "ai-planner-quick-form" });
    }

    const prompt = `Plan a ${context.eventTypeLabel || context.eventType} for ${context.attendees} attendees, budget ${context.budget}, venue type ${context.venue}, in ${context.mode} mode.`;
    addMessage("user", prompt);
    await submitPlannerPrompt(prompt, context);
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const text = String(chatInput || "").trim();
    if (!text || isTyping) return;

    setChatInput("");

    const nextMessages = [
      ...messages,
      { role: "user", content: text, structured: null }
    ];
    setMessages(nextMessages);

    const context = {
      eventType: planner.eventType || "",
      eventTypeLabel: getEventTypeConfig(planner.eventType)?.plannerLabel || planner.eventType || "",
      attendees: Number(planner.attendees || 0),
      budget: Number(planner.budget || 0),
      venue: planner.venue || "",
      mode: planner.mode,
      previousMessages: nextMessages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    };

    await submitPlannerPrompt(text, context);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <main className="planner-page" data-theme-scope="planner">
        <header className="planner-header">
          <div className="planner-header-content">
            <p className="planner-kicker">Powered by catalog-aware planning</p>
            <h1>AI Event Planner</h1>
            <p>Get personalized equipment recommendations and event timelines built around your setup.</p>
            <div className="planner-hero-meta" aria-label="Planner capabilities">
              <span>Catalog-aware recommendations</span>
              <span>Budget-smart suggestions</span>
              <span>Instant event timelines</span>
            </div>
          </div>
        </header>

        <section className="planner-layout" aria-label="AI planner workspace">
          <aside className="quick-planner" aria-label="Quick planner form">
            <div className="panel-head">
              <p className="panel-kicker">Instant Setup</p>
              <h2>Quick Planner</h2>
              <p className="panel-copy">Drop in the basics and get a first-pass plan tailored to your event size, venue, and budget.</p>
            </div>

            <form id="quickPlannerForm" className="quick-planner-form" onSubmit={handleQuickPlannerSubmit}>
              <label htmlFor="eventTypeSelect">Event Type</label>
              <select
                id="eventTypeSelect"
                required
                value={planner.eventType}
                onChange={(event) => setPlanner((current) => ({ ...current, eventType: event.target.value }))}
              >
                <option value="">Choose event type</option>
                {EVENT_TYPES.map((value) => (
                  <option key={value.slug} value={value.slug}>
                    {value.label}
                  </option>
                ))}
              </select>

              <label htmlFor="attendeesInput">Number of attendees</label>
              <input
                id="attendeesInput"
                type="number"
                min="1"
                placeholder="Number of attendees"
                required
                value={planner.attendees}
                onChange={(event) => setPlanner((current) => ({ ...current, attendees: event.target.value }))}
              />

              <label htmlFor="budgetInput">Budget ($)</label>
              <input
                id="budgetInput"
                type="number"
                min="100"
                step="50"
                placeholder="Budget ($)"
                required
                value={planner.budget}
                onChange={(event) => setPlanner((current) => ({ ...current, budget: event.target.value }))}
              />

              <label htmlFor="venueTypeSelect">Venue Type</label>
              <select
                id="venueTypeSelect"
                required
                value={planner.venue}
                onChange={(event) => setPlanner((current) => ({ ...current, venue: event.target.value }))}
              >
                <option value="">Choose venue type</option>
                {VENUE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <label htmlFor="plannerModeSelect">Planner Mode</label>
              <select
                id="plannerModeSelect"
                value={planner.mode}
                onChange={(event) => setPlanner((current) => ({ ...current, mode: event.target.value }))}
              >
                {PLANNER_MODES.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>

              <button id="generatePlanBtn" type="submit" disabled={isTyping}>
                {isTyping ? "Generating..." : "Generate Plan"}
              </button>
            </form>
          </aside>

          <section className="chat-panel" aria-label="Planner chat">
            <div className="chat-panel-head">
              <div className="panel-head">
                <p className="panel-kicker">AI Workspace</p>
                <h2>Planner Chat</h2>
                <p className="panel-copy">Describe your event in your own words and let the planner refine the setup step by step.</p>
              </div>
              <span className="planner-status">Planner ready</span>
            </div>

            <div id="chatHistory" className="chat-history">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`message-row ${message.role === "user" ? "user" : "assistant"}`}>
                  <span className="message-avatar" aria-hidden="true">
                    {message.role === "user" ? "U" : "AI"}
                  </span>
                  <article className="message-bubble">
                    {message.structured
                      ? renderStructuredMessage(message.structured)
                      : renderMessageContent(message.content, { normalizePlanner: message.role === "assistant" })}
                  </article>
                </div>
              ))}

              {isTyping ? (
                <div className="message-row">
                  <span className="message-avatar" aria-hidden="true">
                    AI
                  </span>
                  <article className="message-bubble" aria-label="AI is typing">
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </article>
                </div>
              ) : null}
            </div>

            <form id="chatForm" className="chat-input-row" onSubmit={handleChatSubmit}>
              <input
                id="chatInput"
                type="text"
                placeholder="Describe your event or ask a question..."
                autoComplete="off"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button id="sendBtn" type="submit" aria-label="Send message" disabled={isTyping}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 3 10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="m21 3-7 18-4-7-7-4 18-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </section>
        </section>
      </main>
    </motion.div>
  );
  
}

export default AIPlannerPage;
