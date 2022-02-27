/* global snapyr, hive_keychain, twttr, steem_keychain, tronWeb */

import ecc from 'eosjs-ecc';
import Web3 from 'web3';
import hive from '@hiveio/hive-js';

import eos from './blockchain/eos';
import ethereum from './blockchain/ethereum';
import tron from './blockchain/tron';
import bsc from './blockchain/bsc';
import utils from './utils';
import splinterlandsUtils from './splinterlands_utils';
import ops from './ops';
import api, { ec_api, api_post } from './modules/api';
import log_event from './modules/log_event';
import mobileAppModule from './modules/mobile_app';
import configModule from './modules/config';
import playerModule from './modules/player';
import settingsModule from './modules/settings';
import marketModule from './modules/market';
import matchModule from './modules/match';
import transactionsModule from './modules/transactions';
import browserIdModule from './modules/browser_id';
import sessionIdModule from './modules/session_id';
import useKeychainModule from './modules/use_keychain';
import cardsModule from './modules/cards';
import collectionModule from './modules/collection';
import cardLoreModule from './modules/card_lore';
import potionsModule from './modules/potions';
import urlModule from './modules/url';
import socket from './socket';
import Card from './classes/card';
import Battle from './classes/battle';
import Player from './classes/player';

/* eslint-disable no-use-before-define */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-global-assign */

const splinterlands = (function () {
  let _init_url_search_params = null; // Query string app started with

  async function load_market() {
    const market = await api('/market/for_sale_grouped');
    marketModule.set_market(market);
    return market;
  }

  async function email_login(email, password) {
    // Make sure the email address is all lowercase
    email = email.trim().toLowerCase();

    const params = { email: encodeURIComponent(email) };
    const password_key = hive.auth.getPrivateKeys(email, password).owner;

    // Sign the login request using the private key generated from the email and password combination
    params.ts = Date.now();
    params.sig = ecc.sign(email + params.ts, password_key);

    const response = await api('/players/login_email', params);

    if (response.error) {
      return response;
    }

    return await login(response.username, response.posting_key);
  }

  async function login(username, key) {
    if (!username) {
      username = localStorage.getItem('splinterlands:username');
      key = localStorage.getItem('splinterlands:key');

      if (!username) {
        return { success: false, error: 'Username not specified.' };
      }
    }

    // Format the username properly
    username = username.toLowerCase().trim();
    if (username.startsWith('@')) {
      username = username.substr(1);
    }

    let player;
    try {
      // They are logging in with an email address
      if (username.includes('@')) {
        return await email_login(username, key);
      }

      // Use the keychain extension if no private key is specified for login
      useKeychainModule.set_use_keychain(!key);
      const useKeychain = useKeychainModule.get_use_keychain();
      if (useKeychain && !window.hive_keychain) {
        return { success: false, error: 'Missing private posting key.' };
      }

      const params = { name: username, ref: localStorage.getItem('splinterlands:ref'), ts: Date.now() };

      if (!useKeychain) {
        if (key.startsWith('STM')) {
          return { success: false, error: 'This appears to be a public key. You must use your private posting key to log in.' };
        }

        // Check if this is a master password, if so try to generate the private key
        if (key && !hive.auth.isWif(key)) {
          key = hive.auth.getPrivateKeys(username, key, ['posting']).posting;
        }

        // Check that the key is a valid private key.
        try {
          hive.auth.wifToPublic(key);
        } catch (err) {
          return { success: false, error: `Invalid password or private posting key for account @${username}` };
        }

        // Sign the login request using the provided private key
        params.ts = Date.now();
        params.sig = ecc.sign(username + params.ts, key);
      } else {
        // eslint-disable-next-line no-promise-executor-return
        params.sig = await new Promise((resolve) => hive_keychain.requestSignBuffer(username, username + params.ts, 'Posting', (r) => resolve(r.result)));

        if (!params.sig) {
          return { success: false, error: `Unable to log in with account @${username}` };
        }
      }

      // Get the encrypted access token from the server
      const response = await api('/players/login', params);

      if (!response || response.error) {
        throw new Error(response);
      }

      playerModule.initiatiate_player(response);
      player = playerModule.get_player();

      localStorage.setItem('splinterlands:username', username);

      if (!useKeychain) {
        localStorage.setItem('splinterlands:key', key);
      }

      // Start the websocket connection if one is specified
      const config = configModule.get_config();
      if (config.ws_url) {
        socket.connect(config.ws_url, player.name, player.token);
      }

      // Load the player's card collection
      await collectionModule.load_collection();

      // Check if the player is currently involved in a match
      if (player.outstanding_match && player.outstanding_match.id) {
        // Set it as the currently active match
        const match = matchModule.set_match(player.outstanding_match);
        player.outstanding_match = match;

        // Check if the current player has already submitted, but not revealed, their team
        if (match.team_hash && !match.team) {
          // If the opponent already submitted their team, then we can reveal ours
          if (match.opponent_team_hash) {
            await ops.team_reveal(match.id);
          } else {
            // If the opponent has not submitted their team, then queue up the team reveal operation for when they do
            match.on_opponent_submit = async () => await ops.team_reveal(match.id);
          }
        }

        // Emit an outstanding_match event
        window.dispatchEvent(new CustomEvent('splinterlands:outstanding_match', { detail: match }));
      }
    } catch (e) {
      console.log(`There was an issue with logging in: ${e.error ? e.error : e}`);
      // eslint-disable-next-line no-throw-literal
      throw { error: `There was an issue with logging in: ${e.error ? e.error : e}` };
    }

    log_event('log_in');
    const mobileAppSettings = mobileAppModule.get_mobile_settings();
    if (mobileAppSettings.is_mobile_app) {
      player.set_player_property('app', `mobile_${mobileAppSettings.mobile_OS}`);
    }

    utils.loadScript('https://platform.twitter.com/oct.js', () => {
      twttr.conversion.trackPid('o5rpo', { tw_sale_amount: 0, tw_order_quantity: 0 });
    });

    snapyr.identify(player.alt_name || player.name, {
      join_date: player.join_date,
      starter_pack_purchase: player.starter_pack_purchase,
      email: player.email,
    });

    snapyr.track('login', {
      is_mobile: true,
    });

    // Womplay Sign Up check
    const womplay_id = await player.get_womplay_id();
    const new_womplay_id = _init_url_search_params.get('uid');
    if (!womplay_id && new_womplay_id) {
      await ec_api('/womplay/sign_up', { womplay_id: new_womplay_id });
      player.get_player_properties(true);
    }

    return player;
  }

  async function init(splinterlandsConfig) {
    configModule.set_config(splinterlandsConfig);

    const config = configModule.get_config();
    if (!config.ec_api_url) {
      configModule.update_config({
        ec_api_url: 'https://ec-api.splinterlands.com',
      });
    }

    if (!config.battle_api_url) {
      configModule.update_config({
        battle_api_url: config.api_url,
      });
    }

    hive.api.setOptions({ transport: 'http', uri: 'https://api.hive.blog', url: 'https://api.hive.blog' });

    // Load the browser id and create a new session id
    browserIdModule.initiate_browser_id();
    sessionIdModule.initiate_session_id();

    // Load the game settings
    await settingsModule.initiate_settings();

    // Load the card details
    await cardsModule.load_card_details();

    // Load market data
    await load_market();

    // hack to handle Angular query string issues
    const urlHash = window.location.hash ? window.location.hash : window.location.search;
    _init_url_search_params = new URLSearchParams(urlHash.substring(urlHash.indexOf('?')));

    // Init MetaMask library
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
    }

    const rpc_list = settingsModule.get_settings().rpc_nodes;

    if (rpc_list && Array.isArray(rpc_list) && rpc_list.length > 0) {
      splinterlandsUtils.set_rpc_nodes(rpc_list);
      hive.api.setOptions({ transport: 'http', uri: rpc_list[0], url: rpc_list[0] });
      console.log(`Set Hive RPC node to: ${rpc_list[0]}`);
    }

    // Snapyr Init
    // eslint-disable-next-line no-multi-assign
    snapyr = window.snapyr = [];
    for (let methods = ['load', 'page', 'track', 'identify', 'alias', 'group', 'ready', 'reset', 'getAnonymousId', 'setAnonymousId'], i = 0; i < methods.length; i++) {
      const method = methods[i];
      // eslint-disable-next-line no-loop-func
      snapyr[method] = (function (n) {
        return function () {
          // eslint-disable-next-line prefer-rest-params
          snapyr.push([n].concat(Array.prototype.slice.call(arguments)));
        };
      })(method);
    }
    snapyr.load('JJAzzlsU0tdrNJEJ1voRepSDgcQL5GSy', 'https://engine.snapyr.com');
    snapyr.page();

    utils.loadScript('https://sdk.snapyr.com/js/1.0.0/snapyr-sdk.min.js', () => {
      console.log('Snapyr Loaded');
    });
  }

  async function set_referral_account(referral_account) {
    const accountExists = await account_exists(referral_account);
    if (accountExists) {
      localStorage.setItem('splinterlands:ref', referral_account);
      return { success: true };
    }
    return { success: false, error: 'Invalid Referral Account' };
  }

  function has_saved_login() {
    const username = localStorage.getItem('splinterlands:username');

    if (!username) {
      return null;
    }

    const key = localStorage.getItem('splinterlands:key');
    return { username, use_keychain: !key };
  }

  async function eos_login() {
    const params = await eos.scatterAuth();
    if (params.error) {
      return { error: params.message };
    }

    const response = await api('/players/login_eos', params);
    if (response.error) {
      response.address = params.address; // Needed to show account name for new account popup
      return response;
    }

    return await login(response.username, response.posting_key);
  }

  async function eth_login() {
    const params = await ethereum.web3Auth();
    if (params.error) {
      return { error: params.message };
    }

    const response = await ec_api('/players/login_eth', params);
    if (response.error) {
      response.address = params.address; // Needed to show account name for new account popup
      return response;
    }

    return await login(response.username, response.posting_key);
  }

  async function reset_password(email) {
    return await api('/players/forgot_password', { email });
  }

  function logout() {
    localStorage.removeItem('splinterlands:username');
    localStorage.removeItem('splinterlands:key');
    playerModule.clear_player();
    collectionModule.clear_collection();
    socket.close();
  }

  // eslint-disable-next-line consistent-return
  async function browser_payment(to, amount, currency, memo) {
    const token = splinterlandsUtils.get_token(currency);

    switch (token.type) {
      case 'hive': {
        if (useKeychainModule.get_use_keychain()) {
          const player = playerModule.get_player();
          const result = await new Promise((resolve) =>
            // eslint-disable-next-line no-promise-executor-return
            hive_keychain.requestTransfer(player.name, to, parseFloat(amount).toFixed(3), memo, currency, (response) => resolve(response)),
          );
          return !result.success ? { success: false, error: result.error } : result;
        }
        const sc_url = `https://hivesigner.com/sign/transfer?to=${to}&amount=${parseFloat(amount).toFixed(3)}%20${currency}&memo=${encodeURIComponent(memo)}`;
        splinterlandsUtils.popup_center(sc_url, `${currency} Payment`, 500, 560);

        break;
      }
      case 'steem': {
        if (window.steem_keychain) {
          const player = playerModule.get_player();
          const result = await new Promise((resolve) =>
            // eslint-disable-next-line no-promise-executor-return
            steem_keychain.requestTransfer(player.name, to, parseFloat(amount).toFixed(3), memo, currency, (response) => resolve(response)),
          );
          return !result.success ? { success: false, error: result.error } : result;
        }
        const sc_url = `https://steemconnect.com/sign/transfer?to=${to}&amount=${parseFloat(amount).toFixed(3)}%20${currency}&memo=${encodeURIComponent(memo)}`;
        splinterlandsUtils.popup_center(sc_url, `${currency} Payment`, 500, 560);
        break;
      }
      case 'hive_engine': {
        const result = await splinterlandsUtils.hive_engine_transfer(to, currency, amount, memo);
        return !result.success ? { success: false, error: result.error } : result;
      }
      case 'internal':
        return await ops.token_transfer(to, amount, utils.try_parse(memo));
      case 'tron':
        return await window.tronWeb.trx.sendTransaction(to, tronWeb.toSun(parseFloat(amount).toFixed(6)));
      case 'eos':
        return await eos.scatterPay(to, amount, memo);
      case 'eth':
        return await ethereum.web3Pay(to, amount);
      case 'erc20':
        return await ethereum.erc20Payment(currency.toUpperCase(), amount * 1000, memo);
      default:
    }
  }

  async function external_deposit(wallet_type, to, amount, currency, memo) {
    switch (wallet_type) {
      case 'hive_engine': {
        const result = await splinterlandsUtils.hive_engine_transfer(to, currency, amount, memo);
        return !result.success ? { success: false, error: result.error } : result;
      }
      case 'tron': {
        if (currency != 'DEC') {
          return { success: false, error: 'Invalid currency specified.' };
        }

        const token = splinterlandsUtils.get_token('DEC-TRON');
        return await tron.sendToken(to, amount, token.token_id);
      }
      case 'bsc': {
        if (currency != 'DEC') {
          return { success: false, error: 'Invalid currency specified.' };
        }

        const player = playerModule.get_player();
        return await bsc.bscDeposit(amount, player.name);
      }
      default:
        return { success: false, error: 'Invalid currency specified.' };
    }
  }

  function group_collection_by_card(card_detail_id) {
    return collectionModule.group_collection().filter((c) => c.card_detail_id == card_detail_id);
  }

  function get_battle_summoners(match) {
    return collectionModule
      .group_collection(collectionModule.get_collection(), true)
      .filter((d) => d.type == 'Summoner' && d.owned.length > 0)
      .map((d) => {
        // Check if the splinter is inactive for this battle
        if (match.inactive.includes(d.color)) {
          return null;
        }

        // Check if it's an allowed card
        if (['no_legendaries', 'no_legendary_summoners'].includes(match.allowed_cards) && d.rarity == 4) {
          return null;
        }

        // Check if it is allowed but the current ruleset
        if (match.ruleset.includes('Little League') && d.stats.mana > 4) {
          return null;
        }

        const player = playerModule.get_player();
        let card = d.owned.find(
          (o) =>
            (match.allowed_cards != 'gold_only' || o.gold) &&
            (match.allowed_cards != 'alpha_only' || o.edition == 0) &&
            (match.match_type == 'Ranked' ? o.playable_ranked : o.playable) &&
            (!o.delegated_to || o.delegated_to == player.name),
        );

        // Add "starter" card
        if (!card && !['gold_only', 'alpha_only'].includes(match.allowed_cards) && d.is_starter_card) {
          card = Card.get_starter_card(d.id, d.starter_edition);
        }

        if (card) {
          card = new Card({ ...card });
          card.level = splinterlandsUtils.get_summoner_level(match.rating_level, card);
        }

        return card;
      })
      .filter((c) => c)
      .sort((a, b) => a.stats.mana - b.stats.mana);
  }

  function get_battle_monsters(match, summoner_card, ally_color) {
    const summoner_details = cardsModule.get_card_details(summoner_card.card_detail_id);

    return collectionModule
      .group_collection(collectionModule.get_collection(), true)
      .filter(
        (d) => d.type == 'Monster' && d.owned.length > 0 && (d.color == summoner_details.color || d.color == 'Gray' || (summoner_details.color == 'Gold' && d.color == ally_color)),
      )
      .map((d) => {
        // Check if it's an allowed card
        if ((match.ruleset.includes('Lost Legendaries') || match.allowed_cards == 'no_legendaries') && d.rarity == 4) {
          return;
        }

        if (match.ruleset.includes('Rise of the Commons') && d.rarity > 2) {
          return;
        }

        if (match.ruleset.includes('Taking Sides') && d.color == 'Gray') {
          return;
        }

        if (match.ruleset.includes('Little League') && d.stats.mana[0] > 4) {
          return;
        }

        if (match.ruleset.includes('Even Stevens') && d.stats.mana[0] % 2 == 1) {
          return;
        }

        if (match.ruleset.includes('Odd Ones Out') && d.stats.mana[0] % 2 == 0) {
          return;
        }

        const player = playerModule.get_player();
        let card = d.owned.find(
          (o) =>
            (match.allowed_cards != 'gold_only' || o.gold) &&
            (match.allowed_cards != 'alpha_only' || o.edition == 0) &&
            (match.match_type == 'Ranked' ? o.playable_ranked : o.playable) &&
            (!o.delegated_to || o.delegated_to == player.name),
        );

        // Add "starter" card
        if (!card && !['gold_only', 'alpha_only'].includes(match.allowed_cards) && d.is_starter_card) {
          card = Card.get_starter_card(d.id, d.starter_edition);
        }

        if (card) {
          card = new Card({ ...card });
          card.level = splinterlandsUtils.get_monster_level(match.rating_level, summoner_card, card);

          if (match.ruleset.includes('Up Close & Personal') && d.stats.attack[card.level - 1] == 0) {
            return;
          }

          if (match.ruleset.includes('Keep Your Distance') && d.stats.attack[card.level - 1] > 0) {
            return;
          }

          if (match.ruleset.includes('Broken Arrows') && d.stats.ranged[card.level - 1] > 0) {
            return;
          }

          if (match.ruleset.includes('Lost Magic') && d.stats.magic[card.level - 1] > 0) {
            return;
          }
        }

        // eslint-disable-next-line consistent-return
        return card;
      })
      .filter((c) => c)
      .sort((a, b) => a.stats.mana - b.stats.mana);
  }

  async function create_blockchain_account(username) {
    username = username.toLowerCase();

    try {
      const settings = settingsModule.get_settings();
      const result = await api('/players/create_blockchain_account', { name: username, is_test: settings().test_acct_creation });

      if (result.error) {
        return result;
      }

      await transactionsModule.send_tx_wrapper('upgrade_account', 'Upgrade Account', { account_name: username }, (tx) => tx);
      return await login(result.username, result.posting_key);
    } catch (err) {
      return err;
    }
  }

  async function create_account_email(email, password, subscribe, captcha_token) {
    // Make sure the email address is all lowercase
    email = email.trim().toLowerCase();

    // Generate a key pair based on the email and password
    const password_pub_key = hive.auth.getPrivateKeys(email, password).ownerPubkey;

    const settings = settingsModule.get_settings();
    const params = {
      purchase_id: `new-${utils.randomStr(6)}`, // We need to set a purchase ID even though not making a purchase for backwards compatibility
      email: encodeURIComponent(email),
      password_pub_key,
      subscribe,
      is_test: settings.test_acct_creation,
      ref: localStorage.getItem('splinterlands:ref'),
      ref_url: localStorage.getItem('splinterlands:url'),
      captcha_token,
    };

    const response = await api('/players/create_email', params);

    if (response && !response.error) {
      const login_response = await email_login(email, password); // Must login first for get_player() to work for tracking

      log_event('sign_up');

      const player = playerModule.get_player();
      snapyr.track('sign_up', {
        playerName: player.alt_name || player.name,
        type: 'email',
      });

      utils.loadScript('https://platform.twitter.com/oct.js', () => {
        twttr.conversion.trackPid('o4d37', { tw_sale_amount: 0, tw_order_quantity: 0 });
      });

      return login_response;
    }

    return response;
  }

  async function create_account_eos(email, subscribe, captcha_token) {
    const account = await eos.getIdentity();
    email = email.trim().toLowerCase();

    const settings = settingsModule.get_settings();
    const params = {
      login_type: 'eos',
      purchase_id: `new-${utils.randomStr(6)}`, // We need to set a purchase ID even though not making a purchase for backwards compatibility
      email,
      address: account.name,
      password_pub_key: account.publicKey,
      subscribe,
      is_test: settings.test_acct_creation,
      ref: localStorage.getItem('splinterlands:ref'),
      ref_url: localStorage.getItem('splinterlands:url'),
      browser_id: browserIdModule.get_browser_id(),
      captcha_token,
    };

    const response = await api('/players/create_email', params);

    if (response && !response.error) {
      const login_response = await eos_login();

      log_event('sign_up');

      const player = playerModule.get_player();
      snapyr.track('sign_up', {
        playerName: player.alt_name || player.name,
        type: 'eos',
      });

      utils.loadScript('https://platform.twitter.com/oct.js', () => {
        twttr.conversion.trackPid('o4d37', { tw_sale_amount: 0, tw_order_quantity: 0 });
      });

      return login_response;
    }

    return response;
  }

  async function create_account_eth(email, subscribe, captcha_token) {
    const account = await ethereum.getIdentity();
    email = email.trim().toLowerCase();

    const settings = settingsModule.get_settings();
    const params = {
      login_type: 'ethereum',
      purchase_id: `new-${utils.randomStr(6)}`, // We need to set a purchase ID even though not making a purchase for backwards compatibility
      email,
      address: account.publicKey,
      password_pub_key: account.publicKey,
      subscribe,
      is_test: settings.test_acct_creation,
      ref: localStorage.getItem('splinterlands:ref'),
      ref_url: localStorage.getItem('splinterlands:url'),
      browser_id: browserIdModule.get_browser_id(),
      captcha_token,
    };

    const response = await api('/players/create_eth', params);

    if (response && !response.error) {
      const login_response = eth_login();

      log_event('sign_up');

      const player = playerModule.get_player();
      snapyr.track('sign_up', {
        playerName: player.alt_name || player.name,
        type: 'eth',
      });

      utils.loadScript('https://platform.twitter.com/oct.js', () => {
        twttr.conversion.trackPid('o4d37', { tw_sale_amount: 0, tw_order_quantity: 0 });
      });

      return login_response;
    }

    return response;
  }

  async function redeem_promo_code(code, purchase_id) {
    const response = await api('/purchases/start_code', { code, purchase_id });

    if (!response || response.error) {
      return response;
    }

    // Wait for completion of the purchase
    return await transactionsModule.check_tx(purchase_id);
  }

  async function check_promo_code(code) {
    return await api('/purchases/check_code', { code });
  }

  async function get_available_packs(edition) {
    try {
      const { packs } = await api('/purchases/stats');
      return packs.find((p) => p.edition == edition).available;
    } catch (err) {
      return 0;
    }
  }

  async function battle_history(player, limit) {
    const response = await api('/battle/history2', { player, limit });

    if (response && response.battles) {
      return response.battles.map((r) => new Battle(r));
    }

    return response;
  }

  async function get_leaderboard(season, leaderboard_id, page) {
    const leaderboard = await api('/players/leaderboard_with_player', { season, leaderboard: leaderboard_id, page });

    if (leaderboard.leaderboard) {
      leaderboard.leaderboard = leaderboard.leaderboard.map((p) => new Player(p));
    }

    leaderboard.player = leaderboard.player ? new Player(leaderboard.player) : playerModule.get_player();
    return leaderboard;
  }

  async function get_global_chat() {
    const history = await api('/players/chat_history');
    history.forEach((h) => (h.player = new Player(h.player)));
    return history;
  }

  async function get_news() {
    const res = await fetch(`${settingsModule.get_settings().asset_url}website/mobile_news/sps_airdrop.html`);

    const news = await res.text();

    return { has_news: true, news_html: news };
  }

  async function get_claimable_dec_balance() {
    // let history = await api('/players/claimable_dec_balance');
    return { claimable_dec: 10 };
  }

  async function claim_dec() {
    // let claim = await api('/players/claim_dec');
    return { success: true };
  }

  async function validate_acct_name(name) {
    name = name.toLowerCase();
    const error = hive.utils.validateAccountName(name);

    if (error) {
      return { available: false, error };
    }

    const is_existing_account = await this.account_exists(name);

    if (is_existing_account) {
      return { available: false, error: 'That account name is already taken.' };
    }

    return { available: true };
  }

  async function account_exists(name) {
    const res = await api('/players/exists', { name });
    return res.exists;
  }

  function get_summoner_level(rating_level, card) {
    const { rarity } = cardsModule.get_card_details(card.card_detail_id);
    const max_level = 10 - (rarity - 1) * 2;
    return Math.min(card.level, Math.max(Math.round((max_level / 4) * rating_level), 1));
  }

  function get_monster_level(rating_level, summoner_card, monster_card) {
    if (rating_level == 0) {
      return 1;
    }

    const summoner_rarity = cardsModule.get_card_details(summoner_card.card_detail_id).rarity;
    const monster_rarity = cardsModule.get_card_details(monster_card.card_detail_id).rarity;
    const summoner_level = get_summoner_level(rating_level, summoner_card);

    const monster_max = 10 - (monster_rarity - 1) * 2;
    const summoner_max = 10 - (summoner_rarity - 1) * 2;
    return Math.min(monster_card.level, Math.max(Math.round((monster_max / summoner_max) * summoner_level), 1));
  }

  return {
    init,
    api,
    ec_api,
    api_post,
    login,
    logout,
    send_tx: transactionsModule.send_tx,
    send_tx_wrapper: transactionsModule.send_tx_wrapper,
    load_collection: collectionModule.load_collection,
    group_collection: collectionModule.group_collection,
    get_battle_summoners,
    get_battle_monsters,
    get_card_details: cardsModule.get_card_details,
    log_event,
    load_market,
    browser_payment,
    has_saved_login,
    create_account_email,
    email_login,
    check_promo_code,
    redeem_promo_code,
    reset_password,
    load_card_lore: cardLoreModule.load_card_lore,
    group_collection_by_card,
    get_available_packs,
    get_potions: potionsModule.get_potions,
    wait_for_match: matchModule.wait_for_match,
    wait_for_result: matchModule.wait_for_result,
    battle_history,
    get_leaderboard,
    get_global_chat,
    set_url: urlModule.set_url,
    external_deposit,
    create_blockchain_account,
    get_config: configModule.get_config,
    get_settings: settingsModule.get_settings,
    get_player: playerModule.get_player,
    get_market: marketModule.get_market,
    get_collection: collectionModule.get_collection,
    get_transaction: transactionsModule.get_transaction,
    use_keychain: useKeychainModule.get_use_keychain,
    get_match: matchModule.get_match,
    set_match: matchModule.set_match,
    eos_login,
    create_account_eos,
    get_init_url_search_params: () => _init_url_search_params,
    eth_login,
    create_account_eth,
    get_server_time_offset: splinterlandsUtils.get_server_time_offset,
    get_news,
    set_referral_account,
    get_claimable_dec_balance,
    claim_dec,
    validate_acct_name,
    account_exists,
    get_summoner_level,
    get_monster_level,
  };
})();

export default splinterlands;
