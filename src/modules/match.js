import Match from '../classes/match';

const match = (function () {
  let _match = null;

  function set_match(match_data) {
    if (!match_data) {
      _match = null;
      return;
    }

    _match = _match ? _match.update(match_data) : new Match(match_data);
    // eslint-disable-next-line consistent-return
    return _match;
  }

  function wait_for_match() {
    return new Promise((resolve, reject) => {
      if (!_match) {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({ error: 'Player is not currently looking for a match.', code: 'not_looking_for_match' });
        return;
      }

      // Player has already been matched with an opponent
      if (_match.status == 1) {
        resolve(_match);
        return;
      }

      _match.on_match = resolve;
      _match.on_timeout = reject;
    });
  }

  function wait_for_result() {
    return new Promise((resolve, reject) => {
      if (!_match) {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({ error: 'Player is not currently in a match.', code: 'not_in_match' });
        return;
      }

      // The battle is already resolved
      if (_match.status == 2) {
        resolve(_match);
        return;
      }

      _match.on_result = resolve;
      _match.on_timeout = reject;
    });
  }

  return {
    get_match: () => _match,
    set_match,
    wait_for_match,
    wait_for_result,
  };
})();

export default match;
