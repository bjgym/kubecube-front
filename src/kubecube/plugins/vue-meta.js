import Vue from 'vue';
import VueMeta from 'vue-meta';
import { BRAND_NAME } from 'kubecube/utils/brand';

Vue.use(VueMeta, {
    refreshOnceOnNavigation: true,
    // The brand is appended in exactly one place. A page sets only its own name
    // (`常用工具`); an empty title falls back to the brand alone. A page title that
    // still carries a hardcoded brand is passed through unchanged so the brand is
    // never appended twice while the pages are migrated.
    titleTemplate: (titleChunk) => {
        if (!titleChunk) {
            return BRAND_NAME;
        }
        if (titleChunk.toLowerCase().endsWith(BRAND_NAME.toLowerCase())) {
            return titleChunk;
        }
        return `${titleChunk} - ${BRAND_NAME}`;
    },
});

