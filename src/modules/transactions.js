/* global hive_keychain */
/* eslint-disable no-use-before-define */
import hive from '@hiveio/hive-js';

import utils from '../utils';
import splinterlandsUtils from '../splinterlands_utils';
import api, { battle_api_post } from './api';
import log_event from './log_event';
import configModule from './config';
import playerModule from './player';
import settingsModule from './settings';
import useKeychainModule from './use_keychain';
import Transaction from '../classes/transaction';

const transactions = (function () {
  const _transactions = {};

  function check_tx(sm_id, timeout) {
    return new Promise((resolve) => {
      _transactions[sm_id] = { resolve };

      _transactions[sm_id].timeout = setTimeout(() => {
        if (_transactions[sm_id] && _transactions[sm_id].status != 'complete') {
          resolve({
            success: false,
            error: 'Your transaction could not be found. This may be an issue with the game server. Please try refreshing the site to see if the transaction went through.',
          });
        }

        delete _transactions[sm_id];
      }, (timeout || 30) * 1000);
    });
  }

  function clear_pending_tx(sm_id) {
    const tx = _transactions[sm_id];

    if (tx) {
      clearTimeout(tx.timeout);
      delete _transactions[sm_id];
    }
  }

  async function send_tx_old(id, display_name, data, retries) {
    if (!retries) {
      retries = 0;
    }

    const player = playerModule.get_player();
    const settings = settingsModule.get_settings();
    const active_auth = player.require_active_auth && settings.active_auth_ops.includes(id);
    id = splinterlandsUtils.format_tx_id(id);

    try {
      data = splinterlandsUtils.format_tx_data(data);
    } catch (err) {
      log_event('tx_length_exceeded', { type: id });
      return { success: false, error: err.toString() };
    }

    const data_str = JSON.stringify(data);

    // Start waiting for the transaction to be picked up by the server immediately
    const check_tx_promise = check_tx(data.sm_id);

    let broadcast_promise = null;

    const config = configModule.get_config();
    if (player.use_proxy) {
      broadcast_promise = new Promise((resolve) => {
        utils
          .post(`${config.tx_broadcast_url}/proxy`, { player: player.name, access_token: player.token, id, json: data })
          .then((r) => resolve({ type: 'broadcast', method: 'proxy', success: true, trx_id: r.id }))
          .catch((err) => resolve({ type: 'broadcast', method: 'proxy', success: true, error: err }));
      });
    } else if (useKeychainModule.get_use_keychain()) {
      broadcast_promise = new Promise((resolve) =>
        // eslint-disable-next-line no-promise-executor-return
        hive_keychain.requestCustomJson(player.name, id, active_auth ? 'Active' : 'Posting', data_str, display_name, (response) => {
          resolve({
            type: 'broadcast',
            method: 'keychain',
            success: response.success,
            trx_id: response.success ? response.result.id : null,
            error: response.success ? null : typeof response.error === 'string' ? response.error : JSON.stringify(response.error),
          });
        }),
      );
    } else if (active_auth) {
      splinterlandsUtils.sc_custom_json(id, 'Splinterlands Transaction', data, true);
      // eslint-disable-next-line no-promise-executor-return
      broadcast_promise = new Promise((resolve) => resolve({ type: 'broadcast', success: true, method: 'steem_connect' }));
    } else {
      broadcast_promise = new Promise((resolve) =>
        // eslint-disable-next-line no-promise-executor-return
        hive.broadcast.customJson(localStorage.getItem('splinterlands:key'), [], [player.name], id, data_str, (err, response) => {
          resolve({
            type: 'broadcast',
            method: 'steem_js',
            success: response && response.id,
            trx_id: response && response.id ? response.id : null,
            error: err ? JSON.stringify(err) : null,
          });
        }),
      );
    }

    const result = await Promise.race([check_tx_promise, broadcast_promise]);

    // Check if the transaction was broadcast and picked up by the server before we got the result from the broadcast back
    if (result.type != 'broadcast') {
      return result;
    }

    if (result.success) {
      // Wait for the transaction to be picked up by the server
      return await check_tx_promise;
    }
    clear_pending_tx(data.sm_id);

    if (result.error == 'user_cancel') {
      return result;
    }
    if (result.error.indexOf('Please wait to transact') >= 0) {
      // The account is out of Resource Credits, request an SP delegation
      const delegation_result = await api('/players/delegation');

      if (delegation_result && delegation_result.success) {
        // If the delegation succeeded, retry the transaction after 3 seconds
        await utils.timeout(3000);
        return await send_tx(id, display_name, data, retries + 1);
      }
      log_event('delegation_request_failed', { operation: id, error: result.error });
      return `Oops, it looks like you don't have enough Resource Credits to transact on the Steem blockchain. Please contact us on Discord for help! Error: ${result.error}`;
    }
    if (retries < 2) {
      // Try switching to another RPC node
      splinterlandsUtils.switch_rpc();

      // Retry the transaction after 3 seconds
      await utils.timeout(3000);
      return await send_tx(id, display_name, data, retries + 1);
    }
    log_event('custom_json_failed', { response: JSON.stringify(result) });
    return result;
  }

  function prepare_tx(tx) {
    const settings = settingsModule.get_settings();
    return {
      // eslint-disable-next-line no-bitwise
      ref_block_num: settings.chain_props.ref_block_num & 0xffff,
      ref_block_prefix: settings.chain_props.ref_block_prefix,
      expiration: new Date(new Date(`${settings.chain_props.time}Z`).getTime() + 600 * 1000),
      ...tx,
    };
  }

  async function sign_tx(tx, use_active) {
    // eslint-disable-next-line
    return new Promise(async (resolve, reject) => {
      try {
        if (!tx.expiration) {
          tx = prepare_tx(tx);
        }

        let signed_tx = null;

        if (useKeychainModule.get_use_keychain()) {
          // eslint-disable-next-line
          const response = await new Promise((resolve) => hive_keychain.requestSignTx(_player.name, tx, use_active ? 'Active' : 'Posting', resolve));

          if (response && response.success) {
            signed_tx = response.result;
          } else {
            // eslint-disable-next-line no-promise-executor-return
            return reject(response);
          }
        } else {
          const key = localStorage.getItem('splinterlands:key');

          if (!key) {
            // eslint-disable-next-line
            return reject({ error: 'Key not found.' });
          }

          signed_tx = hive.auth.signTransaction(tx, [key]);
        }

        // eslint-disable-next-line prefer-destructuring
        signed_tx.expiration = signed_tx.expiration.split('.')[0];
        resolve(signed_tx);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function server_broadcast_tx(tx, use_active) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const signed_tx = await sign_tx(tx, use_active);

        if (!signed_tx) {
          return;
        }

        const settings = settingsModule.get_settings();
        const op_name = tx.operations[0][1].id.replace(settings.test_mode ? `${settings.prefix}sm_` : 'sm_', '');

        if (settings.api_ops.includes(op_name)) {
          battle_api_post(`/battle/battle_tx`, { signed_tx: JSON.stringify(signed_tx) })
            .then(resolve)
            .catch(reject);
          return;
        }

        // TODO: Get broadcast API stuff working
        // let bcast_url = Config.tx_broadcast_urls[Math.floor(Math.random() * Config.tx_broadcast_urls.length)];
        // api_post(`${bcast_url}/send`, { signed_tx: JSON.stringify(signed_tx) }, resolve).fail(reject);
        resolve({ error: `Unsupported server broadcast operation.` });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function send_tx(id, display_name, data) {
    // Only use this method for battle API transactions for now
    const settings = settingsModule.get_settings();
    if (!settings.api_ops.includes(id)) {
      return await send_tx_old(id, display_name, data);
    }

    const player = playerModule.get_player();
    const active_auth = player.require_active_auth && settings.active_auth_ops.includes(id);
    id = splinterlandsUtils.format_tx_id(id);

    try {
      data = splinterlandsUtils.format_tx_data(data);
    } catch (err) {
      log_event('tx_length_exceeded', { type: id });
      return { success: false, error: err.toString() };
    }

    const data_str = JSON.stringify(data);

    const tx = {
      operations: [
        [
          'custom_json',
          {
            required_auths: active_auth ? [player.name] : [],
            required_posting_auths: active_auth ? [] : [player.name],
            id,
            json: data_str,
          },
        ],
      ],
    };

    try {
      // Start waiting for the transaction to be picked up by the server immediately
      const check_tx_promise = check_tx(data.sm_id);
      let broadcast_promise = null;

      if (player.use_proxy) {
        // do nothing
      } else {
        broadcast_promise = server_broadcast_tx(tx, active_auth).then((response) => {
          return {
            type: 'broadcast',
            method: 'battle_api',
            success: response && response.id,
            trx_id: response && response.id ? response.id : null,
            error: response.error ? response.error : null,
          };
        });
      }

      const result = await Promise.race([check_tx_promise, broadcast_promise]);

      // Check if the transaction was broadcast and picked up by the server before we got the result from the broadcast back
      if (result.type != 'broadcast') {
        return result;
      }

      if (result.success) {
        // Wait for the transaction to be picked up by the server
        return await check_tx_promise;
      }
      clear_pending_tx(data.sm_id);
      return await send_tx_old(id, display_name, data);
    } catch (err) {
      console.log(err);
      return await send_tx_old(id, display_name, data);
    }
  }

  async function send_tx_wrapper(id, display_name, data, on_success) {
    return new Promise((resolve, reject) => {
      send_tx(id, display_name, data).then(async (result) => {
        // If there is any type of error, just return the result object
        if (!result || !result.trx_info || !result.trx_info.success || result.error) {
          reject(result);
        } else {
          try {
            resolve(await on_success(new Transaction(result.trx_info)));
          } catch (err) {
            reject(err);
          }
        }
      });
    });
  }

  return {
    get_transaction: (sm_id) => _transactions[sm_id],
    check_tx,
    clear_pending_tx,
    send_tx,
    send_tx_wrapper,
  };
})();

export default transactions;
