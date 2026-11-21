import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Bot, LoaderCircle, MessageCircle, Send, Trash2, X } from "lucide-react";
import api from "../Services/api";
import { useAuth } from "../context/auth";
import { errorMessage } from "../lib/marketplace";

type Turn = { role: "user" | "assistant"; text: string };
type Listing = { _id: string; title: string; location?: string; provider?: { name?: string }; price?: number; demo?: boolean };
type Message = Turn & { services?: Listing[] };
type Reply = {
  mode: "ai" | "directory" | "booking-status" | "navigation";
  reply: string;
  services?: Listing[];
  bookings?: { service?: { title: string }; status: string; bookingDate: string }[];
};
const prompts = ["I need a plumber", "What does pending confirmation mean?", "How does DEMO checkout work?"];
const price = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export default function Assistant() {
  const { user } = useAuth();
  return <Chat key={user?.id ?? "guest"} signedIn={!!user} />;
}

function Chat({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const history = useRef<Turn[]>([]);
  const pending = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages, busy, open, error]);

  useEffect(() => {
    if (open && window.matchMedia("(pointer: fine)").matches) composer.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  async function send(question: string, bookings = false) {
    const text = question.trim();
    if (!text || pending.current) return;
    pending.current = true;
    setInput("");
    setBusy(true);
    setError("");
    setMessages(items => error && items.at(-1)?.text === text && items.at(-1)?.role === "user"
      ? items : [...items, { role: "user", text }]);
    try {
      const { data } = bookings ? await api.get<Reply>("/marketplace/assistant/bookings")
        : await api.post<Reply>("/marketplace/assistant", { message: text, history: history.current });
      const summaries = data.bookings?.map(item =>
        `${item.service?.title || "Service"} · ${item.status} · ${new Date(item.bookingDate).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}`) || [];
      setMessages(items => [...items, {
        role: "assistant", text: [data.reply, ...summaries].join("\n"),
        services: data.services,
      }]);
      if (data.mode === "ai" || data.mode === "directory") {
        history.current = [...history.current.slice(-2), { role: "user", text }, { role: "assistant", text: data.reply }];
      }
    } catch (err) {
      setError(errorMessage(err, "Unable to respond. Please try again."));
      if (!bookings) setInput(text);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function clear() {
    history.current = [];
    setMessages([]);
    setError("");
    setInput("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  return <>
    <button ref={launcher} className="assistant-launch button" onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-controls={open ? "localtrust-assistant" : undefined}><MessageCircle size={20} /><span>Ask LocalTrust</span></button>
    {open && <section className="assistant-panel" id="localtrust-assistant" aria-label="LocalTrust Assistant" onKeyDown={event => { if (event.key === "Escape") close(); }}>
      <header><span className="assistant-mark"><Bot size={23} /></span><div><strong>LocalTrust Assistant</strong><p>Service search and booking help</p></div>
        <button className="icon-button" aria-label="Clear conversation" title="Clear conversation" disabled={busy || !messages.length} onClick={clear}><Trash2 size={17} /></button>
        <button className="icon-button" aria-label="Close assistant" onClick={close}><X size={21} /></button>
      </header>
      <div className="chat-messages" ref={list} aria-live="polite" role="log">
        {messages.length === 0 && <div className="chat-welcome"><h3>Hi, I’m the LocalTrust assistant</h3><p>Tell me what needs doing and where, or ask about bookings and demo payments.</p>
          <div className="chat-suggestions">{prompts.map(prompt => <button className="filter" key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
        </div>}
        {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}><p>{message.text}</p>{message.services?.map(service =>
          <Link className="chat-service" key={service._id} to={`/services/${service._id}`} onClick={close}>
            <strong>{service.title} <ArrowUpRight size={14} /></strong>
            <span>{[service.provider?.name, service.location, typeof service.price === "number" ? price.format(service.price) : "", service.demo ? "Demo listing" : ""].filter(Boolean).join(" · ")}</span>
          </Link>)}</div>)}
        {busy && <p className="chat-loading" role="status"><LoaderCircle size={17} className="spin" /> Assistant is typing…</p>}
      </div>
      {error && <div className="chat-error"><p role="alert">{error}</p><nav aria-label="Assistant alternatives">
        <Link to="/#services" onClick={close}>Browse services</Link>
        <Link to={signedIn ? "/dashboard" : "/login"} onClick={close}>{signedIn ? "My dashboard" : "Sign in"}</Link>
      </nav></div>}
      {signedIn && <button className="text-button" disabled={busy} onClick={() => void send("Check my bookings", true)}>Check my bookings</button>}
      <small>Keep payment details and passwords out of chat.</small>
      <form onSubmit={submit}><input ref={composer} aria-label="Message LocalTrust Assistant" maxLength={2000} value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about a service…" /><button className="button small" aria-label="Send message" disabled={busy || !input.trim()}><Send size={18} /></button></form>
    </section>}
  </>;
}
