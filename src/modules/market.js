const market = (function () {
  let _market = [];

  function set_market(marketData) {
    _market = marketData;
  }

  return {
    set_market,
    get_market: () => _market,
  };
})();

export default market;
