"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/src/lib/utils";

/** Strip markdown code fence if the LLM wrapped the proposal in ```markdown ... ``` or ``` ... ``` */
function unwrapMarkdownCodeBlock(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(
    /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```\s*$/m,
  );
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

const markdownComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold text-slate-900" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="mt-3 mb-1.5 text-base font-semibold text-slate-900"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold text-slate-800" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-2 text-sm text-slate-800 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  a: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-800"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="my-2 list-disc pl-6 space-y-0.5 text-sm text-slate-800"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="my-2 list-decimal pl-6 space-y-0.5 text-sm text-slate-800"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-slate-900" {...props}>
      {children}
    </strong>
  ),
  blockquote: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-2 border-slate-300 pl-3 my-2 text-slate-700 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="my-2 p-3 rounded bg-slate-100 text-sm overflow-x-auto"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement>) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("font-mono text-slate-800", className)} {...props}>
        {children}
      </code>
    );
  },
};

export function ProposalMarkdown({
  content,
  className,
  compact,
}: {
  content: string;
  className?: string;
  /** When true, use smaller base font so more fits in the dialog. */
  compact?: boolean;
}) {
  const sizeClass = compact ? "text-xs" : "text-sm";
  const components = compact
    ? {
        ...markdownComponents,
        p: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLParagraphElement>) => (
          <p
            className={cn("my-1.5 text-slate-800 leading-relaxed", sizeClass)}
            {...props}
          >
            {children}
          </p>
        ),
        ul: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLUListElement>) => (
          <ul
            className={cn(
              "my-1.5 list-disc pl-5 space-y-0.5 text-slate-800",
              sizeClass,
            )}
            {...props}
          >
            {children}
          </ul>
        ),
        ol: ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLOListElement>) => (
          <ol
            className={cn(
              "my-1.5 list-decimal pl-5 space-y-0.5 text-slate-800",
              sizeClass,
            )}
            {...props}
          >
            {children}
          </ol>
        ),
      }
    : markdownComponents;

  const markdownSource = unwrapMarkdownCodeBlock(content);

  return (
    <article
      className={cn(
        "proposal-markdown text-slate-800 max-w-none [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdownSource}
      </ReactMarkdown>
    </article>
  );
}
