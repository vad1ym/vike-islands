<script setup lang="ts">
import Counter from '@/components/Counter.island.vue'
</script>

<template>
  <div>
    <h1>SSR-only page with islands</h1>

    <p>
      This page has <strong>no full-page client-side hydration</strong>.
      Only the explicitly-marked islands are hydrated on the client.
      Everything else is static HTML.
    </p>

    <section class="demo-section">
      <h2>Interactive counter island</h2>
      <p>
        Although this page ships no Vue app for the page shell,
        this counter component is independently hydrated when it becomes visible.
      </p>
      <Counter v-island :initial-count="0" label="SSR-only page island" />
    </section>

    <section class="demo-section static">
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
</template>
