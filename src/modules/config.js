const config = (function () {
  let _config = {};

  function set_config(splinterlandsConfig) {
    _config = splinterlandsConfig;
  }

  function update_config(splinterlandsConfig) {
    _config = {
      ..._config,
      ...splinterlandsConfig,
    };
  }

  return {
    set_config,
    update_config,
    get_config: () => _config,
  };
})();

export default config;
