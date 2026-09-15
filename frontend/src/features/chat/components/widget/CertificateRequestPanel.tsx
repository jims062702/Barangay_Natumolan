import type { ChatWidgetState } from "../../hooks/useChatWidget";

/**
 * Requesting a certificate, as a panel of its own.
 */
export function CertificateRequestPanel({ ctx }: { ctx: ChatWidgetState }) {
  const { setPicking, setChosen, chosen, services, purpose, setPurpose, filing, fileRequest } = ctx;

  return (
    <div className="flex-1 overflow-y-auto bg-secondary/60 px-4 py-4">
      <button
        type="button"
        onClick={() => { setPicking(false); setChosen(null); }}
        className="mb-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
      >
        &larr; Back to the assistant
      </button>

      {!chosen ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-dark">What do you need?</p>
          <p className="mb-1 text-xs leading-relaxed text-gray-500">
            Pick one and it will tell you what to bring before you send it.
          </p>

          {services.length === 0 ? (
            <div aria-hidden="true" className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="block h-11 animate-pulse rounded-xl bg-gray" />
              ))}
            </div>
          ) : (
            services.map((service) => (
              <button
                key={service.certificate_type}
                type="button"
                onClick={() => setChosen(service)}
                className="block w-full cursor-pointer rounded-xl border border-gray bg-white px-4 py-3 text-left transition-colors hover:border-primary"
              >
                <p className="text-sm font-medium text-dark">{service.certificate_type}</p>
                {service.fee > 0 && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    Fee: P{service.fee.toFixed(2)}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-dark">{chosen.certificate_type}</p>
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="shrink-0 cursor-pointer text-xs font-semibold text-gray-400 hover:text-dark"
            >
              Change
            </button>
          </div>

          {/*
            What to bring, BEFORE they commit — not after. A resident
            who learns at the counter that they needed a valid ID has
            made the trip for nothing.
          */}
          {chosen.requirements.length > 0 && (
            <div className="rounded-xl bg-white px-4 py-3">
              <p className="text-xs font-semibold text-dark">Bring with you:</p>
              <ul className="mt-1.5 space-y-1">
                {chosen.requirements.map((need) => (
                  <li key={need} className="text-xs leading-relaxed text-gray-600">
                    • {need}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {chosen.fee > 0 && (
            <p className="text-xs text-gray-500">
              Fee: <strong className="text-dark">P{chosen.fee.toFixed(2)}</strong>
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark">
              What is it for?
            </span>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. employment, school, loan"
              maxLength={500}
              className="w-full rounded-xl border border-gray bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            type="button"
            disabled={filing || !purpose.trim()}
            onClick={() => void fileRequest()}
            className="w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {filing ? "Sending…" : "Send this request"}
          </button>
        </div>
      )}
    </div>
  );
}
