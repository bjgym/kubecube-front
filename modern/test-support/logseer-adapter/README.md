# Logseer test adapter

This directory is **test infrastructure, not a production Logseer implementation**.

KubeCube's console talks to a Logseer service for log search, live streaming and
LogConfig management. The image the platform used to install (`hub.c.163.com/qingzhou/logseer`)
is not publicly reachable and no public source repository was found. The Live E2E suite
therefore needs a small Logseer-compatible surface backed by a real Elasticsearch.

The adapter implements only what the console and the Live suite use:

| Endpoint                                                                                                    | Purpose                                 |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `GET /api/v1/logseer/extends/elasticsearch/availableFields`                                                 | field list for the search sidebar       |
| `POST /api/v1/logseer/extends/elasticsearch/_search`                                                        | query, filters, sort and date histogram |
| `POST /api/v1/logseer/extends/elasticsearch/suggestions`                                                    | field suggestions                       |
| `GET /api/v1/logseer/extends/labelSelectorKey`                                                              | label keys for LogConfig                |
| `POST /api/v1/logseer/extends/elasticsearch/_seed`                                                          | write test documents into Elasticsearch |
| `GET/POST/PUT/DELETE /api/v2/logseer/extends/clusters/{cluster}/namespaces/{namespace}/logconfigs[/{name}]` | LogConfig CRUD                          |
| `GET /api/v2/logseer/extends/logconfigs?cluster=&namespace=`                                                | LogConfig list                          |

It does **not** implement Logseer's task scheduler, log agent, authentication or the
`/stream` endpoint. Do not deploy it as a platform component and do not point a
production console at it.

## Run locally

```shell
docker run --rm --network host \
  -e ES_URL=http://127.0.0.1:9200 \
  -e LOG_INDEX=app-logs \
  -e CONFIG_INDEX=logconfigs \
  -p 19091:19091 \
  $(docker build -q modern/test-support/logseer-adapter)
```

Or directly with Node.js 22+:

```shell
node modern/test-support/logseer-adapter/server.js
```

Elasticsearch 7.x must be running and reachable at `ES_URL`. The adapter uses the
indices named by `LOG_INDEX` and `CONFIG_INDEX`; the Live suite seeds its own documents
through `_seed`.

## Verify the adapter contract

`modern/tests/logseer-adapter.test.mjs` starts the adapter against a stubbed
Elasticsearch and checks the routes, the query translation and LogConfig CRUD. It runs
as part of `npm test`; it needs no running Elasticsearch.
