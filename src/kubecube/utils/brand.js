/**
 * Single source of truth for the product brand name.
 *
 * Do not hardcode a brand string in a page: import BRAND_NAME from here.
 *
 * Override it at build time instead of editing this file, e.g.
 *   KUBECUBE_BRAND_NAME="My Cloud" npm run build
 *
 * KUBECUBE_BRAND_NAME is inlined by DefinePlugin (see plugins/enhance-webpack.js),
 * so it must always be read as the literal `process.env.KUBECUBE_BRAND_NAME`
 * expression for the replacement to apply.
 */
const BRAND_NAME = process.env.KUBECUBE_BRAND_NAME || 'Kubecube';

export default BRAND_NAME;
export { BRAND_NAME };
