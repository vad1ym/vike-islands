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

<style scoped>
.counter {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: #ffffff;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
}

.label {
  font-size: 13px;
  color: #71717a;
  margin: 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn {
  width: 32px;
  height: 32px;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  background: #f4f4f5;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:hover {
  background: #e4e4e7;
}

.value {
  font-size: 24px;
  font-weight: 700;
  min-width: 40px;
  text-align: center;
}
</style>
