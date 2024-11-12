import React from 'react'

import { Provider } from 'react-redux'
import { HashRouter as Router } from 'react-router-dom'

import { AppProvider } from './contexts/AppContext'
import { ArbProvider } from './contexts/ArbContext'
import { AvaxProvider } from './contexts/AvaxContext'
import { BaseProvider } from './contexts/BaseContext'
import { BitcoinCashProvider } from './contexts/BitcoinCashContext'
import { BitcoinProvider } from './contexts/BitcoinContext'
import { BscProvider } from './contexts/BscContext'
import { ChainProvider } from './contexts/ChainContext'
import { ChainflipProvider } from './contexts/ChainflipContext'
import { CosmosProvider } from './contexts/CosmosContext'
import { DashProvider } from './contexts/DashContext'
import { DogeProvider } from './contexts/DogeContext'
import { EthereumProvider } from './contexts/EthereumContext'
import { I18nProvider } from './contexts/I18nContext'
import { KujiProvider } from './contexts/KujiContext'
import { LitecoinProvider } from './contexts/LitecoinContext'
import { MayachainProvider } from './contexts/MayachainContext'
import { MayachainQueryProvider } from './contexts/MayachainQueryContext'
import { MidgardProvider } from './contexts/MidgardContext'
import { MayaMidgardProvider } from './contexts/MidgardMayaContext'
import { SolProvider } from './contexts/SolContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ThorchainProvider } from './contexts/ThorchainContext'
import { ThorchainQueryProvider } from './contexts/ThorchainQueryContext'
import { UserBondProvidersProvider } from './contexts/UserBondProvidersContext'
import { UserNodesProvider } from './contexts/UserNodesContext'
import { WalletProvider } from './contexts/WalletContext'
import { XrdProvider } from './contexts/XrdContext'
import { store } from './store/store'
import { AppView } from './views/app/AppView'

export const App: React.FC = (): JSX.Element => {
  return (
    <Provider store={store}>
      <AppProvider>
        <WalletProvider>
          <ChainProvider>
            <ThorchainProvider>
              <BitcoinProvider>
                <LitecoinProvider>
                  <BitcoinCashProvider>
                    <EthereumProvider>
                      <AvaxProvider>
                        <BaseProvider>
                          <BscProvider>
                            <ArbProvider>
                              <DogeProvider>
                                <KujiProvider>
                                  <SolProvider>
                                    <XrdProvider>
                                      <DashProvider>
                                        <CosmosProvider>
                                          <MidgardProvider>
                                            <ThorchainQueryProvider>
                                              <MayachainProvider>
                                                <MayachainQueryProvider>
                                                  <MayaMidgardProvider>
                                                    <UserNodesProvider>
                                                      <UserBondProvidersProvider>
                                                        <ChainflipProvider>
                                                          <I18nProvider>
                                                            <Router>
                                                              <ThemeProvider>
                                                                <AppView />
                                                              </ThemeProvider>
                                                            </Router>
                                                          </I18nProvider>
                                                        </ChainflipProvider>
                                                      </UserBondProvidersProvider>
                                                    </UserNodesProvider>
                                                  </MayaMidgardProvider>
                                                </MayachainQueryProvider>
                                              </MayachainProvider>
                                            </ThorchainQueryProvider>
                                          </MidgardProvider>
                                        </CosmosProvider>
                                      </DashProvider>
                                    </XrdProvider>
                                  </SolProvider>
                                </KujiProvider>
                              </DogeProvider>
                            </ArbProvider>
                          </BscProvider>
                        </BaseProvider>
                      </AvaxProvider>
                    </EthereumProvider>
                  </BitcoinCashProvider>
                </LitecoinProvider>
              </BitcoinProvider>
            </ThorchainProvider>
          </ChainProvider>
        </WalletProvider>
      </AppProvider>
    </Provider>
  )
}
