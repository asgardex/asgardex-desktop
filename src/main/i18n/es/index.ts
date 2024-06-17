import { EditMenuMessages, HelpMenuMessages, ViewMenuMessages, AppMenuMessages } from '../types'

const appMenu: AppMenuMessages = {
  'menu.app.about': 'Acerca de {name}',
  'menu.app.hideApp': 'Ocultar {name}',
  'menu.app.hideOthers': 'Ocultar a otros',
  'menu.app.unhide': 'Mostrar todo',
  'menu.app.quit': 'Deje de {name}'
}

const editMenu: EditMenuMessages = {
  'menu.edit.title': 'Editar',
  'menu.edit.undo': 'Deshacer',
  'menu.edit.redo': 'Rehacer',
  'menu.edit.cut': 'Corte',
  'menu.edit.copy': 'Copia',
  'menu.edit.paste': 'Pegar',
  'menu.edit.selectAll': 'Seleccionar todo'
}

const helpMenu: HelpMenuMessages = {
  'menu.help.title': 'Ayuda',
  'menu.help.learn': 'Más información…',
  'menu.help.docs': 'Documentación',
  'menu.help.discord': 'Discordia',
  'menu.help.issues': 'Informar de los problemas',
  'menu.help.license': 'Licencia'
}

const viewMenu: ViewMenuMessages = {
  'menu.view.title': 'Ver',
  'menu.view.reload': 'Recarga',
  'menu.view.toggleFullscreen': 'Pantalla completa',
  'menu.view.toggleDevTools': 'Herramientas de desarrollo'
}

export default { ...appMenu, ...editMenu, ...viewMenu, ...helpMenu }
