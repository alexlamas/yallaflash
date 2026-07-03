import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// remark-breaks keeps the tutor's single newlines as line breaks -- chat
// replies are written line-by-line, not as reflowable paragraphs.
export function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="text-sm text-heading space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
          ol: (props) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          code: (props) => (
            <code className="bg-gray-100 rounded px-1 py-0.5 text-[0.85em]" {...props} />
          ),
          a: (props) => <a className="underline" target="_blank" rel="noreferrer" {...props} />,
          h1: (props) => <p className="font-semibold" {...props} />,
          h2: (props) => <p className="font-semibold" {...props} />,
          h3: (props) => <p className="font-semibold" {...props} />,
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1" {...props} />
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
