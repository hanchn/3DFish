<template>
  <div id="app">
    <!-- Navigation Menu -->
    <nav class="game-nav" v-if="$route.name !== 'home' || showNav">
      <router-link to="/" class="nav-btn" :class="{ active: $route.name === 'home' }">🐟 3DFish</router-link>
      <router-link to="/rabbit" class="nav-btn" :class="{ active: $route.name === 'rabbit' }">🐰 拔萝卜</router-link>
      <button @click="showNav = !showNav" class="toggle-nav-btn">{{ showNav ? '隐藏菜单' : '显示菜单' }}</button>
    </nav>
    <div v-else class="hidden-nav-trigger" @mouseenter="showNav = true">
      <!-- Hover here to show nav -->
    </div>
    
    <router-view></router-view>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const showNav = ref(false)
</script>

<style>
.game-nav {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  gap: 15px;
  background: rgba(0, 0, 0, 0.5);
  padding: 10px 20px;
  border-radius: 30px;
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
}

.nav-btn {
  color: white;
  text-decoration: none;
  font-size: 18px;
  font-weight: bold;
  padding: 8px 16px;
  border-radius: 20px;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.nav-btn.active {
  background: #4CAF50;
  color: white;
}

.toggle-nav-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  border-radius: 20px;
  padding: 0 10px;
  cursor: pointer;
  font-size: 12px;
}

.hidden-nav-trigger {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 40px;
  z-index: 999;
}
</style>
