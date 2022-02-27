import utils from '../utils';

const splinterlandsUrl = (function () {
  let _url = null;

  function set_url(url) {
    _url = url;
    localStorage.setItem('splinterlands:ref', utils.getURLParameter(url, 'ref'));
  }

  function get_url() {
    return _url;
  }

  return {
    set_url,
    get_url,
  };
})();

export default splinterlandsUrl;
