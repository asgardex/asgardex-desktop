import { Locale } from '../../shared/i18n/types'
import de from './de'
import en from './en'
import fr from './fr'
import hi from './hi'
import ru from './ru'
import { Messages } from './types'

export const LOCALES = [Locale.EN, Locale.DE, Locale.FR, Locale.RU, Locale.HI]

export const getLocaleFromString = (s: string): Locale => {
  switch (s) {
    case 'en':
      return Locale.EN
    case 'de':
      return Locale.DE
    case 'fr':
      return Locale.FR
    case 'ru':
      return Locale.RU
    case 'hi':
      return Locale.HI
    default:
      return Locale.EN
  }
}

export const getMessagesByLocale = (l: Locale): Messages => {
  switch (l) {
    case Locale.EN:
      return en
    case Locale.DE:
      return de
    case Locale.FR:
      return fr
    case Locale.RU:
      return ru
    case Locale.HI:
      return hi
    default:
      return en
  }
}
