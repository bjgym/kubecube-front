<template>
  <kube-checkbox-tree
    :data="model"
    :curr-level-text="title"
    :disabled="disabled"
    :disabled-keys="disabledKeys"
  />
</template>

<script>
import { setValue } from './utils';
export default {
    provide() {
        return {
            emitStateChange: this.emitStateChange,
        };
    },
    model: {
        event: 'change',
        prop: 'value',
    },
    props: {
        value: {
            type: Object,
            require: true,
        },
        title: String,
        disabled: Boolean,
        // 这些项在当前层级不可授予：仍然显示，但勾不动。
        disabledKeys: {
            type: Array,
            default: () => [],
        },
    },
    computed: {
        model: {
            get() {
                return this.value;
            },
            set(val) {
                this.$emit('change', val);
            },
        },
    },
    methods: {
        emitStateChange({ key, value }) {
            setValue(this.model, key, value);
        },
    },
};
</script>

<style>

</style>
