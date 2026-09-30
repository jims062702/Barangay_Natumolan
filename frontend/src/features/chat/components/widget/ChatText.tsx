import { chatLines } from "../../lib/chatText";

/**
 * The words of one chat bubble, laid out as they were meant to be read.
 *
 * A bullet is its own line with a HANGING INDENT: when "First-Time Jobseeker
 * Certification — FREE (RA 11261)" wraps inside a narrow bubble, the second
 * line starts under the words, not under the bullet — which is what makes a
 * list read as a list rather than as a paragraph with dots in it.
 *
 * Long unbroken text (a pasted link, "aaaaaaaa…") wraps anywhere rather than
 * pushing the bubble out past the edge of the panel.
 */
export function ChatText({ text }: { text: string }) {
  const lines = chatLines(text);

  return (
    <div className="space-y-0.5 [overflow-wrap:anywhere]">
      {lines.map((line, index) =>
        line.bullet ? (
          <div key={index} className="flex gap-2">
            <span aria-hidden="true" className="select-none leading-relaxed">
              •
            </span>
            <span className="min-w-0 flex-1 leading-relaxed">{line.text}</span>
          </div>
        ) : line.text === "" ? (
          /* A blank line is the gap between two paragraphs. */
          <div key={index} aria-hidden="true" className="h-2" />
        ) : (
          <p key={index} className="leading-relaxed">
            {line.text}
          </p>
        ),
      )}
    </div>
  );
}
