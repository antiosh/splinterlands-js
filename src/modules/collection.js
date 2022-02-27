import CardDetails from '../classes/card_details';
import Card from '../classes/card';
import api from './api';
import cardsModule from './cards';
import playerModule from './player';

const collection = (function () {
  let _collection = [];
  let _collection_grouped = null;

  function clear_collection() {
    _collection = null;
  }

  async function load_collection(player) {
    const currentPlayer = playerModule.get_player();
    if (player && currentPlayer && player !== currentPlayer.name) {
      // If getting collection of another player
      console.log('Updating Collection: ', player);
      _collection = (await api(`/cards/collection/${player}`)).cards.map((c) => new Card(c));
      _collection_grouped = null;
    } else if (currentPlayer.has_collection_power_changed) {
      console.log('Updating Collection current player');
      if (!player && currentPlayer) {
        player = currentPlayer.name;
      }

      _collection = (await api(`/cards/collection/${player}`)).cards.map((c) => new Card(c));
      _collection_grouped = null;

      // If this is the current player's collection, add any "starter" cards
      cardsModule
        .get_card_details()
        .filter((d) => d.is_starter_card && !_collection.find((c) => c.card_detail_id == d.id))
        .forEach((c) => _collection.push(Card.get_starter_card(c.id, c.starter_edition)));

      currentPlayer.has_collection_power_changed = false;
    }

    // Filter out Gladiator cards for now.
    _collection = _collection.filter((c) => c.edition != 6);

    return _collection;
  }

  function group_collection(cardCollection, id_only) {
    if (!cardCollection && _collection_grouped && !id_only) {
      return _collection_grouped;
    }

    const save = !cardCollection && !id_only;

    if (!cardCollection) {
      cardCollection = _collection;
    }

    const grouped = [];

    // Group the cards in the collection by card_detail_id, edition, and gold foil
    cardsModule.get_cards().forEach((details) => {
      if (id_only) {
        grouped.push(new CardDetails({ card_detail_id: details.id, owned: cardCollection.filter((o) => o.card_detail_id == details.id), ...details }));
      } else {
        details.available_editions.forEach((edition) => {
          const reg_cards = cardCollection.filter((o) => o.card_detail_id == details.id && o.gold == false && o.edition == parseInt(edition));

          if (reg_cards.length > 0) {
            grouped.push(new Card({ owned: reg_cards, ...reg_cards[0] }));
          } else {
            grouped.push(
              new Card({
                gold: false,
                card_detail_id: details.id,
                edition: parseInt(edition),
                owned: reg_cards,
              }),
            );
          }

          const gold_cards = cardCollection.filter((o) => o.card_detail_id == details.id && o.gold == true && o.edition == parseInt(edition));

          if (gold_cards.length > 0) {
            grouped.push(new Card({ owned: gold_cards, ...gold_cards[0] }));
          } else {
            grouped.push(
              new Card({
                gold: true,
                card_detail_id: details.id,
                edition: parseInt(edition),
                owned: gold_cards,
              }),
            );
          }
        });
      }
    });

    if (save) {
      _collection_grouped = grouped;
    }

    return grouped;
  }

  return {
    load_collection,
    clear_collection,
    group_collection,
    get_collection: () => _collection,
    get_collection_grouped: () => _collection_grouped,
  };
})();

export default collection;
