import { make } from 'vuex-pathify';
import userService from 'kubecube/services/user';

const state = {
    features: {},
};
const actions = {
    async loadFeature({ commit }) {
        let response = {};
        try {
            response = await userService.getFeatures();
        } catch (err) {
            // An unreachable or not-yet-written feature ConfigMap must not stop
            // the console from loading. Every flag stays false, which is the
            // safe direction: the features it gates are additive.
            console.log(err);
            commit('SET_FEATURES', {});
            return;
        }
        // The endpoint answers with the ConfigMap's data map, which is a typed
        // nil before warden has written it and therefore serialises as JSON
        // null. Object.keys(null) throws, so normalise first.
        const obj = {};
        if (response && typeof response === 'object') {
            Object.keys(response).forEach(k => {
                obj[k] = (response[k] === 'enabled' || response[k] === 'true');
            });
        }
        commit('SET_FEATURES', obj);
    },
};
const mutations = {
    ...make.mutations(state),
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
};
