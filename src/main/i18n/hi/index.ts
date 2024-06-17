import { EditMenuMessages, HelpMenuMessages, ViewMenuMessages, AppMenuMessages } from '../types'

const appMenu: AppMenuMessages = {
  'menu.app.about': '{name} के बारे में',
  'menu.app.hideApp': '{name} को छिपाएं',
  'menu.app.hideOthers': 'अन्य को छिपाएं',
  'menu.app.unhide': 'सभी दिखाएं',
  'menu.app.quit': '{name} से बाहर निकलें'
}

const editMenu: EditMenuMessages = {
  'menu.edit.title': 'संपादित करें',
  'menu.edit.undo': 'पूर्ववत करें',
  'menu.edit.redo': 'फिर से करें',
  'menu.edit.cut': 'काटें',
  'menu.edit.copy': 'कॉपी करें',
  'menu.edit.paste': 'पेस्ट करें',
  'menu.edit.selectAll': 'सभी का चयन करें'
}

const helpMenu: HelpMenuMessages = {
  'menu.help.title': 'मदद',
  'menu.help.learn': 'और जानें…',
  'menu.help.docs': 'दस्तावेज़ीकरण',
  'menu.help.discord': 'डिस्कॉर्ड',
  'menu.help.issues': 'समस्याएं रिपोर्ट करें',
  'menu.help.license': 'लाइसेंस'
}

const viewMenu: ViewMenuMessages = {
  'menu.view.title': 'दृश्य',
  'menu.view.reload': 'पुनः लोड करें',
  'menu.view.toggleFullscreen': 'पूर्ण स्क्रीन टॉगल करें',
  'menu.view.toggleDevTools': 'डेव टूल्स टॉगल करें'
}

export default { ...appMenu, ...editMenu, ...viewMenu, ...helpMenu }
