"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeExternalUrl } from "@/lib/url";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renderizador Markdown GFM seguro (sem HTML bruto e com validação de esquema em links),
 * estilizado para anotações técnicas e trechos de código no BrainRats.
 */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  return (
    <div
      className={`text-sm leading-relaxed text-ink-3 [&_p+p]:mt-2 [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-0.5 [&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:my-3 [&_hr]:border-lane-soft ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            const safe = safeExternalUrl(href);
            if (!safe) {
              return <span className="text-ink-muted">{children}</span>;
            }
            return (
              <a
                href={safe}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-link hover:underline"
              >
                {children}
              </a>
            );
          },
          code: ({ className: codeClass, children }) => {
            const isBlock = Boolean(codeClass && codeClass.startsWith("language-"));
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-xl bg-shell px-3.5 py-2.5 font-mono text-xs text-slate-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-well px-1.5 py-0.5 font-mono text-xs text-ink-strong ring-1 ring-lane-soft">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mt-2 overflow-x-auto">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
