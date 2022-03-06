import api from './api';

// eslint-disable-next-line import/prefer-default-export
export async function getMarketForSale() {
  const marketForSale = await api('/market/for_sale_grouped');
  return marketForSale;
}
