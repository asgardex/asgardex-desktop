// All icons used as <MysvgIcon> components
// Note: CRA5 + webpack has some issues by importing svg properly
// Workaround: Use `file-loader` explicit for imports
// See https://github.com/facebook/create-react-app/issues/11770#issuecomment-1022024494
/* eslint-disable import/no-webpack-loader-syntax */
import arbIcon from '!file-loader!../../assets/svg/asset-arb.svg'
import atomIcon from '!file-loader!../../assets/svg/asset-atom.svg'
import avaxIcon from '!file-loader!../../assets/svg/asset-avax.svg'
import bscIcon from '!file-loader!../../assets/svg/asset-bsc.svg'
import btcIcon from '!file-loader!../../assets/svg/asset-btc.svg'
import dashIcon from '!file-loader!../../assets/svg/asset-dash.svg'
import ethIcon from '!file-loader!../../assets/svg/asset-eth.svg'
import xrdIcon from '!file-loader!../../assets/svg/asset-radix.svg'
import runeIcon from '!file-loader!../../assets/svg/asset-rune.svg'
import xRuneIcon from '!file-loader!../../assets/svg/asset-xrune.svg'
import cacaoIcon from '../../assets/png/asset-cacao.png'
import dogeIcon from '../../assets/png/asset-doge.png'
import kujiIcon from '../../assets/png/asset-kuji.png'
import mayaIconT from '../../assets/png/asset-maya-T.png'
import mayaIcon from '../../assets/png/asset-maya.png'
import tgtIcon from '../../assets/png/asset-tgt.png'
import usdpIcon from '../../assets/png/asset-usdp.png'
import uskIcon from '../../assets/png/asset-usk.png'
import { ReactComponent as CurrencyIcon } from '../../assets/svg/currency-icon.svg'
import { ReactComponent as AttentionIcon } from '../../assets/svg/icon-attention.svg'
import { ReactComponent as DownIcon } from '../../assets/svg/icon-down.svg'
import { ReactComponent as EyeHideIcon } from '../../assets/svg/icon-eye-hide.svg'
import { ReactComponent as EyeIcon } from '../../assets/svg/icon-eye.svg'
import { ReactComponent as LoadingIcon } from '../../assets/svg/icon-loading.svg'
import { ReactComponent as LockIcon } from '../../assets/svg/icon-lock-warning.svg'
import { ReactComponent as UnlockIcon } from '../../assets/svg/icon-unlock-warning.svg'
import { ReactComponent as LedgerIcon } from '../../assets/svg/ledger.svg'

export {
  arbIcon,
  atomIcon,
  cacaoIcon,
  avaxIcon,
  bscIcon,
  btcIcon,
  dogeIcon,
  ethIcon,
  runeIcon,
  xRuneIcon,
  tgtIcon,
  CurrencyIcon,
  DownIcon,
  LedgerIcon,
  LoadingIcon,
  AttentionIcon,
  EyeIcon,
  EyeHideIcon,
  LockIcon,
  mayaIcon,
  UnlockIcon,
  usdpIcon,
  dashIcon,
  kujiIcon,
  uskIcon,
  mayaIconT,
  xrdIcon
}
