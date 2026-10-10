import { get } from 'lodash';
import { RESOURCE_RIGHTS } from 'kubecube/utils/constance';

// 目录是"有哪些项"的唯一来源。角色自己持有什么只决定哪些框被勾上，
// 永远不决定有哪些框——否则角色就成了它自己权限的定义者。
export function toTreeModel(catalogue, items) {
    const model = {};
    Object.keys(get(catalogue, 'items', {})).forEach(item => {
        model[item] = {
            [RESOURCE_RIGHTS.READ]: false,
            [RESOURCE_RIGHTS.WRITE]: false,
        };
    });

    Object.keys(items || {}).forEach(item => {
        if (!model[item]) return;
        const verb = items[item];
        model[item][RESOURCE_RIGHTS.READ] = verb === 'read' || verb === 'all';
        model[item][RESOURCE_RIGHTS.WRITE] = verb === 'write' || verb === 'all';
    });

    return model;
}

// 提交的是勾选结果，不是规则：规则由服务端从目录派生，客户端无从发明。
//
// disabledKeys 里的项不提交：置灰不是使用者做的选择，而是"本层级不可授予"，
// 提交上去只会让整个请求被拒绝（服务端不做部分应用）。跳过它，角色就收敛到
// 本层级允许的范围内，而不是卡在一条谁也存不下去的记录上。
export function toItems(model, disabledKeys = []) {
    const items = {};
    Object.keys(model || {}).forEach(item => {
        if (disabledKeys.includes(item)) return;
        const read = get(model[item], RESOURCE_RIGHTS.READ);
        const write = get(model[item], RESOURCE_RIGHTS.WRITE);
        if (read && write) items[item] = 'all';
        else if (read) items[item] = 'read';
        else if (write) items[item] = 'write';
    });
    return items;
}

// 当前层级不允许授予的项：界面上置灰，服务端也会拒绝。
export function ungrantableItems(catalogue, level) {
    return Object.keys(get(catalogue, 'items', {})).filter(item => {
        const levels = get(catalogue, [ 'items', item, 'levels' ], []);
        return !levels.includes(level);
    });
}
