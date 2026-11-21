import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import api from "../Services/api";
import { useAuth } from "../context/auth";
import { errorMessage } from "../lib/marketplace";
import { Loading, Notice } from "../components/UI";

type Person = { name: string };
type Conversation = { _id: string; customer?: Person; provider?: Person };
type Message = { _id: string; sender: string; text: string; createdAt: string };
type History = { messages: Message[]; hasMore: boolean };
const clock = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });

export default function Inbox() {
  const { user } = useAuth();
  const { id } = useParams();
  if (!user) return <main className="container section"><Link className="button" to="/login">Log in to view messages</Link></main>;
  if (user.role === "admin") return <main className="container section"><Notice>Messaging is available to customers and providers.</Notice></main>;
  return <InboxContent key={user.id} id={id} userId={user.id} />;
}

function InboxContent({ id, userId }: { id?: string; userId: string }) {
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get<Conversation[]>("/messages", { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) {
        setThreads(data);
        setError("");
      }
    }).catch(err => {
      if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load conversations."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const active = threads.find(thread => thread._id === id);
  const name = active?.provider?.name || active?.customer?.name;
  return <main className="container section">
    <div className="section-heading"><h1>Messages</h1><button className="button secondary small" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /> Refresh</button></div>
    <div className="inbox-grid">
      <aside className="panel"><h2>Conversations</h2>
        {loading ? <Loading text="Loading conversations…" /> : error ? <Notice>{error}</Notice> :
          threads.length ? <nav className="inbox-list" aria-label="Conversations">{threads.map(thread =>
            <Link key={thread._id} to={`/messages/${thread._id}`} aria-current={id === thread._id ? "page" : undefined}>
              <MessageSquare size={17} /> {thread.provider?.name || thread.customer?.name || "Marketplace member"}
            </Link>)}</nav> : <p className="subtle">No conversations yet.</p>}
      </aside>
      {id ? <Thread key={id} id={id} userId={userId} name={name} revision={revision} /> :
        <section className="panel"><h2>Select a conversation</h2><p className="subtle">You can start a conversation from a provider’s service page.</p></section>}
    </div>
  </main>;
}

function Thread({ id, userId, name, revision }: { id: string; userId: string; name?: string; revision: number }) {
  const [history, setHistory] = useState<History>();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/messages/${id}`;

  useEffect(() => {
    const controller = new AbortController();
    api.get<History>(path, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) { setHistory(data); setError(""); }
    }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load messages.")); });
    return () => controller.abort();
  }, [path, revision]);

  async function loadEarlier() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get<History>(path, { params: { before: history?.messages[0]?._id } });
      setHistory(current => ({ messages: [...data.messages, ...(current?.messages || [])], hasMore: data.hasMore }));
    } catch (err) { setError(errorMessage(err, "Unable to load earlier messages.")); }
    finally { setBusy(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<Message>(path, { text });
      setHistory(current => ({ messages: [...(current?.messages.filter(message => message._id !== data._id) || []), data], hasMore: current?.hasMore ?? false }));
      setText("");
    } catch (err) { setError(errorMessage(err, "Unable to send your message.")); }
    finally { setBusy(false); }
  }

  return <section className="panel inbox-thread">
    <h2>{name || "Conversation"}</h2>
    {error && <Notice>{error}</Notice>}
    {!history ? (!error && <Loading text="Loading messages…" />) : <>
      {history.hasMore && <button className="text-button" disabled={busy} onClick={loadEarlier}>Load earlier messages</button>}
      <div className="inbox-history" role="log" aria-live="polite">
        {history.messages.length ? history.messages.map(message => <article className={`chat-message ${message.sender === userId ? "user" : "assistant"}`} key={message._id}>
          <strong>{message.sender === userId ? "You" : name || "Marketplace member"}</strong>
          <p>{message.text}</p><time dateTime={message.createdAt}>{clock.format(new Date(message.createdAt))} SAST</time>
        </article>) : <p className="subtle">Send your first message to start the conversation.</p>}
      </div>
      <form className="inbox-compose" onSubmit={send}>
        <textarea aria-label="Message" placeholder="Write a message…" rows={2} maxLength={2000} value={text} disabled={busy} onChange={event => setText(event.target.value)} />
        <button className="button small" disabled={busy || !text.trim()}><Send size={16} /> Send</button>
      </form>
    </>}
  </section>;
}
