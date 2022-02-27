import CardDetails from '../classes/card_details';
import api from './api';

const cards = (function () {
  let _cards = [];

  function get_card_details(cardDetailId) {
    return cardDetailId ? _cards.find((c) => c.id == cardDetailId) : _cards;
  }

  async function load_card_details() {
    _cards = (await api('/cards/get_details')).map((c) => new CardDetails(c));
  }

  return {
    load_card_details,
    get_card_details,
    get_cards: () => _cards,
  };
})();

export default cards;
