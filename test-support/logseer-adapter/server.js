import { createLogseerAdapter } from './adapter.js'

const port = Number(process.env.PORT || 19091)
const server = createLogseerAdapter()
server.listen(port, '0.0.0.0', () => console.log(`logseer test adapter on ${port}`))
