const authInfo = (function () {
  let _authInfo = null;

  function initiatiate_auth_info(loginResponse) {
    _authInfo = {
      token: loginResponse.token,
      name: loginResponse.name,
      jwt_token: loginResponse.jwt_token,
    };
  }

  function clear_auth_info() {
    _authInfo = null;
  }

  return {
    initiatiate_auth_info,
    clear_auth_info,
    get_auth_info: () => _authInfo,
  };
})();

export default authInfo;
