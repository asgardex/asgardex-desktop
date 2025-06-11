import * as Styled from './PoolShareCard.styles'

export type Props = {
  title: string
  children: React.ReactNode
}

export const PoolShareCard = ({ title, children }: Props) => {
  return (
    <Styled.Wrapper>
      <Styled.Title>{title}</Styled.Title>
      <Styled.Content>{children}</Styled.Content>
    </Styled.Wrapper>
  )
}
