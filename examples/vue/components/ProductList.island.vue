<script lang="ts" setup>
import { ref, onServerPrefetch } from 'vue'
import ProductCard from './ProductCard.vue'

const products = ref<any[]>([])

async function fetchProducts() {
  const res = await fetch('https://dummyjson.com/products?limit=100&select=id,title,price,rating,stock,category,tags,description,thumbnail')
  const data = await res.json()
  products.value = data.products
}

onServerPrefetch(fetchProducts)
// onMounted(fetchProducts)
</script>

<template>
  <div class="product-grid">
    <ProductCard
      v-for="p in products"
      :key="p.id"
      :id="p.id"
      :title="p.title"
      :price="p.price"
      :rating="p.rating"
      :review-count="p.stock"
      :category="p.category"
      :tags="p.tags ?? []"
      :in-stock="p.stock > 0"
      :description="p.description"
      :image-index="p.id"
      :thumbnail="p.thumbnail"
    />
  </div>
</template>
