<script setup lang="ts">
import { ref } from 'vue'

const { username = 'Guest', role = 'user' } = defineProps<{
  username?: string
  role?: string
}>()

const open = ref(false)

function logout() {
  alert(`Logging out ${username}…`)
}
</script>

<template>
  <div class="user-menu">
    <button class="trigger" @click="open = !open">
      <span class="avatar">{{ username[0]?.toUpperCase() }}</span>
      <span class="name">{{ username }}</span>
      <span class="role-badge">{{ role }}</span>
      <span class="chevron">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" class="dropdown">
      <p class="dropdown-item">Profile</p>
      <p class="dropdown-item">Settings</p>
      <hr />
      <p class="dropdown-item danger" @click="logout">Log out</p>
    </div>
  </div>
</template>

