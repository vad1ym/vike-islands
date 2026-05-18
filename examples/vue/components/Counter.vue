<script setup lang="ts">
import { ref } from 'vue'

const { initialCount = 0, label = 'Counter' } = defineProps<{
  initialCount?: number
  label?: string
}>()

const count = ref(initialCount)
</script>

<template>
  <div class="counter">
    <p class="label">{{ label }}</p>
    <div class="controls">
      <button class="btn" @click="count--">−</button>
      <span class="value">{{ count }}</span>
      <button class="btn" @click="count++">+</button>
    </div>
  </div>
</template>

