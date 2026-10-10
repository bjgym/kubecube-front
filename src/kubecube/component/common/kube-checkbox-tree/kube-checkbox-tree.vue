<template>
  <div :class="$style.root">
    <div :class="$style.line">
      <u-checkbox
        v-model="currentState"
        :disabled="branchDisabled"
      />
      <u-text>{{ currLevelText }}</u-text>
    </div>
    <div :class="$style.nextLevel">
      <template v-for="k in keys">
        <kube-checkbox-tree
          :key="k"
          :disabled="disabled"
          :disabled-keys="disabledKeys"
          :data="data[k]"
          :curr-level-text="k"
          :data-key="`${dataKey ? `${dataKey}.` : ''}${k}`"
        />
      </template>
    </div>
  </div>
</template>

<script>
import { isObject } from 'lodash';
import { traverse } from './utils';
export default {
    name: 'KubeCheckboxTree',
    inject: [ 'emitStateChange' ],
    props: {
        data: [ Object, Boolean ],
        currLevelText: String,
        dataKey: {
            type: String,
            default: '',
        },
        disabled: Boolean,
        // 以本层的名字匹配：某一项在当前层级不可授予时，它仍然显示，
        // 但勾不动——而不是从列表里消失。
        disabledKeys: {
            type: Array,
            default: () => [],
        },
    },
    computed: {
        keys() {
            return Object.keys(this.data);
        },
        branchDisabled() {
            return this.disabled || this.disabledKeys.includes(this.currLevelText);
        },
        currentState: {
            get() {
                if (isObject(this.data)) {
                    let state = true;
                    traverse(this.data, (key, value) => {
                        if (!value) {
                            state = false;
                            return false;
                        }
                        return true;
                    });
                    return state;
                }
                return this.data;
            },
            set(val) {
                this.emitStateChange({
                    key: this.dataKey,
                    value: val,
                });
            },
        },
    },
};
</script>

<style module>
.nextLevel{
    padding-left: 20px;
}
</style>
