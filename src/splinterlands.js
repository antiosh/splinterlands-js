/* global snapyr, hive_keychain, twttr, steem_keychain, tronWeb */

import ecc from 'eosjs-ecc';
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
import configModule from './modules/config';
import playerModule from './modules/player';
import settingsModule from './modules/settings';
import { getMarketForSale } from './modules/market';
import matchModule from './modules/match';
import transactionsModule from './modules/transactions';
import browserIdModule from './modules/browser_id';
import useKeychainModule from './modules/use_keychain';
import { getCardDetails } from './modules/cards';
import collectionModule from './modules/collection';
import { getCardLore } from './modules/cardLore';
import potionsModule from './modules/potions';
import urlModule from './modules/url';
import Card from './classes/card';
import Player from './classes/player';

/* eslint-disable no-use-before-define */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-global-assign */

const splinterlands = (function () {
  async function emailLogin(email, password) {
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

  async function login(username, key, referrer) {
    if (!username) {
      throw new Error('Username not specified.');
    }

    // Format the username properly
    username = username.toLowerCase().trim();
    if (username.startsWith('@')) {
      username = username.substr(1);
    }

    // They are logging in with an email address
    if (username.includes('@')) {
      return await emailLogin(username, key);
    }

    // Use the keychain extension if no private key is specified for login
    const useKeychain = !key;
    if (useKeychain && !window.hive_keychain) {
      throw new Error('Missing private posting key.');
    }

    const params = { name: username, ref: referrer, ts: Date.now() };

    if (!useKeychain) {
      if (key.startsWith('STM')) {
        throw new Error('This appears to be a public key. You must use your private posting key to log in.');
      }

      // Check if this is a master password, if so try to generate the private key
      if (key && !hive.auth.isWif(key)) {
        key = hive.auth.getPrivateKeys(username, key, ['posting']).posting;
      }

      // Check that the key is a valid private key.
      try {
        hive.auth.wifToPublic(key);
      } catch (err) {
        throw new Error(`Invalid password or private posting key for account @${username}`);
      }

      // Sign the login request using the provided private key
      params.ts = Date.now();
      params.sig = ecc.sign(username + params.ts, key);
    } else {
      // eslint-disable-next-line no-promise-executor-return
      params.sig = await new Promise((resolve) => hive_keychain.requestSignBuffer(username, username + params.ts, 'Posting', (r) => resolve(r.result)));

      if (!params.sig) {
        throw new Error(`Unable to log in with account @${username}`);
      }
    }

    // Get the encrypted access token from the server
    const response = await api('/players/login', params);
    return response;
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
  }

  async function checkReferralAccount(referral_account) {
    const accountExists = await getAccountExists(referral_account);
    if (accountExists) {
      return { success: true };
    }
    throw new Error('Invalid Referral Account');
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

  async function resetPassword(email) {
    return await api('/players/forgot_password', { email });
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

  async function get_battle_summoners(match) {
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
          card.level = get_summoner_level(match.rating_level, card);
        }

        return card;
      })
      .filter((c) => c)
      .sort((a, b) => a.stats.mana - b.stats.mana);
  }

  async function get_battle_monsters(match, summoner_card, ally_color) {
    const summoner_details = await getCardDetails(summoner_card.card_detail_id);

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
      const login_response = await emailLogin(email, password); // Must login first for get_player() to work for tracking

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

  async function getAvailablePacks(edition) {
    const { packs } = await api('/purchases/stats');
    return packs.find((p) => p.edition == edition).available;
  }

  async function getBattleHistory(player, limit) {
    const response = await api('/battle/history2', { player, limit });
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

    const is_existing_account = await getAccountExists(name);

    if (is_existing_account) {
      return { available: false, error: 'That account name is already taken.' };
    }

    return { available: true };
  }

  async function getAccountExists(name) {
    const res = await api('/players/exists', { name });
    return res.exists;
  }

  async function get_summoner_level(rating_level, card) {
    const { rarity } = await getCardDetails(card.card_detail_id);
    const max_level = 10 - (rarity - 1) * 2;
    return Math.min(card.level, Math.max(Math.round((max_level / 4) * rating_level), 1));
  }

  function get_monster_level(rating_level, summoner_card, monster_card) {
    if (rating_level == 0) {
      return 1;
    }

    const summoner_rarity = getCardDetails(summoner_card.card_detail_id).rarity;
    const monster_rarity = getCardDetails(monster_card.card_detail_id).rarity;
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
    send_tx: transactionsModule.send_tx,
    send_tx_wrapper: transactionsModule.send_tx_wrapper,
    load_collection: collectionModule.load_collection,
    group_collection: collectionModule.group_collection,
    get_battle_summoners,
    get_battle_monsters,
    getCardDetails,
    log_event,
    getMarketForSale,
    browser_payment,
    create_account_email,
    emailLogin,
    check_promo_code,
    redeem_promo_code,
    resetPassword,
    getCardLore,
    group_collection_by_card,
    getAvailablePacks,
    get_potions: potionsModule.get_potions,
    wait_for_match: matchModule.wait_for_match,
    wait_for_result: matchModule.wait_for_result,
    getBattleHistory,
    get_leaderboard,
    get_global_chat,
    set_url: urlModule.set_url,
    external_deposit,
    create_blockchain_account,
    get_config: configModule.get_config,
    get_settings: settingsModule.get_settings,
    get_player: playerModule.get_player,
    get_collection: collectionModule.get_collection,
    get_transaction: transactionsModule.get_transaction,
    use_keychain: useKeychainModule.get_use_keychain,
    get_match: matchModule.get_match,
    set_match: matchModule.set_match,
    eos_login,
    create_account_eos,
    eth_login,
    create_account_eth,
    get_server_time_offset: splinterlandsUtils.get_server_time_offset,
    get_news,
    checkReferralAccount,
    get_claimable_dec_balance,
    claim_dec,
    validate_acct_name,
    getAccountExists,
    get_summoner_level,
    get_monster_level,
  };
})();

export default splinterlands;
