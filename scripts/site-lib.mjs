export function validatePluginDeepLink(html, entry) {
  const deepLink = `deeprunner://market/plugin/${entry.id}`
  if (entry.status === 'paused') {
    if (html.includes(deepLink)) throw new Error(`paused plugin page ${entry.id} must not expose an install deep link`)
    return
  }
  if (!html.includes(deepLink)) throw new Error(`plugin page ${entry.id} has no safe deep link`)
}
