FROM node:24-alpine

WORKDIR /app
COPY adapter.js server.js ./

ENV PORT=19091 \
    ES_URL=http://127.0.0.1:9200 \
    LOG_INDEX=app-logs \
    CONFIG_INDEX=logconfigs

USER node
EXPOSE 19091
CMD ["node", "server.js"]
