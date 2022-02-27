import api, { ec_api } from '../modules/api';
import playerModule from '../modules/player';
import ops from '../ops';
import MarketCard from './market_card';
import MarketCardGrouped from './market_card_grouped';

class Market {
  static async for_sale_by_card(card_detail_id, is_gold, edition) {
    const market_cards = await api('/market/for_sale_by_card', { card_detail_id, gold: is_gold, edition });
    return market_cards.map((c) => new MarketCard(c));
  }

  static async for_sale_grouped() {
    const market_cards_grouped = await api('/market/for_sale_grouped');
    return market_cards_grouped.map((c) => new MarketCardGrouped(c));
  }

  static async purchase(market_ids, price, currency) {
    const womplay_id = await playerModule.get_player().get_womplay_id();
    if (womplay_id) {
      await ec_api('/womplay/tracking', { womplay_id, event_name: 'purchased_card_on_market' });
    }

    const tx = await ops.market_purchase(market_ids, price, currency);
    return tx;
  }

  static async volume_24H() {
    return await api('/market/volume');
  }
}

export default Market;
