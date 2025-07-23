import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../../helpers/styleHelper'
import { AssetIcon as AssetIconUI } from '../assets/assetIcon'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`

export const ValuesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  text-align: left;
  ${media.md`
    margin: 0 15px 0 0;
  `}

  &:last-child {
    margin: 0;
  }
`

export const ContainerWithDelimeter = styled.div`
  display: inline-block;
  position: relative;
  margin: 0 2px 0 0;

  &:first-child {
    margin-left: 0;
  }

  &:last-of-type {
    margin-right: 0;
    &:after {
      content: none;
      display: none;
    }
  }
`

export const InOutContainer = styled(ContainerWithDelimeter)`
  display: flex;
  font-size: 12px;
  text-transform: uppercase;
  padding: 3px 5px;
  line-height: 22px;
  background: ${palette('background', 2)};
  border: 1px solid ${palette('gray', 2)};
  color: ${palette('text', 0)};

  &:first-child {
    border-top-left-radius: 1.7rem;
    border-bottom-left-radius: 1.7rem;
    align-self: flex-start;
  }

  &:last-child {
    border-top-right-radius: 1.7rem;
    border-bottom-right-radius: 1.7rem;
  }

  ${media.md`
    font-size: 14px;
    padding: 5px 10px;
    &:after {
      content: ' ';
    }
  `}
`

export const InOutValueContainer = styled.div`
  display: flex;
  align-items: center;
`

export const InOutValue = styled(ContainerWithDelimeter)`
  white-space: nowrap;
  padding: 0 4px;

  ${media.lg`
    padding: 0;
  `}
`

export const AssetIcon = styled(AssetIconUI)`
  margin: 0 4px;
`

export const InOutText = styled.span`
  font-size: 12px;
  color: ${palette('text', 2)};
  text-transform: uppercase;
  margin-right: 4px;

  &:first-child {
    margin-right: 4px;
    margin-left: 4px;
  }
  &:last-child {
    margin-left: 4px;
  }

  ${media.md`
   &:first-child {
    margin-right: 4px;
    margin-left: 4px;
    }
    &:last-child {
      margin-left: 4px;
    }
  `}

  &:only-child {
    margin: 0;
  }
`

export const AdditionalInfoContainer = styled.span`
  margin-right: 10px;

  &:last-child {
    margin-right: 0;
  }

  &,
  & .label-wrapper {
    padding: 0;
    color: ${palette('gray', 2)};
    font-size: 14px;
  }
`
