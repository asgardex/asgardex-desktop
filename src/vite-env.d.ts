declare module '*.svg?url' {
  const src: string
  export default src
}
declare module '*.svg?react' {
  import * as React from 'react'

  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export { ReactComponent }
  export default ReactComponent
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  [key: `VITE_${string}`]: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
