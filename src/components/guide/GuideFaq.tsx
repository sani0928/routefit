import type { GuideFaqItem, GuideFaqMessage } from "./guide-content";

type GuideFaqProps = {
  messages: GuideFaqMessage[];
  leavingIds: string[];
  isTyping: boolean;
  items: readonly GuideFaqItem[];
  onSelect: (item: GuideFaqItem) => void;
};

export function GuideFaq({ messages, leavingIds, isTyping, items, onSelect }: GuideFaqProps) {
  return <section className="guide-step guide-step-faq" id="guide-faq" aria-labelledby="guide-faq-title">
    <div className="guide-faq">
      <div className="guide-faq-heading">
        <span className="guide-kicker">자주 묻는 질문</span>
        <h2 id="guide-faq-title">궁금한 점을 물어보세요.</h2>
        <p>이동 동선부터 회원 혜택까지, 자주 묻는 질문을 모아뒀어요.</p>
      </div>
      <div className="guide-faq-messenger">
        <div className="guide-faq-chat" aria-live="polite" aria-label="자주 묻는 질문 답변" tabIndex={0}>
          {messages.map((message) => <p key={message.id} className={`guide-faq-message is-${message.role}${leavingIds.includes(message.id) ? " is-leaving" : ""}`}><span>{message.content}{message.email && <> <a href={`mailto:${message.email}`} className="guide-faq-email">{message.email}</a>{message.afterEmail}</>}</span></p>)}
          {isTyping && <p className="guide-faq-typing"><span /><span /><span /></p>}
        </div>
        <div className="guide-faq-questions">{items.map((item) => <button type="button" key={item.id} onClick={() => onSelect(item)}>{item.question}</button>)}</div>
      </div>
    </div>
    <div className="guide-final-cta"><div><h2>이제 시작해 볼까요?</h2><p>RouteFit은 PC와 모바일 모두 편하게 사용할 수 있어요.</p></div><a href="/">RouteFit 시작하기</a></div>
  </section>;
}

