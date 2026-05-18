<script setup lang="ts">
import { ref } from 'vue'

const { id, title, price, rating, reviewCount, category, tags, inStock, description, imageIndex } = defineProps<{
  id: number
  title: string
  price: number
  rating: number
  reviewCount: number
  category: string
  tags: string[]
  inStock: boolean
  description: string
  imageIndex: number
}>()

const liked = ref(false)
const added = ref(false)
const quantity = ref(1)

function addToCart() {
  added.value = true
  setTimeout(() => added.value = false, 1500)
}
</script>

<template>
  <div class="product-card" :class="{ 'out-of-stock': !inStock }">
    <div class="product-image" :style="`background: hsl(${imageIndex * 37 % 360}, 60%, 85%)`">
      <span class="product-id">#{{ id }}</span>
      <button class="like-btn" :class="{ liked }" @click="liked = !liked">
        {{ liked ? '♥' : '♡' }}
      </button>
    </div>

    <div class="product-body">
      <div class="product-meta">
        <span class="category">{{ category }}</span>
        <span class="stock-badge" :class="inStock ? 'in-stock' : 'no-stock'">
          {{ inStock ? 'In Stock' : 'Out of Stock' }}
        </span>
      </div>

      <h3 class="product-title">{{ title }}</h3>
      <p class="product-desc">{{ description }}</p>

      <div class="product-tags">
        <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
      </div>

      <div class="product-rating">
        <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(rating) }">★</span>
        <span class="rating-value">{{ rating.toFixed(1) }}</span>
        <span class="review-count">({{ reviewCount }} reviews)</span>
      </div>

      <div class="product-footer">
        <div class="price-block">
          <span class="price">${{ price.toFixed(2) }}</span>
          <span class="price-per">per unit</span>
        </div>
        <div class="cart-controls">
          <div class="qty-control">
            <button @click="quantity = Math.max(1, quantity - 1)">−</button>
            <span>{{ quantity }}</span>
            <button @click="quantity++">+</button>
          </div>
          <button class="add-btn" :class="{ added }" :disabled="!inStock" @click="addToCart">
            {{ added ? '✓ Added' : 'Add to Cart' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
