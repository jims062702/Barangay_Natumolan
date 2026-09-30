import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiEyeOff, FiPrinter } from "react-icons/fi";

export interface FormPreviewHandle {
  print: () => void;
}

/**
 * A printed report — shown exactly as it will print, and printed from here.
 *
 * THE SHEET IS NOT ON THE PAGE UNTIL SOMEBODY ASKS FOR IT. A report screen
 * carries two or three of these, and drawn out in full they were most of the
 * page: the office had to scroll past a legal sheet it was not printing to
 * reach the month it wanted. Press Print and the sheet appears AND goes to
 * the printer in the one press — it stays afterwards, so what came out can
 * be checked against what is on screen, and Hide puts it away again.
 *
 * The frame holds the one document; Print prints the frame, so what the
 * office checked on screen is what comes out of the printer. No pop-up
 * window, which a browser may block without saying so.
 *
 * `preview={false}` — PRINT ONLY. The sheet is never drawn on the page: the
 * frame is laid out off-screen and goes straight to the printer, and the
 * print dialog's own preview is where it is seen. For the VAW desk, whose
 * forms are not to sit open on a screen.
 */
const FormPreview = forwardRef<FormPreviewHandle, {
  html: string;
  title: string;
  /** Said on the button, when "Print" alone would be vague. */
  printLabel?: string;
  disabled?: boolean;
  /**
   * What the report is narrowed by — a month, a status — beside the button.
   *
   * On the same line because they are one thing the office does: choose
   * what goes on the sheet, then print it. Stacked in their own row above,
   * the card had two right-aligned controls and no obvious order.
   */
  toolbar?: ReactNode;
  /** False: print only, never shown on the page. */
  preview?: boolean;
  /**
   * The print dialog has closed — printed or cancelled, the browser does not
   * say which. For a page that must ASK whether the paper came out before
   * it records anything (the summons, 2026-09-29).
   */
  onPrinted?: () => void;
}>(function FormPreview({ html, title, printLabel = "Print", disabled = false, toolbar, preview = true, onPrinted }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const printed = useRef(onPrinted);
  printed.current = onPrinted;
  const [shown, setShown] = useState(false);

  /*
   * Set only by Print, and cleared the moment it is honoured.
   *
   * The frame reloads whenever the report changes — another month, another
   * status — and that reload must not send paper to the printer. Only a
   * press asks for the printer.
   */
  const asked = useRef(false);

  /*
   * Whether the frame holds THIS report, laid out.
   *
   * Cleared whenever the report changes, set when the frame has loaded it.
   * A press while it is still loading waits for the load rather than
   * printing the half-drawn (or blank) sheet — and a second quick press
   * does not send a second copy.
   */
  const loaded = useRef(false);
  useLayoutEffect(() => {
    loaded.current = false;
  }, [html, shown]);

  const printFrame = () => {
    const win = frame.current?.contentWindow;
    if (!win) return false;
    win.focus();
    /* Returns once the dialog is closed. */
    win.print();
    printed.current?.();
    return true;
  };

  const print = () => {
    if (disabled) return;
    /* Already there and drawn: straight to the printer. */
    if (shown && loaded.current && printFrame()) return;
    asked.current = true;
    setShown(true);
  };

  useImperativeHandle(ref, () => ({ print }));

  const sheet = shown && (
    <iframe
      ref={frame}
      title={title}
      srcDoc={html}
      onLoad={() => {
        loaded.current = true;
        if (!asked.current) return;
        asked.current = false;
        /*
         * A breath, not a race. The document sizes itself on its own
         * load handler, and printing in the same tick asked some
         * browsers to print a sheet they had not finished laying out.
         */
        setTimeout(printFrame, 120);
      }}
      /* Print only: laid out off-screen, at a sheet's width, and out of
         the tab order — present for the printer, not for the eye. */
      aria-hidden={preview ? undefined : true}
      tabIndex={preview ? undefined : -1}
      className={preview
        ? "block min-h-40 w-full rounded-xl border border-gray bg-secondary"
        : "pointer-events-none fixed top-0 -left-[10000px] h-[800px] w-[1400px] border-0"}
    />
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {toolbar && <div className="mr-auto">{toolbar}</div>}
        {shown && preview && (
          <button
            type="button"
            onClick={() => setShown(false)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-primary hover:text-primary"
          >
            <FiEyeOff className="h-4 w-4" aria-hidden="true" /> Hide
          </button>
        )}
        <button
          type="button"
          onClick={print}
          disabled={disabled}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPrinter className="h-4 w-4" aria-hidden="true" /> {printLabel}
        </button>
      </div>

      {/* Print only: straight under <body>, so no animated card around it
          can turn "fixed" into "inside the card" and grow the page. */}
      {sheet && (preview ? sheet : createPortal(sheet, document.body))}
    </div>
  );
});

export default FormPreview;
