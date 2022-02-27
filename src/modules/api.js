import utils from '../utils';
import authInfoModule from './auth_info';
import configModule from './config';

function api(url, data) {
  return new Promise((resolve, reject) => {
    if (data == null || data == undefined) {
      data = {};
    }

    // Add a dummy timestamp parameter to prevent IE from caching the requests.
    data.v = new Date().getTime();

    const authInfo = authInfoModule.get_auth_info();
    if (authInfo) {
      data.token = authInfo.token;
      data.username = authInfo.name;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${configModule.get_config().api_url + url}?${utils.param(data)}`);
    if (authInfo) {
      xhr.setRequestHeader('Authorization', `Bearer ${authInfo ? authInfo.jwt_token : null}`); // need to call after xhr.open
    }
    xhr.onload = function () {
      if (xhr.status === 200) {
        resolve(utils.try_parse(xhr.responseText));
      } else {
        console.log(`Request failed (${url}).  Returned status of ${xhr.status}`);
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`Request failed (${url}).  Returned status of ${xhr.status}`);
      }
    };
    xhr.send();
  });
}

export function ec_api(url, data) {
  return new Promise((resolve, reject) => {
    if (data == null || data == undefined) {
      data = {};
    }

    // Add a dummy timestamp parameter to prevent IE from caching the requests.
    data.v = new Date().getTime();

    const authInfo = authInfoModule.get_auth_info();
    if (authInfo) {
      data.token = authInfo.token;
      data.username = authInfo.name;
    }

    const xhr = new XMLHttpRequest();
    const config = configModule.get_config();
    xhr.open('GET', `${config.ec_api_url + url}?${utils.param(data)}`);
    xhr.onload = function () {
      if (xhr.status === 200) {
        resolve(utils.try_parse(xhr.responseText));
      } else {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`Request failed.  Returned status of ${xhr.status}`);
      }
    };
    xhr.send();
  });
}

export async function api_post(url, data) {
  if (data == null || data == undefined) {
    data = {};
  }

  data.v = new Date().getTime();

  const authInfo = authInfoModule.get_auth_info();
  if (authInfo) {
    data.token = authInfo.token;
    data.username = authInfo.name;
  }

  const config = configModule.get_config();
  const response = await fetch(config.api_url + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: utils.param(data),
  });

  if (response.ok) {
    return response.json();
  }
  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject(`Request failed.  Returned status of ${response.status}: ${response.statusText}`);
}

export async function battle_api_post(url, data) {
  if (data == null || data == undefined) {
    data = {};
  }

  data.v = new Date().getTime();

  const authInfo = authInfoModule.get_auth_info();
  if (authInfo) {
    data.token = authInfo.token;
    data.username = authInfo.name;
  }

  const config = configModule.get_config();
  const response = await fetch(config.battle_api_url + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: utils.param(data),
  });

  if (response.ok) {
    return response.json();
  }
  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject(`Request failed.  Returned status of ${response.status}: ${response.statusText}`);
}

export default api;
