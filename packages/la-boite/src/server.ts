const { app } = require('./app')
const port = 3001
const host = "localhost"
app.listen(port)
console.log(`git-en-boite server listening on http://${host}:${port}`)