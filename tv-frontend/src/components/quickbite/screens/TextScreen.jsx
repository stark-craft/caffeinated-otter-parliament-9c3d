import { PROVIDERS } from '../../../quickbite/providers.js'
/* The answer card: a conversational reply as a widget, never as markdown.   Style A from the 2026-09-24 mockup. */ export default function TextScreen({
  model,
  focusKey,
  focusableProps,
}) {
  return (
    <div className="qb-answer" role={model.error ? 'alert' : undefined}>
      {/* Remote ArrowUp from the first action now reaches the actual answer
          heading. The panel then scrolls its body back to the top. */}
      <div
        className={`qb-screen-heading ${focusKey === 'screen-heading' ? 'is-focused' : ''}`}
        role="group"
        aria-label="QuickShop response"
        {...focusableProps('screen-heading')}
      >
        <p className="qb-answer-overline">{model.overline}</p>
        <h1 className="qb-answer-title">{model.title}</h1>
        {model.bullets.length > 0 && (
          <ul className="qb-answer-bullets">
            {model.bullets.map((b, i) => <li key={`b-${i}`}>{b}</li>)}
          </ul>
        )}
      </div>
      <div className={`qb-answer-actions${model.actions.length === 3 && !model.retry && !model.reconnectProvider ? ' qb-action-row-three' : ''}`}>
        {model.reconnectProvider && (
          <button className={`qb-secondary-button qb-answer-action ${focusKey === 'reconnect-provider' ? 'is-focused' : ''}`}
            {...focusableProps('reconnect-provider')}>
            Reconnect {PROVIDERS[model.reconnectProvider]?.label || 'merchant'}
          </button>
        )}
        {model.actions.map((label, i) => (
          <button
            key={`a-${i}`}
            className={`qb-secondary-button qb-answer-action ${focusKey === `text-action-${i}` ? "is-focused" : ""}`}
            {...focusableProps(`text-action-${i}`)}
          >
            {label}
          </button>
        ))}
        {model.retry && (
          <button
            className={`qb-primary-button qb-answer-action ${focusKey === "retry" ? "is-focused" : ""}`}
            {...focusableProps("retry")}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
