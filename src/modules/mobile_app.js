const mobile_app = (function () {
  let _is_mobile_app = false;
  let _mobile_OS_ver;
  let _mobile_OS;
  let _is_android;

  function startWrappedApp(isAndroid, version) {
    _is_android = isAndroid == null || !!isAndroid;
    _is_mobile_app = true;
    _mobile_OS_ver = version;

    if (isAndroid == null || isAndroid) {
      _mobile_OS = 'android';
    } else {
      _mobile_OS = 'iOS';
    }

    window.splinterlands.is_android = _is_android;
    window.splinterlands.is_mobile_app = _is_mobile_app;
    window.splinterlands.mobile_OS_ver = _mobile_OS_ver;
    window.splinterlands.mobile_OS = _mobile_OS;

    return true;
  }

  function showLoadingAnimation(showLoader, text) {
    text = text ? text.replaceAll('<br>', '\n') : '';
    window.dispatchEvent(new CustomEvent('splinterlands:show_loading_animation', { detail: { showLoader, text } }));
  }

  return {
    startWrappedApp,
    showLoadingAnimation,
    get_mobile_settings: () => ({
      is_mobile_app: _is_mobile_app,
      mobile_OS_ver: _mobile_OS_ver,
      mobile_OS: _mobile_OS,
      is_android: _is_android,
    }),
  };
})();

export default mobile_app;
