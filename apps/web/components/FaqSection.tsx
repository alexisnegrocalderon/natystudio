import { ChevronDown } from "lucide-react";

export type FaqItem = { question: string; answer: string };

export function FaqSection({ items, title }: { items: FaqItem[]; title?: string }) {
  return (
    <div className="faq-list">
      {title ? <h2 className="sr-only">{title}</h2> : null}
      {items.map((item, index) => (
        <details className="faq-item" key={item.question}>
          <summary>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.question}
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <div>{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
