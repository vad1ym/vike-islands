import { Island } from 'vike-islands/react'
import Counter from '@/components/Counter.island'

export default function Page() {
  return (
    <div>
      <h1>SSR-only page with islands</h1>

      <p>
        This page has <strong>no full-page client-side hydration</strong>.
        Only the explicitly-marked islands are hydrated on the client.
        Everything else is static HTML.
      </p>

      <section className="demo-section">
        <h2>Interactive counter island</h2>
        <p>
          Although this page ships no React app for the page shell,
          this counter component is independently hydrated when it becomes visible.
        </p>
        <Island
          name="Counter"
          component={Counter}
          hydrate="visible"
          initialCount={0}
          label="SSR-only page island"
        />
      </section>

      <section className="demo-section static">
        <h2>Static content (not an island)</h2>
        <p>
          This section is plain HTML from the server. No JavaScript will be
          executed for it.
        </p>
        <ul>
          <li>Item one</li>
          <li>Item two</li>
          <li>Item three</li>
        </ul>
      </section>
    </div>
  )
}
