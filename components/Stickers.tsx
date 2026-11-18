"use client";
// Sticker-style buttons and the scrolling ribbon used in the header and home page.
import React from "react";

let n = 0;

/** Round badge with text running around the edge, e.g. "ADD A RECIPE · ADD A RECIPE ·" */
export function CircleBadge({ text, center, className = "", ...rest }: { text: string; center: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = `ring${++n}`;
  return (
    <button type="button" className={`circle-badge ${className}`} {...rest}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <path id={id} d="M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" />
        </defs>
        <circle cx="60" cy="60" r="58" className="cb-fill" />
        <text className="cb-text">
          <textPath href={`#${id}`} startOffset="0">{text}</textPath>
        </text>
      </svg>
      <span className="cb-center">{center}</span>
    </button>
  );
}

/** Soft blob-shaped button, e.g. "Favourites" */
export function BlobButton({ children, className = "", ...rest }: { children: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`blob-btn ${className}`} {...rest}>
      <svg viewBox="0 0 160 80" preserveAspectRatio="none" aria-hidden="true">
        <path className="blob-fill" d="M14,40 C10,14 44,6 80,7 C118,8 152,12 151,38 C150,66 116,74 80,73 C40,72 18,66 14,40 Z" />
      </svg>
      <span className="blob-label">{children}</span>
    </button>
  );
}

/** Coral ribbon with text scrolling across. Respects "reduce motion". */
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <div className="marquee-row" key={k}>
            {row.map((t, i) => (
              <span key={i} className={i % 2 ? "mq-soft" : "mq-bold"}>{t}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
