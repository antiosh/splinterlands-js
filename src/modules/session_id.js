import utils from '../utils';

const sesstionId = (function () {
  let _session_id = null;

  function set_session_id(sessionId) {
    _session_id = sessionId;
  }

  function initiate_session_id() {
    const sessionId = `msid_${utils.randomStr(20)}`;
    set_session_id(sessionId);
  }

  function get_session_id() {
    if (_session_id) {
      return _session_id;
    }

    initiate_session_id();
    return _session_id;
  }

  return {
    initiate_session_id,
    get_session_id,
  };
})();

export default sesstionId;
