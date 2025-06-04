const { spawn } = require('child_process')

async function startViteOnly() {
  return new Promise((resolve, reject) => {
    const viteProcess = spawn('yarn', ['run', 'vite', 'dev', '--port', '3000'], { shell: false })
    console.log('[VITE] Spawned process with PID:', viteProcess.pid)

    viteProcess.stdout.on('data', (data) => {
      const text = data.toString()
      console.log('[VITE STDOUT]', text)
      if (text.includes('Local:   http://localhost:3000/')) {
        console.log('[VITE] Server ready at localhost:3000')
        resolve()
      }
    })

    viteProcess.stderr.on('data', (data) => {
      console.error('[VITE STDERR]', data.toString())
    })

    viteProcess.on('error', (err) => {
      console.error('[VITE ERROR]', err)
      reject(err)
    })

    setTimeout(() => {
      if (!viteProcess.killed) {
        viteProcess.kill('SIGTERM')
        reject(new Error('Vite startup timeout'))
      }
    }, 30000)
  })
}

;(async () => {
  console.log('Starting Vite...')
  try {
    await startViteOnly()
    console.log('Vite started successfully')
  } catch (err) {
    console.error('Vite failed:', err)
  }
})()
