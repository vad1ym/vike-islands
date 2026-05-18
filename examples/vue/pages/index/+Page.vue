<script setup lang="ts">
import ProductList from '@/components/ProductList.vue'
</script>

<template>
  <div>
    <h1>Product Catalog</h1>
    <ProductList client:never server:cache="9999" />
  </div>
</template>
