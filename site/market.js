const market = document.querySelector('[data-market-list]')

if (market) {
  const cards = [...market.querySelectorAll('[data-plugin-card]')]
  const search = document.querySelector('[data-search]')
  const clear = document.querySelector('[data-search-clear]')
  const shortcut = document.querySelector('[data-search-shortcut]')
  const empty = document.querySelector('[data-empty]')
  const count = document.querySelector('[data-result-count]')

  const filter = () => {
    const needle = search.value.trim().toLocaleLowerCase()
    const visibleCards = cards.filter(card => {
      const matches = card.dataset.search.includes(needle)
      card.hidden = !matches
      return matches
    })

    count.textContent = `${visibleCards.length} ${visibleCards.length === 1 ? 'plugin' : 'plugins'}`
    empty.hidden = visibleCards.length !== 0
    market.hidden = visibleCards.length === 0
    clear.hidden = needle.length === 0
    shortcut.hidden = needle.length !== 0
  }

  search.addEventListener('input', filter)
  clear.addEventListener('click', () => {
    search.value = ''
    search.focus()
    filter()
  })
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault()
      search.focus()
      search.select()
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = ''
      search.blur()
      filter()
    }
  })
  filter()
}
