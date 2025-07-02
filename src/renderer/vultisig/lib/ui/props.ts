export type ChildrenProp = {
  children: React.ReactNode
}

export type OnBackProp = {
  onBack: () => void
}

export type OnFinishProp<T = void, Mode extends 'required' | 'optional' = 'required'> = [T] extends [void]
  ? { onFinish: () => void }
  : Mode extends 'optional'
  ? { onFinish: (value?: T) => void }
  : { onFinish: (value: T) => void }

export type ValueProp<T> = {
  value: T
}

export type TitleProp = {
  title: React.ReactNode
}
