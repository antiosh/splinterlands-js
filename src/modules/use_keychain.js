const useKeychain = (function () {
  let _use_keychain = false;

  function set_use_keychain(use) {
    _use_keychain = use;
  }

  return {
    set_use_keychain,
    get_use_keychain: () => _use_keychain,
  };
})();

export default useKeychain;
