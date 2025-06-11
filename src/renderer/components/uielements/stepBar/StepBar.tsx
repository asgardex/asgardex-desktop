import * as Styled from './StepBar.styles'

export type Props = {
  size?: number
  className?: string
}

export const StepBar = ({ size = 150, className }: Props): JSX.Element => {
  return (
    <Styled.Container className={className}>
      <Styled.Dot />
      <Styled.Line size={size} />
      <Styled.Dot />
    </Styled.Container>
  )
}
