import { createIntlCache } from 'react-intl'

import { Locale } from '../../shared/i18n/types'
import de from './de'
import en from './en'
import fr from './fr'
import hi from './hi'
import ru from './ru'
import es from './es'
import { Messages } from './types'

export const getMessagesByLocale = (l: Locale): Messages => {
  switch (l) {
    case Locale.DE:
      return de
    case Locale.EN:
      return en
    case Locale.FR:
      return fr
    case Locale.HI:
      return hi
    case Locale.RU:
      return ru
    case Locale.ES:
      return es
    default:
      return en
  }
}

export const cache = createIntlCache()
