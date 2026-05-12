let queue = []
let running = false

export function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject })
    tick()
  })
}

export function getQueueLength() {
  return queue.length
}

async function tick() {
  if (running || queue.length === 0) return
  running = true
  const { task, resolve, reject } = queue.shift()
  try {
    resolve(await task())
  } catch (e) {
    reject(e)
  } finally {
    running = false
    tick()
  }
}
