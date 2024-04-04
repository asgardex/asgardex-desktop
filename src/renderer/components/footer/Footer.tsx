import React, { useCallback } from 'react'

import Icon, { TwitterOutlined, BranchesOutlined, BugOutlined, GithubOutlined, GlobalOutlined } from '@ant-design/icons'
import { Row, Col, Grid } from 'antd'
import { useNavigate } from 'react-router-dom'

import { ExternalUrl } from '../../../shared/const'
import { ReactComponent as DiscordIcon } from '../../assets/svg/discord.svg'
import { ReactComponent as ThorChainIcon } from '../../assets/svg/logo-thorchain.svg'
import { useDex } from '../../hooks/useDex'
import * as playgroundRoutes from '../../routes/playground'
import { mayaIconT } from '../icons'
import * as Styled from './Footer.styles'

type IconProps = {
  url: string
  children: React.ReactNode
  onClick: (url: string) => void
}

const FooterIcon: React.FC<IconProps> = (props: IconProps): JSX.Element => {
  const { children, url, onClick } = props

  const clickHandler = useCallback(() => {
    onClick(url)
  }, [url, onClick])

  return <Styled.IconWrapper onClick={clickHandler}>{children}</Styled.IconWrapper>
}

export type Props = {
  commitHash?: string
  isDev: boolean
  publicIP: string
}

export const Footer: React.FC<Props> = (props): JSX.Element => {
  const { commitHash, isDev, publicIP } = props

  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const { dex } = useDex()
  const gotoPlayground = useCallback(() => navigate(playgroundRoutes.base.path()), [navigate])

  const clickIconHandler = useCallback((url: string) => {
    window.apiUrl.openExternal(url)
  }, [])

  return (
    <Styled.Container>
      <Row justify="space-between" align="middle">
        <Col span={24} md={12}>
          <Row justify={screens.md ? 'start' : 'center'}>
            <FooterIcon url={ExternalUrl.DOCS} onClick={clickIconHandler}>
              {dex === 'THOR' ? (
                <ThorChainIcon />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <div className="mr-2">
                    <Styled.Icon src={mayaIconT} />
                  </div>
                  <div>
                    <Styled.TextLabel>MAYACHAIN</Styled.TextLabel>
                  </div>
                </div>
              )}
            </FooterIcon>
            {publicIP && <div className=" px-20px text-[14px] text-gray2 dark:text-gray2d">Public IP: {publicIP}</div>}
          </Row>
        </Col>
        <Col span={24} md={12}>
          <Row justify={screens.md ? 'end' : 'center'} style={{ marginTop: screens.md ? '0' : '10px' }}>
            <FooterIcon url={ExternalUrl.ASGARDEX} onClick={clickIconHandler}>
              <GlobalOutlined />
            </FooterIcon>
            <FooterIcon url={ExternalUrl.GITHUB_REPO} onClick={clickIconHandler}>
              <GithubOutlined />
            </FooterIcon>
            <FooterIcon url={ExternalUrl.DISCORD} onClick={clickIconHandler}>
              <Icon component={DiscordIcon} />
            </FooterIcon>
            <FooterIcon url={ExternalUrl.TWITTER} onClick={clickIconHandler}>
              <TwitterOutlined />
            </FooterIcon>

            {/* hidden in production build */}
            {isDev && commitHash && (
              <FooterIcon url={`${ExternalUrl.GITHUB_REPO}/commit/${commitHash}`} onClick={clickIconHandler}>
                <BranchesOutlined />
              </FooterIcon>
            )}
            {/* hidden in production build */}
            {isDev && (
              <Styled.IconWrapper onClick={gotoPlayground}>
                <BugOutlined />
              </Styled.IconWrapper>
            )}
          </Row>
        </Col>
      </Row>
    </Styled.Container>
  )
}
