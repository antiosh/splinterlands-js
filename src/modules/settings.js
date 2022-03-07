import api from './api';

const settings = (function () {
  let _settings = {
    leagues: [],
    quests: [],
  };

  async function load_settings() {
    const response = await api('/settings');

    if (_settings.version && _settings.version != response.version) {
      // Dispatch new version event
      window.dispatchEvent(new CustomEvent('splinterlands:version_change', { detail: response.version }));
    }

    if (_settings.maintenance_mode !== undefined && _settings.maintenance_mode != response.maintenance_mode) {
      // Dispatch maintenance mode event
      window.dispatchEvent(new CustomEvent('splinterlands:maintenance_mode', { detail: { maintenance_mode: response.maintenance_mode } }));
    }

    _settings = response;
  }

  async function initiate_settings() {
    await load_settings();
    setInterval(load_settings, 60 * 1000);
  }

  return {
    initiate_settings,
    get_settings: () => _settings,
  };
})();

export default settings;
