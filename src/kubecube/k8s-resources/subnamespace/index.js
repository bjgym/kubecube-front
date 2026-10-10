// The shape of the space field of the create-namespace request.
//
// The backend reads only the labels, the name and the namespace out of it and
// builds the Namespace itself, so this is a KubeCube request body that happens
// to still carry the DTO's field name, not a Kubernetes object.
//
// The apiVersion and kind that used to be here named an HNC object that neither
// side creates any more: the backend unmarshals this into its own type and
// ignores them. They are gone so the front end stops claiming to speak HNC.
export function toK8SObject({
    namespace,
    tenant,
    project,
    scope,
}) {
    return {
        metadata: {
            labels: {
                'kubecube.io/project': project,
                'kubecube.io/tenant': tenant,
            },
            name: namespace,
            namespace: scope,
        },
    };
}
