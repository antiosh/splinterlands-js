/* global twttr, snapyr */

import utils from './utils';
import splinterlandsUtils from './splinterlands_utils';
import playerModule from './modules/player';
import matchModule from './modules/match';
import transactionsModule from './modules/transactions';
import { ec_api } from './modules/api';
import Battle from './classes/battle';
import Player from './classes/player';
import Quest from './classes/quest';

const socket = (function () {
  let _url = null;
  let _ws = null;
  let _ping_interval = null;
  let _session_id = null;
  let _connected = false;
  let _message_handlers;

  function on_error(e) {
    console.log('Socket error...');
    console.log(e);
  }

  function send(message) {
    _ws.send(JSON.stringify(message));
  }

  function ping() {
    send({ type: 'ping' });
  }

  function on_close(e) {
    console.log('Socket closed...');
    console.log(e);

    if (_connected) {
      window.dispatchEvent(new CustomEvent('splinterlands:socket_disconnect', { detail: { e } }));
    }

    _connected = false;

    if (playerModule.get_player()) {
      // eslint-disable-next-line no-use-before-define
      setTimeout(() => connect(_url, playerModule.get_player().name, playerModule.get_player().token), 1000);
    }
  }

  function on_message(m) {
    console.log(m);

    const message = JSON.parse(m.data);

    if (message && message.server_time) {
      splinterlandsUtils.set_server_time_offset(Date.now() - message.server_time);
    }

    if (message.id && _message_handlers[message.id]) {
      _message_handlers[message.id](message.data);
    }

    // Send acknowledgement if one is requested
    if (message.ack) {
      send({ type: 'ack', msg_id: message.msg_id });
    }
  }

  function connect(url, player, token, new_account) {
    // Make sure we don't already have an open connection
    if (_ws && _ws.readyState == 1) {
      return;
    }

    if (!_session_id) {
      _session_id = utils.randomStr(10);
    }

    _url = url;
    _ws = new WebSocket(_url);
    console.log('Opening socket connection...');

    _ws.onopen = function () {
      _connected = true;
      window.dispatchEvent(new CustomEvent('splinterlands:socket_connect', { detail: { url, player, new_account } }));

      if (new_account) {
        send({ type: 'new_account', player, session_id: _session_id });
      } else {
        send({ type: 'auth', player, access_token: token, session_id: _session_id });
      }
    };

    _ws.onmessage = on_message;
    _ws.onerror = on_error;
    _ws.onclose = on_close;

    if (_ping_interval) {
      clearInterval(_ping_interval);
    }

    _ping_interval = setInterval(ping, 60 * 1000);
  }

  function close() {
    _ws.close();
  }

  _message_handlers = {
    transaction_complete(data) {
      const trx = transactionsModule.get_transaction(data.sm_id);

      if (trx) {
        clearTimeout(trx.timeout);
        trx.resolve(data);
      }
    },

    async purchase_complete(data) {
      const trx = transactionsModule.get_transaction(data.uid);

      if (trx) {
        clearTimeout(trx.timeout);
        trx.resolve(data);
      } else {
        if (data.type == 'starter_pack') {
          playerModule.get_player().starter_pack_purchase = true;

          utils.loadScript('https://platform.twitter.com/oct.js', () => {
            twttr.conversion.trackPid('o4d35', { tw_sale_amount: 10, tw_order_quantity: 1 });
          });

          const womplay_id = await playerModule.get_player().get_womplay_id();
          if (womplay_id) {
            await ec_api('/womplay/tracking', { womplay_id, event_name: 'purchased_spellbook' });
          }
        }

        if (data.type == 'booster_pack') {
          const womplay_id = await playerModule.get_player().get_womplay_id();
          if (womplay_id) {
            await ec_api('/womplay/tracking', { womplay_id, event_name: 'purchased_booster_pack' });
          }
        }

        // TODO: Send starter_purchase event here?
        snapyr.track('purchase_complete', {
          purchase_amount_usd: parseFloat(data.amount_usd),
          type: data.type,
        });

        window.dispatchEvent(new CustomEvent('splinterlands:purchase_complete', { detail: data }));
      }
    },

    match_found(data) {
      let match = matchModule.get_match();

      // (match.id == data.opponent) check is for challenges
      if (match && (match.id == data.id || match.id == data.opponent)) {
        match = matchModule.set_match(data);

        if (match.on_match) {
          match.on_match(match);
        }
      }
    },

    battle_cancelled(data) {
      const match = matchModule.get_match();

      if (match && match.id == data.id) {
        if (match.on_timeout) {
          match.on_timeout({ error: 'Neither player submitted a team in the allotted time so the match has been cancelled.', code: 'match_cancelled' });
        }

        matchModule.set_match(null);
      }
    },

    match_not_found(data) {
      const match = matchModule.get_match();

      if (match && match.id == data.id) {
        if (match.on_timeout) {
          match.on_timeout({ error: 'No suitable opponent could be found, please try again.', code: 'match_not_found' });
        }

        matchModule.set_match(null);
      }
    },

    async battle_result(data) {
      const match = matchModule.get_match();

      snapyr.track('battle_result', {
        match_type: data.match_type,
        winner: data.winner,
      });

      const player = playerModule.get_player();
      if (player.battles == 0) {
        const womplay_id = await player.get_womplay_id();
        if (womplay_id) {
          await ec_api('/womplay/tracking', { womplay_id, event_name: 'completed_first_battle' });
        }
      }

      if (match && match.id == data.id) {
        if (match.on_result) {
          match.on_result(await Battle.load(data.id));
        }

        matchModule.set_match(null);
      }
    },

    opponent_submit_team(data) {
      let match = matchModule.get_match();

      if (match && match.id == data.id) {
        match = matchModule.set_match(data);

        if (match.on_opponent_submit) {
          match.on_opponent_submit(match);
        }
      }
    },

    guild_chat(data) {
      if (data.player_info) {
        data.player = new Player(data.player_info);
        delete data.player_info;
      }

      window.dispatchEvent(new CustomEvent('splinterlands:chat_message', { detail: { type: 'guild', ...data } }));
    },

    guild_update(data) {
      window.dispatchEvent(new CustomEvent('splinterlands:guild_update', { detail: data }));
    },

    global_chat(data) {
      if (data.player_info) {
        data.player = new Player(data.player_info);
        delete data.player_info;
      }

      window.dispatchEvent(new CustomEvent('splinterlands:chat_message', { detail: { type: 'global', ...data } }));
    },

    balance_update(data) {
      const balance = playerModule.get_player().balances.find((b) => b.token == data.token);

      // Update the balance record for the current player
      if (balance) {
        balance.balance = parseFloat(data.balance_end);
      } else {
        playerModule.get_player().balances.push({ player: data.player, token: data.token, balance: parseFloat(data.balance_end) });
      }

      // Emit a balance_update event
      window.dispatchEvent(new CustomEvent('splinterlands:balance_update', { detail: data }));
    },

    rating_update(data) {
      playerModule.get_player().update_rating(data.new_rating, data.new_league);

      if (data.new_collection_power !== undefined && playerModule.get_player().collection_power != data.new_collection_power) {
        playerModule.get_player().collection_power = data.new_collection_power;
        playerModule.get_player().has_collection_power_changed = true;
      }

      // Emit a rating_update event
      window.dispatchEvent(new CustomEvent('splinterlands:rating_update', { detail: data }));
    },

    quest_progress(data) {
      playerModule.get_player().quest = new Quest(data);
      window.dispatchEvent(new CustomEvent('splinterlands:quest_progress', { detail: playerModule.get_player().quest }));
    },

    received_gifts(data) {
      window.dispatchEvent(new CustomEvent('splinterlands:received_gifts', { detail: data }));
    },

    system_message(data) {
      window.dispatchEvent(new CustomEvent('splinterlands:system_message', { detail: data }));
    },

    challenge(data) {
      data.data = JSON.parse(data.data);
      console.log('Challenge: ', data);

      window.dispatchEvent(new CustomEvent('splinterlands:challenge', { detail: data }));
    },

    challenge_declined(data) {
      console.log('challenge_declined: ', data);
      window.dispatchEvent(new CustomEvent('splinterlands:challenge_declined', { detail: data }));
    },
  };

  return { connect, close, send };
})();

export default socket;
