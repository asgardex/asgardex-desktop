import { Locale } from '../../shared/i18n/types'

export type CommonMessageKey =
  | 'common.greeting'
  | 'common.copyright'
  | 'common.stats'
  | 'common.network'
  | 'common.dex'
  | 'common.faqs'
  | 'common.type'
  | 'common.address'
  | 'common.addresses'
  | 'common.thorname'
  | 'common.thornameRegistrationSpecifics'
  | 'common.thornameError'
  | 'common.mayaname'
  | 'common.owner'
  | 'common.preferredAsset'
  | 'common.aliasChain'
  | 'common.aliasAddress'
  | 'common.expirationBlock'
  | 'common.expiry'
  | 'common.isUpdate'
  | 'common.to'
  | 'common.from'
  | 'common.filterValue'
  | 'common.amount'
  | 'common.coin'
  | 'common.collapseAll'
  | 'common.password'
  | 'common.memo'
  | 'common.memos'
  | 'common.refresh'
  | 'common.date'
  | 'common.remove'
  | 'common.back'
  | 'common.general'
  | 'common.advanced'
  | 'common.privateData'
  | 'common.keystore'
  | 'common.keystorePassword'
  | 'common.ledger'
  | 'common.phrase'
  | 'common.submit'
  | 'common.confirm'
  | 'common.cancel'
  | 'common.reject'
  | 'common.next'
  | 'common.finish'
  | 'common.copy'
  | 'common.loading'
  | 'common.error'
  | 'common.error.api.limit'
  | 'common.test'
  | 'common.change'
  | 'common.wallet'
  | 'common.history'
  | 'common.settings'
  | 'common.pool'
  | 'common.pool.inbound'
  | 'common.pools'
  | 'common.asset'
  | 'common.assets'
  | 'common.rune'
  | 'common.price'
  | 'common.price.rune'
  | 'common.price.cacao'
  | 'common.transaction'
  | 'common.transaction.short.rune'
  | 'common.transaction.short.asset'
  | 'common.viewTransaction'
  | 'common.copyTxUrl'
  | 'common.trackTransaction'
  | 'common.copyTxHash'
  | 'common.fee'
  | 'common.feeRate'
  | 'common.fee.nodeOperator'
  | 'common.fee.inbound'
  | 'common.fee.inbound.rune'
  | 'common.fee.inbound.asset'
  | 'common.fee.outbound'
  | 'common.fee.outbound.rune'
  | 'common.fee.outbound.asset'
  | 'common.fee.affiliate'
  | 'common.fees'
  | 'common.fee.estimated'
  | 'common.fees.estimated'
  | 'common.max'
  | 'common.min'
  | 'common.search'
  | 'common.searchAsset'
  | 'common.retry'
  | 'common.reload'
  | 'common.action'
  | 'common.add'
  | 'common.completeLp'
  | 'common.swap'
  | 'common.savers'
  | 'common.earn'
  | 'common.liquidity'
  | 'common.withdraw'
  | 'common.approve'
  | 'common.accept'
  | 'common.approve.checking'
  | 'common.approve.error'
  | 'common.step'
  | 'common.done'
  | 'common.address.self'
  | 'common.nodeAddress'
  | 'common.providerAddress'
  | 'common.tx.healthCheck'
  | 'common.tx.sending'
  | 'common.tx.sendingAsset'
  | 'common.tx.success'
  | 'common.tx.success-info'
  | 'common.tx.checkResult'
  | 'common.tx.view'
  | 'common.modal.confirmTitle'
  | 'common.value'
  | 'common.manage'
  | 'common.managePosition'
  | 'common.detail'
  | 'common.details'
  | 'common.filter'
  | 'common.all'
  | 'common.analytics'
  | 'common.asset.base'
  | 'common.asset.change'
  | 'common.noResult'
  | 'common.rate'
  | 'common.tx.type.swap'
  | 'common.tx.type.deposit'
  | 'common.tx.type.refund'
  | 'common.tx.type.donate'
  | 'common.tx.type.deposit'
  | 'common.tx.type.withdraw'
  | 'common.time.days'
  | 'common.time.days.short'
  | 'common.time.month1'
  | 'common.time.month1.short'
  | 'common.time.months3'
  | 'common.time.months3.short'
  | 'common.time.year1'
  | 'common.time.year1.short'
  | 'common.time.all'
  | 'common.time.all.short'
  | 'common.time.title'
  | 'common.inbound.time'
  | 'common.outbound.time'
  | 'common.streaming.time'
  | 'common.streaming.time.info'
  | 'common.totaltransaction.time'
  | 'common.confirmation.time'
  | 'common.theme.light'
  | 'common.theme.dark'
  | 'common.volume24'
  | 'common.volume24.description'
  | 'common.informationMore'
  | 'common.balance'
  | 'common.balance.loading'
  | 'common.balances'
  | 'common.custom'
  | 'common.notsupported.fornetwork'
  | 'common.recipient'
  | 'common.sender'
  | 'common.legacy'
  | 'common.ledgerlive'
  | 'common.metamask'
  | 'common.unknown'

export type CommonMessages = {
  [key in CommonMessageKey]: string
}

type UpdateMessagesKeys =
  | 'update.description'
  | 'update.link'
  | 'update.checkFailed'
  | 'update.checkForUpdates'
  | 'update.noUpdate'

export type UpdateMessages = { [key in UpdateMessagesKeys]: string }

type RoutesMessageKey = 'routes.invalid.asset' | 'routes.invalid.params'

export type RoutesMessages = { [key in RoutesMessageKey]: string }

type PoolsMessageKey =
  | 'pools.depth'
  | 'pools.apy'
  | 'pools.apr'
  | 'pools.count'
  | 'pools.filled'
  | 'pools.24hvol'
  | 'pools.avgsize'
  | 'pools.avgfee'
  | 'pools.blocksleft'
  | 'pools.trades'
  | 'pools.pending'
  | 'pools.available'
  | 'pools.pooled'
  | 'pools.limit.info'
  | 'pools.incentivependulum.info'
  | 'pools.incentivependulum.tooltip'
  | 'pools.incentivependulum.error'

export type PoolsMessages = { [key in PoolsMessageKey]: string }

type WalletMessageKey =
  | 'wallet.name'
  | 'wallet.name.maxChars'
  | 'wallet.name.error.empty'
  | 'wallet.name.error.duplicated'
  | 'wallet.name.error.rename'
  | 'wallet.nav.deposits'
  | 'wallet.nav.bonds'
  | 'wallet.nav.poolshares'
  | 'wallet.nav.savers'
  | 'wallet.column.name'
  | 'wallet.column.ticker'
  | 'wallet.action.send'
  | 'wallet.action.receive'
  | 'wallet.action.receive.title'
  | 'wallet.action.forget'
  | 'wallet.action.unlock'
  | 'wallet.action.connect'
  | 'wallet.action.import'
  | 'wallet.action.create'
  | 'wallet.action.deposit'
  | 'wallet.balance.total.poolAssets'
  | 'wallet.balance.total.poolAssets.info'
  | 'wallet.shares.total'
  | 'wallet.connect.instruction'
  | 'wallet.unlock.instruction'
  | 'wallet.lock.label'
  | 'wallet.unlock.label'
  | 'wallet.unlock.title'
  | 'wallet.unlock.password'
  | 'wallet.unlock.error'
  | 'wallet.imports.keystore.select'
  | 'wallet.imports.keystore.title'
  | 'wallet.imports.phrase.title'
  | 'wallet.imports.wallet'
  | 'wallet.imports.enterphrase'
  | 'wallet.imports.error.instance'
  | 'wallet.imports.error.keystore.load'
  | 'wallet.imports.error.keystore.import'
  | 'wallet.imports.error.ledger.import'
  | 'wallet.imports.error.keystore.password'
  | 'wallet.phrase.error.valueRequired'
  | 'wallet.phrase.error.invalid'
  | 'wallet.phrase.error.import'
  | 'wallet.imports.error.phrase.empty'
  | 'wallet.txs.history'
  | 'wallet.txs.history.disabled'
  | 'wallet.add.another'
  | 'wallet.add.label'
  | 'wallet.change.title'
  | 'wallet.change.error'
  | 'wallet.selected.title'
  | 'wallet.create.title'
  | 'wallet.create.creating'
  | 'wallet.create.error'
  | 'wallet.create.error.phrase'
  | 'wallet.create.error.phrase.empty'
  | 'wallet.create.copy.phrase'
  | 'wallet.create.words.click'
  | 'wallet.create.enter.phrase'
  | 'wallet.receive.address.error'
  | 'wallet.receive.address.errorQR'
  | 'wallet.remove.label'
  | 'wallet.remove.label.title'
  | 'wallet.remove.label.description'
  | 'wallet.send.success'
  | 'wallet.send.fastest'
  | 'wallet.send.fast'
  | 'wallet.send.average'
  | 'wallet.send.max.doge'
  | 'wallet.password.confirmation.title'
  | 'wallet.password.confirmation.description'
  | 'wallet.password.confirmation.pending'
  | 'wallet.password.empty'
  | 'wallet.password.confirmation.error'
  | 'wallet.password.repeat'
  | 'wallet.password.mismatch'
  | 'wallet.errors.balancesFailed'
  | 'wallet.errors.asset.notExist'
  | 'wallet.errors.address.empty'
  | 'wallet.errors.address.invalid'
  | 'wallet.errors.address.inbound'
  | 'wallet.errors.address.couldNotFind'
  | 'wallet.errors.amount.shouldBeNumber'
  | 'wallet.errors.amount.shouldBeGreaterThan'
  | 'wallet.errors.amount.shouldBeGreaterOrEqualThan'
  | 'wallet.errors.amount.shouldBeLessThanBalance'
  | 'wallet.errors.amount.shouldBeLessThanBalanceAndFee'
  | 'wallet.errors.fee.notCovered'
  | 'wallet.errors.invalidChain'
  | 'wallet.errors.memo.max'
  | 'wallet.send.error'
  | 'wallet.validations.lessThen'
  | 'wallet.validations.graterThen'
  | 'wallet.validations.shouldNotBeEmpty'
  | 'wallet.ledger.verifyAddress.modal.title'
  | 'wallet.ledger.verifyAddress.modal.description'

export type WalletMessages = { [key in WalletMessageKey]: string }

type BondsMessageKey =
  | 'bonds.node'
  | 'bonds.bond'
  | 'bonds.award'
  | 'bonds.status'
  | 'bonds.status.active'
  | 'bonds.status.standby'
  | 'bonds.status.disabled'
  | 'bonds.status.whitelisted'
  | 'bonds.node.add'
  | 'bonds.nodes.error'
  | 'bonds.node.enterMessage'
  | 'bonds.node.removeMessage'
  | 'bonds.validations.nodeAlreadyAdded'

export type BondsMessages = { [key in BondsMessageKey]: string }

type PoolSharesMessageKey =
  | 'poolshares.ownership'
  | 'poolshares.both.info'
  | 'poolshares.single.info'
  | 'poolshares.single.notsupported'

export type PoolSharesMessage = { [key in PoolSharesMessageKey]: string }

type LedgerMessageKey =
  | 'ledger.title'
  | 'ledger.title.sign'
  | 'ledger.sign'
  | 'ledger.blindsign'
  | 'ledger.needsconnected'
  | 'ledger.add.device'
  | 'ledger.error.nodevice'
  | 'ledger.error.inuse'
  | 'ledger.error.appnotopened'
  | 'ledger.error.noapp'
  | 'ledger.error.getaddressfailed'
  | 'ledger.error.signfailed'
  | 'ledger.error.sendfailed'
  | 'ledger.error.depositfailed'
  | 'ledger.error.invalidpubkey'
  | 'ledger.error.invaliddata'
  | 'ledger.error.rejected'
  | 'ledger.error.timeout'
  | 'ledger.error.invalidresponse'
  | 'ledger.error.notimplemented'
  | 'ledger.error.denied'
  | 'ledger.error.unknown'
  | 'ledger.notsupported'
  | 'ledger.notaddedorzerobalances'
  | 'ledger.deposit.oneside'
  | 'ledger.legacyformat.note'
  | 'ledger.legacyformat.show'
  | 'ledger.legacyformat.hide'

export type LedgerMessages = { [key in LedgerMessageKey]: string }

type SettingMessageKey =
  | 'setting.app.title'
  | 'setting.wallet.title'
  | 'setting.wallet.management'
  | 'setting.multiwallet.management'
  | 'setting.client'
  | 'setting.accounts'
  | 'setting.export'
  | 'setting.lock'
  | 'setting.view.phrase'
  | 'setting.version'
  | 'setting.language'
  | 'setting.notconnected'
  | 'setting.connected'
  | 'setting.add.device'
  | 'setting.wallet.index'
  | 'setting.wallet.index.info'
  | 'setting.wallet.hdpath.legacy.info'
  | 'setting.wallet.hdpath.ledgerlive.info'
  | 'setting.wallet.hdpath.metamask.info'
  | 'setting.thornode.node.error.url'
  | 'setting.thornode.node.error.unhealthy'
  | 'setting.thornode.rpc.error.url'
  | 'setting.thornode.rpc.error.unhealthy'
  | 'setting.thornode.node.valid'
  | 'setting.thornode.rpc.valid'
  | 'setting.mayanode.node.error.url'
  | 'setting.mayanode.node.error.unhealthy'
  | 'setting.mayanode.rpc.error.url'
  | 'setting.mayanode.rpc.error.unhealthy'
  | 'setting.mayanode.node.valid'
  | 'setting.mayanode.rpc.valid'

export type SettingMessages = { [key in SettingMessageKey]: string }

type MidgardMessageKey =
  | 'midgard.error.endpoint.title'
  | 'midgard.url.error.invalid'
  | 'midgard.url.error.unhealthy'
  | 'midgard.url.valid'

export type MidgardMessages = { [key in MidgardMessageKey]: string }

type SwapMessageKey =
  | 'swap.input'
  | 'swap.output'
  | 'swap.slip.title'
  | 'swap.slip.tolerance'
  | 'swap.slip.tolerance.info'
  | 'swap.slip.tolerance.ledger-disabled.info'
  | 'swap.streaming.interval'
  | 'swap.streaming.title'
  | 'swap.streaming.interval.info'
  | 'swap.streaming.quantity'
  | 'swap.streaming.quantity.info'
  | 'swap.state.pending'
  | 'swap.state.success'
  | 'swap.state.error'
  | 'swap.info.max.balance'
  | 'swap.info.max.balanceMinusFee'
  | 'swap.errors.asset.missingSourceAsset'
  | 'swap.errors.asset.missingTargetAsset'
  | 'swap.errors.amount.balanceShouldCoverChainFee'
  | 'swap.errors.amount.outputShouldCoverChainFee'
  | 'swap.errors.amount.thornodeQuoteError'
  | 'swap.errors.pool.notAvailable'
  | 'swap.note.lockedWallet'
  | 'swap.note.nowallet'
  | 'swap.min.amount.info'
  | 'swap.min.result.info'
  | `swap.min.result.protected`

export type SwapMessages = { [key in SwapMessageKey]: string }

type DepositMessageKey =
  | 'deposit.interact.title'
  | 'deposit.interact.subtitle'
  | 'deposit.interact.label.bondprovider'
  | 'deposit.interact.actions.bond'
  | 'deposit.interact.actions.addBondProvider'
  | 'deposit.interact.actions.unbond'
  | 'deposit.interact.actions.leave'
  | 'deposit.interact.actions.buyThorname'
  | 'deposit.interact.actions.checkThorname'
  | 'deposit.share.title'
  | 'deposit.share.units'
  | 'deposit.share.poolshare'
  | 'deposit.share.total'
  | 'deposit.redemption.title'
  | 'deposit.totalEarnings'
  | 'deposit.add.sym'
  | 'deposit.add.asym'
  | 'deposit.add.runeSide'
  | 'deposit.add.assetSide'
  | 'deposit.add.min.info'
  | 'deposit.add.max.info'
  | 'deposit.add.max.infoWithFee'
  | 'deposit.add.state.sending'
  | 'deposit.add.state.checkResults'
  | 'deposit.add.state.pending'
  | 'deposit.add.state.success'
  | 'deposit.add.state.error'
  | 'deposit.add.error.chainFeeNotCovered'
  | 'deposit.add.error.nobalances'
  | 'deposit.add.error.nobalance1'
  | 'deposit.add.error.nobalance2'
  | 'deposit.add.pendingAssets.title'
  | 'deposit.add.pendingAssets.description'
  | 'deposit.add.failedAssets.description'
  | 'deposit.add.pendingAssets.recoveryTitle'
  | 'deposit.add.pendingAssets.recoveryDescriptionRune'
  | 'deposit.add.pendingAssets.recoveryDescriptionAsset'
  | 'deposit.add.asymAssets.title'
  | 'deposit.add.asymAssets.description'
  | 'deposit.add.asymAssets.recoveryTitle'
  | 'deposit.add.asymAssets.recoveryDescription'
  | 'deposit.add.assetMissmatch.title'
  | 'deposit.add.assetMissmatch.description'
  | 'deposit.bond.state.error'
  | 'deposit.unbond.state.error'
  | 'deposit.leave.state.error'
  | 'deposit.advancedMode'
  | 'deposit.poolDetails.depth'
  | 'deposit.poolDetails.24hvol'
  | 'deposit.poolDetails.allTimeVal'
  | 'deposit.poolDetails.totalSwaps'
  | 'deposit.poolDetails.totalUsers'
  | 'deposit.poolDetails.volumeTotal'
  | 'deposit.poolDetails.earnings'
  | 'deposit.poolDetails.ilpPaid'
  | 'deposit.poolDetails.totalTx'
  | 'deposit.poolDetails.totalFees'
  | 'deposit.poolDetails.members'
  | 'deposit.poolDetails.apy'
  | 'deposit.pool.noShares'
  | 'deposit.wallet.add'
  | 'deposit.wallet.connect'
  | 'deposit.withdraw.sym'
  | 'deposit.withdraw.asym'
  | 'deposit.withdraw.sym.title'
  | 'deposit.withdraw.asym.title'
  | 'deposit.withdraw.pending'
  | 'deposit.withdraw.success'
  | 'deposit.withdraw.error'
  | 'deposit.withdraw.choseText'
  | 'deposit.withdraw.fees'
  | 'deposit.withdraw.feeNote'
  | 'deposit.withdraw.error.feeNotCovered'
  | 'deposit.ledger.sign'

export type DepositMessages = { [key in DepositMessageKey]: string }

type SaversMessageKey =
  | 'savers.noSavings'
  | 'savers.detail.title'
  | 'savers.detail.current.title'
  | 'savers.detail.redeem.title'
  | 'savers.detail.percent'
  | 'savers.detail.totalGrowth'
  | 'savers.detail.priceGrowth'
  | 'savers.detail.assetAmount'
  | 'savers.info.max.redeem.value'
  | 'savers.info.max.balance'
  | 'savers.add.state.sending'
  | 'savers.add.state.checkResults'
  | 'savers.add.state.pending'
  | 'savers.add.state.success'
  | 'savers.add.state.error'
  | 'savers.withdraw.state.sending'
  | 'savers.withdraw.state.checkResults'
  | 'savers.withdraw.state.pending'
  | 'savers.withdraw.state.success'
  | 'savers.withdraw.state.error'

export type SaversMessages = { [key in SaversMessageKey]: string }

export type HaltMessageKey =
  | 'halt.thorchain'
  | 'halt.trading'
  | 'halt.chain'
  | 'halt.chains'
  | 'halt.chain.trading'
  | 'halt.chain.synth'
  | 'halt.chain.pause'
  | 'halt.chain.pauseall'

export type HaltMessages = { [key in HaltMessageKey]: string }

export type Messages = CommonMessages &
  RoutesMessages &
  PoolsMessages &
  WalletMessages &
  SettingMessages &
  SwapMessages &
  DepositMessages &
  SaversMessages &
  LedgerMessages &
  BondsMessages &
  PoolSharesMessage &
  UpdateMessages &
  HaltMessages

export type Translation = {
  locale: Locale
  messages: Messages
}
