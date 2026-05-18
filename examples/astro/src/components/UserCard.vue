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

<style scoped>
.user-menu {
  position: relative;
  display: inline-block;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.trigger:hover {
  background: #f4f4f5;
}

.avatar {
  width: 28px;
  height: 28px;
  background: #6366f1;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.name {
  font-weight: 500;
}

.role-badge {
  font-size: 11px;
  background: #e0e7ff;
  color: #4338ca;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chevron {
  font-size: 10px;
  color: #71717a;
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: #ffffff;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
  padding: 4px 0;
}

.dropdown-item {
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
  margin: 0;
}

.dropdown-item:hover {
  background: #f4f4f5;
}

.dropdown-item.danger {
  color: #dc2626;
}

hr {
  border: none;
  border-top: 1px solid #e4e4e7;
  margin: 4px 0;
}
</style>
