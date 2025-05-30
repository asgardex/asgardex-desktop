import React from 'react'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Button as UIButton } from '../button'
import { Label as UILabel } from '../label'

export const ReloadFeeButton = styled(UIButton).attrs({
  typevalue: 'outline',
  children: <ArrowPathIcon />
})`
  &.ant-btn {
    /* overridden */
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: auto;
    margin-right: 10px;

    svg {
      min-width: 24px;
      min-height: 24px;
    }
  }
  width: 30px;
  height: 30px;
  margin-right: 10px;
`
export const Container = styled('div')`
  display: flex;
  align-items: center;
  color: ${palette('text', 0)};
`

export const FeeLabel = styled(UILabel)<{ isError?: boolean; isLoading?: boolean }>`
  text-transform: uppercase;
  font-size: 12px;
  font-family: 'MainFontRegular';
  color: ${({ isError, isLoading }) =>
    isError ? palette('error', 0) : isLoading ? palette('gray', 2) : palette('text', 0)};
`
