const faqs = (xHandle: string): { q: string; a: string }[] => [
  {
    q: 'What is Dragon Island?',
    a: 'An original dragon game for the web, drawn in pixel art. You breed dragons in nests, build an island of element habitats and battle 3v3, turn by turn. The game runs once, for 14 or 28 days, and then shuts down.',
  },
  {
    q: 'Which chain is it on?',
    a: 'Dragon Island is being built for Robinhood Chain. We start on the Robinhood Chain testnet.',
  },
  {
    q: 'When does it launch?',
    a: `Dates will be announced on X first. Follow @${xHandle} so you do not miss them.`,
  },
  {
    q: 'Is it free to join?',
    a: 'Yes. Joining the waitlist is free. Linking a wallet only asks you to sign a message: no gas and no transaction.',
  },
  {
    q: 'What do you store?',
    a: 'Your X handle, display name, avatar and account creation date (to check the minimum account age), your wallet address, your referral link and who invited you, and the times you opened and confirmed each task. We never post for you and we do not keep your X access token.',
  },
]

export function Faq({ xHandle }: { xHandle: string }) {
  return (
    <section id="faq" className="section wrap wrap-narrow" aria-labelledby="faq-title">
      <h2 id="faq-title" className="section-title">
        FAQ
      </h2>
      <div className="faq">
        {faqs(xHandle).map((f) => (
          <details key={f.q} className="faq-item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
