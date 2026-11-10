<script setup lang="ts">
import type {Post} from '../types'
import {toggleLike} from '../stores/community'
defineProps<{post:Post}>()
</script>
<template><article class="post-card"><RouterLink :to="'/posts/'+post.id"><img v-if="post.image" class="post-image" :src="post.image" :alt="post.title" loading="lazy"/><div class="post-body"><span class="pill">{{post.category}}</span><h3>{{post.title}}</h3></div></RouterLink><div class="post-foot"><span><img :src="post.avatar" alt="" class="avatar tiny"/>{{post.author}}</span><button class="like" :class="{liked:post.liked}" @click="toggleLike(post)" :aria-label="post.liked?'取消点赞':'点赞'"><van-icon :name="post.liked?'like':'like-o'"/> {{post.likes}}</button></div></article></template>
