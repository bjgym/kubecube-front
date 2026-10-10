// The label vocabulary the backend records namespace ownership with.
//
// It lives here, once, so that a change to it is not spread across every page
// that filters namespaces by tenant or project. Before this, three pages built
// the HNC depth labels by hand, which meant the tree's internal spelling was
// part of the UI.
//
//   kubecube.io/owner         the authority: tenant:<name> or project:<name>
//   kubecube.io/owner-tenant  the tenant a namespace sits in
//   kubecube.io/owner-level   which level it is: tenant, project or space
//
// The derived keys exist because a selector cannot ask two questions at once:
// owner-tenant is what reaches a tenant's projects and spaces as well as the
// tenant itself, and owner-level is what keeps a project's own namespace out of
// a list of its spaces.

export const OWNER_LABEL = 'kubecube.io/owner';
export const OWNER_TENANT_LABEL = 'kubecube.io/owner-tenant';
export const OWNER_LEVEL_LABEL = 'kubecube.io/owner-level';

export const LEVEL_SPACE = 'space';

// everyNamespaceOfTenant selects everything under a tenant: the tenant's own
// namespace, its projects and their spaces.
export function everyNamespaceOfTenant(tenant) {
    return [`${OWNER_TENANT_LABEL}=${tenant}`];
}

// spacesOfProject selects a project's spaces without the project's own
// namespace, which is owned by the same project but is not a space.
export function spacesOfProject(project) {
    return [
        `${OWNER_LABEL}=project:${project}`,
        `${OWNER_LEVEL_LABEL}=${LEVEL_SPACE}`,
    ];
}
