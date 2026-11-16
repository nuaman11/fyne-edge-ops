"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addTicketComment, getTicketThread } from "@/app/actions/tickets";
import { fmtDate, fmtWhen, initials } from "@/lib/format";
import type { TicketThread as Thread, UserLite } from "@/lib/types";

/** Comments and activity log shown beside the ticket form. */
export function TicketThread({ ticketId, users, onCommented }: { ticketId: string; users: UserLite[]; onCommented?: () => void }) {
  const [data, setData] = useState<Thread | null>(null);
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "Former user" : "Someone");

  const load = useCallback(async () => {
    try { setData(await getTicketThread(ticketId)); } catch { setError("Couldn’t load comments. Close and reopen the ticket."); }
  }, [ticketId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "comments" && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [data, tab]);

  function post() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await addTicketComment(ticketId, body);
      if (!r.ok) { setError(r.error); return; }
      setText("");
      setTab("comments");
      await load();
      onCommented?.();
    });
  }

  return (
    <div className="thread">
      <div className="by">
        {data ? <>Opened{data.createdById ? <> by <b>{nameOf(data.createdById)}</b></> : null} on {fmtDate(data.createdAt.slice(0, 10), true)}</> : "Loading…"}
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "comments"} className={tab === "comments" ? "on" : ""} onClick={() => setTab("comments")}>
          Comments<span className="n">{data?.comments.length ?? 0}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>
          Activity<span className="n">{data?.events.length ?? 0}</span>
        </button>
      </div>
      <div className="tlist" ref={listRef}>
        {tab === "comments" ? (
          data?.comments.length ? data.comments.map((c) => (
            <div className="cm" key={c.id}>
              <span className="av lg">{initials(nameOf(c.authorId))}</span>
              <div className="b">
                <div className="h"><b>{nameOf(c.authorId)}</b>{fmtWhen(c.createdAt)}</div>
                <div className="x">{c.body}</div>
              </div>
            </div>
          )) : <div className="empty">No comments yet. Use comments for questions and progress updates so the whole team sees them.</div>
        ) : (
          data?.events.length ? data.events.slice().reverse().map((e) => (
            <div className="logline" key={e.id}>
              <span className="dot" />
              <span><b>{nameOf(e.actorId)}</b> {e.detail}</span>
              <span className="w">{fmtWhen(e.createdAt)}</span>
            </div>
          )) : <div className="empty">Changes to status, assignee, priority and due date are recorded here from now on.</div>
        )}
      </div>
      {tab === "comments" ? (
        <div className="compose">
          <label className="fine" htmlFor="cm-text">Add a comment</label>
          <textarea id="cm-text" data-draft value={text} onChange={(e) => setText(e.target.value)} placeholder="Share an update, ask a question…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } }} />
          {error ? <div className="err" role="alert">{error}</div> : null}
          <div className="r">
            <span className="fine">Comments post right away</span>
            <button type="button" className="btn sm primary" disabled={pending || !text.trim()} onClick={post}>{pending ? "Posting…" : "Post comment"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
