const list = document.querySelector('[data-market-list]')
if (list) {
  const cards = [...list.querySelectorAll('[data-plugin-card]')]
  const search = document.querySelector('[data-search]')
  const trust = document.querySelector('[data-trust]')
  const filter = () => {
    const needle = search.value.trim().toLocaleLowerCase()
    const level = trust.value
    let visible = 0
    for (const card of cards) {
      const match = (level === 'all' || card.dataset.level === level) && card.dataset.search.includes(needle)
      card.hidden = !match
      if (match) visible += 1
    }
    document.querySelector('[data-empty]').hidden = visible !== 0
  }
  search.addEventListener('input', filter)
  trust.addEventListener('change', filter)
}

const copy = document.querySelector('[data-copy-link]')
if (copy) copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(copy.dataset.copyLink)
  const original = copy.textContent
  copy.textContent = '已复制'
  setTimeout(() => { copy.textContent = original }, 1400)
})
