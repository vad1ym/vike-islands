<script setup lang="ts">
// No imports needed for this minimal layout
</script>

<template>
  <div class="layout">
    <header class="header">
      <a class="brand" href="/">vike-islands demo</a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/ssr-only">SSR-only page</a>
      </nav>
    </header>

    <main class="content">
      <slot />
    </main>

    <footer class="footer">
      <small>vike-islands MVP — islands architecture for Vike + Vue</small>
    </footer>
  </div>
</template>

