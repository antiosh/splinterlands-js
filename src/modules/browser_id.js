import utils from '../utils';

const browser = (function () {
  let _browser_id = null;

  function set_browser_id(browserId) {
    localStorage.setItem('splinterlands:browser_id', browserId);
    _browser_id = browserId;
  }

  function initiate_browser_id() {
    let browserId = localStorage.getItem('splinterlands:browser_id');
    if (!browserId) {
      browserId = `mbid_${utils.randomStr(20)}`;
    }
    set_browser_id(browserId);
  }

  function get_browser_id() {
    if (_browser_id) {
      return _browser_id;
    }

    initiate_browser_id();
    return _browser_id;
  }

  return {
    initiate_browser_id,
    get_browser_id,
  };
})();

export default browser;
