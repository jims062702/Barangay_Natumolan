import { useState, useEffect } from "react";
import { HINT_LINES } from "../lib/widgetCopy";
import type { WidgetShellState } from "./useWidgetShell";

/**
 * The line the launcher types out beside itself, until the widget is opened.
 */
export function useLauncherHint(ctx: WidgetShellState) {
  const {
    open,
  } = ctx;

  /*
   * The label beside the launcher.
   *
   * Shown a moment after the page settles rather than immediately: arriving
   * at the same time as the page's own reveal animation, it reads as part of
   * the furniture and is looked past.
   *
   * It has no close button. It is not a notice to be got rid of — it is the
   * button introducing itself, and it stops on its own the moment somebody
   * opens the chat, which is the only thing it is asking for.
   *
   * "Stops" means for the rest of this page view, and no longer. It used to
   * be written into sessionStorage, which on a phone is the wrong memory: a
   * mobile browser keeps a tab alive for days, so one tap switched the
   * bubble off and only a new tab brought it back.
   */
  const [hint, setHint] = useState(false);
  /* Which line is being said, how much of it is written, and whether the
     bubble is still thinking about it. */
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState("");
  const [thinking, setThinking] = useState(true);
  /*
   * Armed on arrival, and armed again every time the chat is closed.
   *
   * This used to run once, on mount, and a separate handler switched the
   * bubble off for good the moment somebody tapped it. So opening the chat
   * and closing it again left the button silent for the rest of the page
   * view, and only a reload brought it back — which is not "it stops asking
   * once you have opened it", it is a thing that broke.
   *
   * The delay is the beat before it speaks. On close it doubles as the pause
   * that stops the bubble snapping back the instant the panel disappears.
   */
  useEffect(() => {
    if (open) {
      setHint(false);

      return;
    }

    const timer = setTimeout(() => setHint(true), 1400);

    return () => clearTimeout(timer);
  }, [open]);
  /*
   * One line at a time: three dots while it "thinks", then the sentence
   * typed out, then a pause to read it, then the next one.
   *
   * Typed rather than swapped because a bubble that simply changes its words
   * every few seconds looks like a broken banner. Typing is what a chat does,
   * and it is the thing that says "something is answering" without a word.
   *
   * Somebody who has asked their system for less motion gets the sentences
   * and none of the typing.
   */
  useEffect(() => {
    if (!hint || open) return;

    const sentence = HINT_LINES[line];
    const timers: number[] = [];
    const next = () =>
      timers.push(window.setTimeout(() => setLine((n) => (n + 1) % HINT_LINES.length), 3000));

    setThinking(true);
    setTyped("");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setThinking(false);
      setTyped(sentence);
      next();
    } else {
      timers.push(
        window.setTimeout(() => {
          setThinking(false);

          let written = 0;
          const typer = window.setInterval(() => {
            written += 1;
            setTyped(sentence.slice(0, written));

            if (written >= sentence.length) {
              window.clearInterval(typer);
              next();
            }
          }, 28);

          timers.push(typer);
        }, 900)
      );
    }

    /* Timeouts and intervals share one id space in the browser, so clearing
       both is safe and saves keeping two lists. */
    return () => {
      timers.forEach((id) => {
        window.clearTimeout(id);
        window.clearInterval(id);
      });
    };
  }, [hint, open, line]);

  return {
    hint, setHint, line, setLine, typed, setTyped, thinking, setThinking,
  };
}

export type LauncherHintState = ReturnType<typeof useLauncherHint>;
