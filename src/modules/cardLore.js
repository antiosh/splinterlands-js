import api from './api';

// eslint-disable-next-line import/prefer-default-export
export async function getCardLore(cardDetailId) {
  const lore = await api('/cards/lore', { cardDetailId });
  return lore;
}
