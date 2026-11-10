import {createApp} from 'vue'
import Vant,{showToast} from 'vant'
import 'vant/lib/index.css'
import './style.css'
import App from './App.vue'
import {router} from './router'
window.addEventListener('pawsup-storage-error',()=>showToast('本地空间不足，请删除部分图片或帖子'))
createApp(App).use(router).use(Vant).mount('#app')
