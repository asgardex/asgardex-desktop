import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import * as appRoutes from '../routes/app'
import * as bondsRoutes from '../routes/bonds'
import * as playgroundRoutes from '../routes/playground'
import * as poolsRoutes from '../routes/pools'
import * as portfolioRoutes from '../routes/portfolio'
import * as vultisigRoutes from '../routes/vultisig'
import * as walletRoutes from '../routes/wallet'
import { AppSettings } from './app/AppSettings'
import { BondsView } from './bonds/BondsView'
import { DepositView } from './deposit/DepositView'
import { NoContentView } from './NoContentView'
import { PlaygroundView } from './playground/PlaygroundView'
import { PoolsOverview } from './pools/PoolsOverview'
import { PortfolioView } from './portfolio/PortfolioView'
import { SwapView } from './swap/SwapView'
import { EmailConfirmation } from './vultisig/EmailConfirmation'
import { FastKeygenView } from './vultisig/FastKeygenView'
import { ImportVaultView } from './vultisig/ImportVaultView'
import { KeygenFlowView } from './vultisig/KeygenFlow'
import { SetupFastVaultView } from './vultisig/SetupFastVaultView'
import { VultisigSetupView } from './vultisig/SetupView'
import { VaultBackupFlow } from './vultisig/VaultBackupFlow'
import { VaultView } from './vultisig/VaultView'
import { WaitForServerStepView } from './vultisig/WaitForServerStep'
import { AssetDetailsView } from './wallet/AssetDetailsView'
import { AssetsView } from './wallet/AssetsView'
import { CreateView } from './wallet/CreateView'
import { WalletHistoryView } from './wallet/history'
import { ImportKeystoreView } from './wallet/ImportKeystoreView'
import { ImportPhraseView } from './wallet/ImportPhraseView'
import { InteractView } from './wallet/Interact'
import { NoWalletView } from './wallet/NoWalletView'
import { PoolShareView } from './wallet/PoolShareView'
import { RunepoolView } from './wallet/RunepoolView'
import { SendView } from './wallet/send'
import { TcyView } from './wallet/TcyView'
import { TradeAssetsView } from './wallet/TradeAssetsView'
import { UnlockView } from './wallet/UnlockView'
import { WalletAuth } from './wallet/WalletAuth'

export const ViewRoutes = (): JSX.Element => {
  const location = useLocation()
  return (
    <Routes>
      {/* home */}
      <Route path={appRoutes.base.template} element={<Navigate to={walletRoutes.assets.template} />} />
      {/* pool routes */}
      <Route path={poolsRoutes.base.template} element={<PoolsOverview />} />
      <Route path={poolsRoutes.active.template} element={<PoolsOverview />} />
      <Route path={poolsRoutes.pending.template} element={<PoolsOverview />} />

      <Route path={poolsRoutes.swap.template} element={<SwapView />} />
      <Route
        path={poolsRoutes.deposit.template}
        element={
          <WalletAuth>
            <DepositView />
          </WalletAuth>
        }
      />
      {/* bonds routes */}
      <Route
        path={bondsRoutes.base.template}
        element={
          <WalletAuth>
            <BondsView />
          </WalletAuth>
        }
      />
      {/* portfolio routes */}
      <Route
        path={portfolioRoutes.base.template}
        element={
          <WalletAuth>
            <PortfolioView />
          </WalletAuth>
        }
      />
      {/* vultisig routes */}
      <Route path={vultisigRoutes.setupVault.template} element={<VultisigSetupView />} />
      <Route path={vultisigRoutes.setupFastVault.template} element={<SetupFastVaultView />} />
      <Route path={vultisigRoutes.waitForServer.template} element={<WaitForServerStepView />} />
      <Route path={vultisigRoutes.fastKeygen.template} element={<FastKeygenView />} />
      <Route path={vultisigRoutes.keygenFlow.template} element={<KeygenFlowView />} />
      <Route path={vultisigRoutes.emailConfirmation.template} element={<EmailConfirmation />} />
      <Route path={vultisigRoutes.vaultBackup.template} element={<VaultBackupFlow />} />
      <Route path={vultisigRoutes.importVault.template} element={<ImportVaultView />} />
      <Route path={vultisigRoutes.vault.template} element={<VaultView />} />
      {/* wallet routes */}
      <Route path={walletRoutes.noWallet.template} element={<NoWalletView />} />
      <Route path={`${walletRoutes.create.base.template}/*`} element={<CreateView />} />
      <Route path={walletRoutes.locked.template} element={<UnlockView />} />
      <Route path={walletRoutes.imports.keystore.template} element={<ImportKeystoreView />} />
      <Route path={walletRoutes.imports.phrase.template} element={<ImportPhraseView />} />
      <Route
        path={walletRoutes.base.template}
        element={<Navigate to={{ pathname: walletRoutes.assets.path(), search: location.search }} />}
      />
      <Route
        path={walletRoutes.assets.template}
        element={
          <WalletAuth>
            <AssetsView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.tradeAssets.template}
        element={
          <WalletAuth>
            <TradeAssetsView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.poolShares.template}
        element={
          <WalletAuth>
            <PoolShareView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.tcy.template}
        element={
          <WalletAuth>
            <TcyView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.runepool.template}
        element={
          <WalletAuth>
            <RunepoolView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.interact.template}
        element={
          <WalletAuth>
            <InteractView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.send.template}
        element={
          <WalletAuth>
            <SendView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.assetDetail.template}
        element={
          <WalletAuth>
            <AssetDetailsView />
          </WalletAuth>
        }
      />
      <Route
        path={walletRoutes.history.template}
        element={
          <WalletAuth>
            <WalletHistoryView />
          </WalletAuth>
        }
      />

      <Route path={appRoutes.settings.template} element={<AppSettings />} />
      {/* playground - DEV only */}
      <Route path={playgroundRoutes.base.template} element={<PlaygroundView />} />
      {/* 404 */}
      <Route path="*" element={<NoContentView />} />
    </Routes>
  )
}
