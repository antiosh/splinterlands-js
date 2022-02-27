import api from './api';

const cardLore = (function () {
  const _lore = {};

  async function load_card_lore(card_detail_id) {
    if (!_lore[card_detail_id]) {
      _lore[card_detail_id] = await api('/cards/lore', { card_detail_id });
    }

    return _lore[card_detail_id];
  }

  return {
    load_card_lore,
  };
})();

export default cardLore;
