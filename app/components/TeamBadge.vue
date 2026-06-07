<script setup lang="ts">
import { getTeam } from '~/utils/teams'

const props = withDefaults(
  defineProps<{
    name?: string | null
    align?: 'left' | 'right'
    compact?: boolean // show 3-letter abbr instead of full name (mobile / tight spaces)
  }>(),
  { align: 'left', compact: false },
)

const team = computed(() => getTeam(props.name))
const label = computed(() => (props.compact ? team.value.abbr : props.name || 'Por definir'))
const known = computed(() => !!props.name)
</script>

<template>
  <div class="team" :class="[align, { tbd: !known }]" :style="{ '--c1': team.c1, '--c2': team.c2 }">
    <span class="flag">{{ team.flag }}</span>
    <span class="name">{{ label }}</span>
    <span class="bar" aria-hidden="true" />
  </div>
</template>

<style scoped>
.team {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 2px 0;
}
.team.right {
  flex-direction: row-reverse;
  text-align: right;
}
.flag {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}
.name {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tbd .name {
  color: var(--mut);
  font-style: italic;
  font-weight: 600;
}
/* Kit-color accent bar under the team. */
.bar {
  position: absolute;
  bottom: -3px;
  left: 30px;
  right: 0;
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--c1), var(--c2));
  opacity: 0.9;
}
.team.right .bar {
  left: 0;
  right: 30px;
  background: linear-gradient(90deg, var(--c2), var(--c1));
}
@media (max-width: 560px) {
  .flag { font-size: 19px; }
  .name { font-size: 14px; }
}
</style>
