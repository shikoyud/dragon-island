import { ElementsStrip } from '../components/ElementsStrip'
import { Faq } from '../components/Faq'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { Pillars } from '../components/Pillars'
import { WaitlistMount } from '../components/waitlist/WaitlistMount'
import { publicConfig } from '../server/publicConfig'

// Config (X handle, post id) is read per request on the server and passed down as props.
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)

export default async function Home({ searchParams }: Props) {
  const params = await searchParams
  const cfg = publicConfig()
  const ref = one(params.ref)
  return (
    <>
      <Header xHandle={cfg.xHandle} />
      <main id="top">
        <Hero />
        <Pillars />
        <ElementsStrip />
        <section id="join" className="section wrap wrap-narrow" aria-labelledby="join-title">
          <h2 id="join-title" className="section-title">
            Join the waitlist
          </h2>
          <p className="section-lead">Four quick steps. Your progress is saved, so you can come back any time.</p>
          <WaitlistMount
            xHandle={cfg.xHandle}
            postId={cfg.postId}
            siteUrl={cfg.siteUrl}
            minAccountAgeDays={cfg.minAccountAgeDays}
            xStatus={one(params.x)}
            refCode={ref && /^[A-Za-z0-9_-]{1,32}$/.test(ref) ? ref : null}
          />
        </section>
        <Faq xHandle={cfg.xHandle} />
      </main>
      <Footer xHandle={cfg.xHandle} />
    </>
  )
}
