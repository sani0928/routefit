"use client";

import { MessageCircleQuestion, Send, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notify } from "@/lib/notify";

type InquirySummary = {
  placeCount: number;
  totalDistanceMeters: number;
  totalDurationMilliseconds: number;
  totalTollFare: number;
};

type Props = {
  open: boolean;
  isAuthenticated: boolean;
  summary: InquirySummary;
  onClose: () => void;
};

const EXIT_ANIMATION_MILLISECONDS = 180;

export function InquiryDialog({ open, isAuthenticated, summary, onClose }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [isRendered, setIsRendered] = useState(open);
  const [isExiting, setIsExiting] = useState(false);
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [withoutReplyEmail, setWithoutReplyEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    if (open) {
      setIsRendered(true);
      setIsExiting(false);
      return;
    }
    if (!isRendered) return;
    setIsExiting(true);
    const timer = window.setTimeout(() => setIsRendered(false), EXIT_ANIMATION_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [isRendered, open]);
  useEffect(() => {
    if (!open || !isRendered) return;
    const focusTimer = window.requestAnimationFrame(() => messageRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isRendered, isSubmitting, onClose, open]);

  function close() {
    if (!isSubmitting) onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10) return notify.error("문의 내용은 10자 이상 입력해 주세요.");
    if (!isAuthenticated && !withoutReplyEmail && !replyEmail.trim()) return notify.error("회신 이메일을 입력하거나 이메일 없이 문의하기를 선택해 주세요.");

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          replyEmail: !isAuthenticated && !withoutReplyEmail ? replyEmail.trim() || undefined : undefined,
          replyOptOut: !isAuthenticated && withoutReplyEmail,
          summary,
        }),
      });
      const body = await response.json().catch(() => null) as { received?: boolean; canReply?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !body?.received) throw new Error(body?.error?.message || "문의 접수에 실패했습니다.");

      setMessage("");
      setReplyEmail("");
      setWithoutReplyEmail(false);
      onClose();
      notify.success(body.canReply
        ? "보내주신 내용은 꼼꼼히 검토 후에 이메일로 회신 드리겠습니다! 감사합니다"
        : "문의가 정상적으로 접수되었습니다! 보내주신 내용은 꼼꼼히 검토하겠습니다. 감사합니다.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "문의 접수에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isMounted || !isRendered) return null;

  return createPortal(
    <div className={`inquiry-dialog-backdrop${isExiting ? " is-exiting" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className={`inquiry-dialog${isExiting ? " is-exiting" : ""}`} role="dialog" aria-modal="true" aria-label="문의하기" onDragStart={(event) => event.preventDefault()}>
        <button className="inquiry-dialog-close" type="button" onClick={close} aria-label="문의하기 닫기"><X size={20} aria-hidden="true" /></button>
        <span className="inquiry-dialog-eyebrow"><MessageCircleQuestion size={15} aria-hidden="true" />ROUTEFIT CONTACT</span>
        <p>문의 주실 내용 혹은 개선점이 있으시면 자유롭게 작성해 주세요.<br />확인 후에 빠르게 답변 드리겠습니다.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label className="inquiry-field">
            <span>문의 내용</span>
            <textarea ref={messageRef} value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2_000} placeholder="문의하실 내용 혹은 불편했던 점, 개선이 필요한 내용을 알려주세요." disabled={isSubmitting} required />
            <small>{message.length.toLocaleString()} / 2,000</small>
          </label>
          {isAuthenticated ? <p className="inquiry-reply-note">로그인한 계정의 이메일로 답변을 보내드릴게요.</p> : <>
            <div className="inquiry-email-slot">
              {withoutReplyEmail
                ? <p className="inquiry-no-reply-note">이메일 주소를 입력하지 않으면 답변을 받을 수 없습니다.</p>
                : <label className="inquiry-field"><span>회신 이메일</span><input type="email" value={replyEmail} onChange={(event) => setReplyEmail(event.target.value)} placeholder="답변을 받을 이메일" autoComplete="email" disabled={isSubmitting} required /></label>}
            </div>
            <label className="inquiry-opt-out"><input type="checkbox" checked={withoutReplyEmail} onChange={(event) => setWithoutReplyEmail(event.target.checked)} disabled={isSubmitting} /> <span>이메일 없이 문의하기</span></label>
          </>}
          <div className="inquiry-dialog-actions"><button type="button" onClick={close} disabled={isSubmitting}>취소</button><button type="submit" disabled={isSubmitting}><Send size={15} aria-hidden="true" />{isSubmitting ? "보내는 중" : "보내기"}</button></div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
