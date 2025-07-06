"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "@/constants/faqs";

function FAQItem({
  question,
  answer,
  open,
  onClick,
}: {
  question: string;
  answer: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left focus:outline-none"
        onClick={onClick}
        aria-expanded={open}
      >
        <span className="font-semibold text-analenn-primary text-base md:text-lg">
          {question}
        </span>
        <ChevronDown
          className={`w-6 h-6 text-analenn-primary transform transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`px-4 pb-4 text-gray-700 text-sm transition-all duration-300 ease-in-out ${open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
        style={{
          transitionProperty: "max-height, opacity",
        }}
      >
        {open && <div>{answer}</div>}
      </div>
    </div>
  );
}

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="w-screen bg-[#f8f8f8] py-16 px-6 relative left-1/2 right-1/2 -mx-[50vw] ml-[-50vw]">
      <section>
        <h2 className="text-3xl font-bold text-analenn-primary text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-4xl mx-auto flex flex-col space-y-4">
          {faqs.map((faq, idx) => (
            <FAQItem
              key={idx}
              question={faq.question}
              answer={faq.answer}
              open={openIndex === idx}
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default FAQ;
