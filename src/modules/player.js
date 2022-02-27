import Player from '../classes/player';
import authInfo from './auth_info';

const player = (function () {
  let _player = null;

  function initiatiate_player(loginResponse) {
    _player = new Player(loginResponse);
    authInfo.initiatiate_auth_info(loginResponse);
  }

  function clear_player() {
    _player = null;
    authInfo.clear_auth_info();
  }

  return {
    initiatiate_player,
    clear_player,
    get_player: () => _player,
  };
})();

export default player;
