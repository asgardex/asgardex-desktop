import { LoadingOutlined as ALoadingOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Size, Sizes, FontSizes } from './AssetIcon.types'

type IconProps = {
  size: Size
  isNotNative?: boolean
  isSynth?: boolean
  isTrade?: boolean
}

const fontSizes: FontSizes = {
  large: 18,
  big: 11,
  normal: 10,
  small: 8,
  xsmall: 5
}

export const sizes: Sizes = {
  large: 72,
  big: 55,
  normal: 40,
  small: 32,
  xsmall: 20
}

export const borders: Sizes = {
  large: 6,
  big: 5,
  normal: 4,
  small: 3,
  xsmall: 2
}

export const IconWrapper = styled.div<IconProps>`
  width: ${({ size }) => `${sizes[size]}px`};
  height: ${({ size }) => `${sizes[size]}px`};
  border: ${({ isSynth, isTrade, size }) => (isSynth || isTrade ? `solid ${borders[size]}px` : `none`)};
  border-color: ${({ isSynth, isTrade }) =>
    isSynth ? palette('primary', 0) : isTrade ? palette('primary', 2) : 'transparent'};
  border-radius: 50%;
  position: relative;
  background-size: cover;
  background-position: center;

  /* Add shadow effect around the border */
  ${({ isSynth, isTrade }) => {
    if (isSynth) {
      return `
      box-shadow: 0px 0px 15px 5px rgba(80, 227, 194, 0.8); /* A greenish shadow for synth  */
      `
    }
    if (isTrade) {
      return `
      box-shadow: 0px 0px 15px 5px rgba(113, 188, 247, 0.8);  /* A blueish shadow */
    `
    }
    return '' /* No shadow for non-synth and non-trade assets */
  }}
`

export const LoadingOutlined = styled(ALoadingOutlined)`
  width: 100%;
  height: 100%;
`

export const IconBG = styled.div<IconProps>`
  width: ${({ size, isNotNative }) => `${sizes[size] - (isNotNative ? 2 : 0) * borders[size]}px`};
  height: ${({ size, isNotNative }) => `${sizes[size] - (isNotNative ? 2 : 0) * borders[size]}px`};
  position: absolute;
  left: 0;
  top: 0;
  background-color: ${palette('gray', 1)};
`

export const IconFallback = styled.div<IconProps>`
  width: ${({ size, isNotNative }) => `${sizes[size] - (isNotNative ? 2 : 0) * borders[size]}px`};
  height: ${({ size, isNotNative }) => `${sizes[size] - (isNotNative ? 2 : 0) * borders[size]}px`};
  left: 0;
  top: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ size }) => `${fontSizes[size]}px`};
  color: ${palette('text', 3)};
`

export const Icon = styled.img<IconProps>`
  position: absolute;
  left: ${({ isNotNative }) => `${isNotNative ? borders : 0}px`}; // adjusted calculation
  top: ${({ isNotNative }) => `${isNotNative ? borders : 0}px`}; // adjusted calculation
  width: ${({ size, isNotNative }) => `${sizes[size] - (isNotNative ? 2 : 0) * borders[size]}px`};
  height: ${({ size, isNotNative }) => `${sizes[size] - (isNotNative ? 2 : 0) * borders[size]}px`};
  border-radius: 50%;
  max-width: auto; // overridden to avoid max-w-100% (default)
`

export const OverlayIcon = styled.img<IconProps>`
  position: absolute;
  right: 0;
  bottom: 0;
  width: ${({ size }) => `${sizes[size] * 0.4}px`};
  height: ${({ size }) => `${sizes[size] * 0.4}px`};
  border-radius: 50%;
  z-index: 2;
  background-color: rgba(255, 255, 255, 0.5);
`
