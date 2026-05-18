<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })

const { islandName, islandId, dataHydrate, dataUpdate, islandComponent } = defineProps<{
  islandName: string
  islandId: string
  dataHydrate: string
  dataUpdate: string
  islandComponent?: Component
}>()

const attrs = useAttrs()
const propsJson = computed(() => JSON.stringify(attrs))
</script>

<template>
  <div
    :data-island="islandName"
    :data-island-id="islandId"
    :data-hydrate="dataHydrate"
    :data-update="dataUpdate"
    :data-island-props="propsJson"
  >
    <component :is="islandComponent" v-bind="attrs" />
  </div>
</template>
