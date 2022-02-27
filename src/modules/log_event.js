import api from './api';
import browserIdModule from './browser_id';
import sessionIdModule from './session_id';
import urlModule from './url';

async function log_event(event_name, data) {
  const params = {
    browser_id: browserIdModule.get_browser_id(),
    session_id: sessionIdModule.get_session_id(),
    event_name,
    page: '',
    user_agent: window.navigator.userAgent,
    browser_language: window.navigator.language,
    site_language: localStorage.getItem('splinterlands:locale'),
    url: urlModule.get_url(),
    ref: localStorage.getItem('splinterlands:ref'),
  };

  if (data) {
    params.data = JSON.stringify(data);
  }

  return await api('/players/event', params);
}

export default log_event;
