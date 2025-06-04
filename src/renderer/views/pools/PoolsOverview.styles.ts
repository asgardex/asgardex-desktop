import { StarIcon as StarFilledHero } from '@heroicons/react/20/solid' // Filled star
import { StarIcon as StarOutlinedHero } from '@heroicons/react/24/outline' // Outlined star
import styled, { css } from 'styled-components'
import { palette } from 'styled-theme'

import { AssetsFilter as AssetsFilterUI } from '../../components/AssetsFilter'
import { Label as UILabel } from '../../components/uielements/label'

export const TableAction = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  > :not(:first-child) {
    margin-left: 10px;
  }
`

export const BlockLeftLabel = styled(UILabel)`
  display: inline-block;
  width: 100px;
  font-size: 16px;
  text-align: right;
`

export const Label = styled(UILabel)`
  font-size: 16px;
`

export const AssetsFilter = styled(AssetsFilterUI)`
  margin-bottom: 20px;
`

export const WatchContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
`

const starStyle = css`
  width: 20px;
  height: 20px;
  stroke: ${palette('primary', 2)};
`

export const StarOutlined = styled(StarOutlinedHero)`
  ${starStyle}
`

export const StarFilled = styled(StarFilledHero)`
  ${starStyle}
`
