import api from './api';

export async function getCards() {
  const cardList = await api('/cards/get_details');
  return cardList;
}

function getSplinterMapping(splinterColor) {
  return {
    Red: 'Fire',
    Blue: 'Water',
    Green: 'Earth',
    White: 'Life',
    Black: 'Death',
    Gold: 'Dragon',
    Gray: 'Neutral',
  }[splinterColor];
}

function mapCardDetails(card) {
  return {
    ...card,
    splinter: getSplinterMapping(card.color),
    // TODO: map other items from CardDetails class
  };
}

export async function getCardDetails(cardDetailId) {
  const cardDetails = await getCards();
  const mappedCardDetails = cardDetails.map(mapCardDetails);
  if (cardDetailId) {
    return mappedCardDetails.find((c) => c.id == cardDetailId);
  }
  return mappedCardDetails;
}
