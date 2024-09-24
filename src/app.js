import { useEffect } from 'react'

const loadWasm = async () => {
  try {
    console.log('Starting WASM loading...')

    // Load wasm_exec.js (make sure it's correctly included in your public directory)
    const go = new Go()
    console.log('Loaded wasm_exec.js')

    // Fetch the .wasm file from the public folder
    const wasmResponse = await fetch('/wasm/main.wasm')
    console.log('Attempting to fetch /wasm/main.wasm')

    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WASM: ${wasmResponse.statusText}`)
    }

    console.log('Successfully fetched /main.wasm')

    // Convert the response to an ArrayBuffer to instantiate the WASM module
    const wasmBuffer = await wasmResponse.arrayBuffer()
    console.log('WASM file converted to ArrayBuffer')

    // Instantiate the WebAssembly module
    const wasmModule = await WebAssembly.instantiate(wasmBuffer, go.importObject)
    console.log('WASM module instantiated')

    // Run the Go runtime with the instantiated module
    go.run(wasmModule.instance)
    console.log('WASM Go runtime started')
  } catch (err) {
    console.error('Error loading WASM:', err)
  }
}

function App() {
  useEffect(() => {
    loadWasm()
  }, [])

  const callGoFunction = () => {
    // Assuming your Go function `hello` is exposed globally
    const result = window.hello ? window.hello() : 'hello function not found'
    console.log(result)
  }

  return (
    <div className="App">
      <h1>WASM and React Integration</h1>
      <button onClick={callGoFunction}>Call Go Function</button>
    </div>
  )
}

export default App
