import { createRouter, createWebHistory } from 'vue-router'
import FishView from '../views/FishView.vue'
import RabbitView from '../views/RabbitView.vue'
import CowView from '../views/CowView.vue'
import PigView from '../views/PigView.vue'
import CatFishingView from '../views/CatFishingView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: FishView
    },
    {
      path: '/rabbit',
      name: 'rabbit',
      component: RabbitView
    },
    {
      path: '/cow',
      name: 'cow',
      component: CowView
    },
    {
      path: '/pig',
      name: 'pig',
      component: PigView
    },
    {
      path: '/fishing',
      name: 'fishing',
      component: CatFishingView
    }
  ]
})

export default router
