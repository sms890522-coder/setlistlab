import { faqItems } from "@/lib/faq";

type FaqSectionProps = {
  className?: string;
};

export function FaqSection({ className }: FaqSectionProps) {
  const sectionClassName = [
    "rounded-3xl border border-slate-200 bg-white/75 p-5 shadow-sm sm:p-7",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div>
        <p className="text-sm font-black text-blue-700">FAQ</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">자주 묻는 질문</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {faqItems.map((item) => (
          <details key={item.question} className="rounded-2xl border border-slate-100 bg-white p-4">
            <summary className="cursor-pointer text-base font-black text-slate-950">{item.question}</summary>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
