const utils = (function () {
  function try_parse(json) {
    try {
      return typeof json === 'string' ? JSON.parse(json) : json;
    } catch (err) {
      console.log(`Error trying to parse JSON: ${json}`);
      return null;
    }
  }

  function param(object) {
    let encodedString = '';
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in object) {
      // eslint-disable-next-line no-prototype-builtins
      if (object.hasOwnProperty(prop)) {
        if (encodedString.length > 0) {
          encodedString += '&';
        }
        encodedString += `${prop}=${encodeURIComponent(object[prop])}`;
      }
    }
    return encodedString;
  }

  function randomStr(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let retVal = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }

  function loadScript(url, callback) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    if (script.readyState) {
      // IE
      script.onreadystatechange = function () {
        if (script.readyState === 'loaded' || script.readyState === 'complete') {
          script.onreadystatechange = null;
          callback();
        }
      };
    } else if (callback) {
      // Others
      script.onload = function () {
        callback();
      };
    }

    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
  }

  async function loadScriptAsync(url) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => loadScript(url, resolve));
  }

  function timeout(ms) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getURLParameter(url, name) {
    const index = url.indexOf('?');

    if (index < 0) {
      return null;
    }

    // eslint-disable-next-line
    return decodeURIComponent((new RegExp(`[?|&]${name}=` + `([^&;]+?)(&|#|;|$)`).exec(url.substring(index)) || [, ''])[1].replace(/\+/g, '%20')) || null;
  }

  return {
    try_parse,
    param,
    randomStr,
    loadScript,
    loadScriptAsync,
    timeout,
    getURLParameter,
  };
})();

export default utils;
