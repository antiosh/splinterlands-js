/* global snapyr */
import md5 from 'blueimp-md5';

import api from './modules/api';
import matchModule from './modules/match';
import playerModule from './modules/player';
import settingsModule from './modules/settings';
import transactionsModule from './modules/transactions';
import collectionModule from './modules/collection';
import utils from './utils';
import RewardItem from './classes/reward_item';
import Card from './classes/card';
import Quest from './classes/quest';

const ops = (function () {
  async function combine_cards(card_ids) {
    return transactionsModule.send_tx_wrapper('combine_cards', 'Combine Cards', { cards: card_ids }, async (tx) => {
      playerModule.get_player().has_collection_power_changed = true;
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function combine_all(card_detail_id, gold, edition) {
    return transactionsModule.send_tx_wrapper('combine_all', 'Combine Cards', { card_detail_id, gold, edition }, async (tx) => {
      playerModule.get_player().has_collection_power_changed = true;
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function burn_cards(card_ids) {
    return transactionsModule.send_tx_wrapper('burn_cards', 'Convert to DEC', { cards: card_ids }, async (tx) => {
      playerModule.get_player().has_collection_power_changed = true;
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function convert_cards(card_ids) {
    return transactionsModule.send_tx_wrapper('convert_cards', 'Convert to Beta', { cards: card_ids }, (tx) => tx);
  }

  async function add_wallet(type, address) {
    return transactionsModule.send_tx_wrapper('add_wallet', 'Link External Wallet', { type, address }, (tx) => tx);
  }

  async function gift_cards(card_ids, to) {
    return transactionsModule.send_tx_wrapper('gift_cards', 'Transfer Cards', { cards: card_ids, to }, async (tx) => {
      playerModule.get_player().has_collection_power_changed = true;
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function send_packs(edition, qty, to) {
    return transactionsModule.send_tx_wrapper('gift_packs', 'Transfer Packs', { edition, qty, to }, async (tx) => {
      await playerModule.get_player().load_balances();
      return tx.result;
    });
  }

  async function delegate_cards(card_ids, to) {
    return transactionsModule.send_tx_wrapper('delegate_cards', 'Delegate Cards', { cards: card_ids, to }, async (tx) => {
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function undelegate_cards(card_ids) {
    return transactionsModule.send_tx_wrapper('undelegate_cards', 'Delegate Cards', { cards: card_ids }, async (tx) => {
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function market_purchase(market_ids, price, currency) {
    return transactionsModule.send_tx_wrapper('market_purchase', 'Market Purchase', { items: market_ids, price: price + 0.01, currency: currency.toUpperCase() }, async (tx) => {
      playerModule.get_player().has_collection_power_changed = true;
      await collectionModule.load_collection();
      return tx.result;
    });
  }

  async function token_transfer(to, qty, data) {
    let obj = { to, qty, token: 'DEC' };

    if (data && typeof data === 'object') {
      obj = Object.assign(obj, data);
    }

    return transactionsModule.send_tx_wrapper('token_transfer', 'Transfer DEC', obj, (tx) => tx);
  }

  async function sell_cards(card_ids, price) {
    return transactionsModule.send_tx_wrapper(
      'sell_cards',
      'Sell Cards',
      { cards: card_ids, price, currency: 'USD', fee_pct: settingsModule.get_settings().market_fee },
      async (tx) => {
        await collectionModule.load_collection();
        return tx.result;
      },
    );
  }

  async function cancel_sell(market_id) {
    return transactionsModule.send_tx_wrapper('cancel_sell', 'Cancel Market Sale', { trx_ids: [market_id] }, (tx) => tx);
  }

  async function find_match(match_type, opponent, settings) {
    return transactionsModule.send_tx_wrapper('find_match', 'Find Match', { match_type, opponent, settings }, (tx) => {
      snapyr.track('find_match', {
        match_type,
        settings,
      });

      matchModule.set_match({ id: tx.id, status: 0 });
    });
  }

  async function team_reveal(trx_id, summoner, monsters, secret) {
    if (!summoner) {
      // If no summoner is specified, check if the team info is saved in local storage
      const saved_team = utils.try_parse(localStorage.getItem(`splinterlands:${trx_id}`));

      if (saved_team) {
        summoner = saved_team.summoner;
        monsters = saved_team.monsters;
        secret = saved_team.secret;
      }
    }

    return transactionsModule.send_tx_wrapper('team_reveal', 'Team Reveal', { trx_id, summoner, monsters, secret }, (r) => {
      // Clear any team info saved in local storage after it is revealed
      localStorage.removeItem(`splinterlands:${trx_id}`);
      return r;
    });
  }

  async function submit_team(match, summoner, monsters, secret) {
    if (!secret) {
      secret = utils.randomStr(10);
    }

    const data = { trx_id: match.id, team_hash: md5(`${summoner},${monsters.join()},${secret}`) };

    return transactionsModule.send_tx_wrapper('submit_team', 'Submit Team', data, async (tx) => {
      const cur_match = matchModule.get_match();

      if (cur_match && cur_match.id == match.id) {
        // If the opponent already submitted their team, then we can reveal ours
        if (cur_match.opponent_team_hash) {
          return await team_reveal(cur_match.id, summoner, monsters, secret);
        }

        // If the opponent has not submitted their team, then queue up the team reveal operation for when they do
        cur_match.on_opponent_submit = async () => await team_reveal(cur_match.id, summoner, monsters, secret);

        // Save the team info locally in case the browser is refreshed or something and it needs to be resubmitted later
        localStorage.setItem(`splinterlands:${cur_match.id}`, JSON.stringify({ summoner, monsters, secret }));
      }

      return tx;
    });
  }

  async function cancel_match() {
    return transactionsModule.send_tx_wrapper('cancel_match', 'Cancel Match', null, (r) => r);
  }

  async function surrender(battle_queue_id) {
    return transactionsModule.send_tx_wrapper('surrender', 'Surrender', { battle_queue_id }, (r) => r);
  }

  async function claim_season_rewards(season) {
    // eslint-disable-next-line consistent-return
    return transactionsModule.send_tx_wrapper('claim_reward', 'Claim Reward', { type: 'league_season', season }, async (tx) => {
      playerModule.get_player().season_reward = null;
      await collectionModule.load_collection();

      // Mark reward as revealed
      await api('/players/rewards_revealed', { reward_tx_id: tx.id });

      // New reward system
      if (tx.result.rewards) {
        return { rewards: tx.result.rewards.map((r) => new RewardItem(r)) };
      }
      if (tx.result.cards) {
        return { cards: tx.result.cards.map((c) => new Card(c)) };
      }
    });
  }

  const _test_reward_data = {
    success: true,
    rewards: [
      {
        type: 'potion',
        quantity: 1,
        potion_type: 'gold',
      },
      {
        type: 'reward_card',
        quantity: 1,
        card: {
          uid: 'C3-218-MMSX4GJXLC',
          card_detail_id: 218,
          xp: 0,
          gold: false,
          edition: 3,
        },
      },
      {
        type: 'reward_card',
        quantity: 1,
        card: {
          uid: 'C3-134-CQRELRWI40',
          card_detail_id: 134,
          xp: 0,
          gold: false,
          edition: 3,
        },
      },
      {
        type: 'dec',
        quantity: 11,
      },
      {
        type: 'potion',
        quantity: 1,
        potion_type: 'legendary',
      },
      {
        type: 'reward_card',
        quantity: 1,
        card: {
          uid: 'C3-231-G6LAY0NDXC',
          card_detail_id: 231,
          xp: 1,
          gold: false,
          edition: 3,
        },
      },
      {
        type: 'potion',
        quantity: 1,
        potion_type: 'gold',
      },
      {
        type: 'reward_card',
        quantity: 1,
        card: {
          uid: 'C3-93-AAZOMA7H3K',
          card_detail_id: 93,
          xp: 0,
          gold: false,
          edition: 3,
        },
      },
      {
        type: 'reward_card',
        quantity: 1,
        card: {
          uid: 'C3-213-1ZKLYGKH28',
          card_detail_id: 213,
          xp: 0,
          gold: false,
          edition: 3,
        },
      },
      {
        type: 'dec',
        quantity: 12,
      },
    ],
    potions: {
      legendary: {
        potion_type: 'legendary',
        charges: 0,
        charges_used: 1,
        charges_remaining: 0,
      },
      gold: null,
    },
  };

  async function claim_quest_rewards(quest_id, test) {
    if (test) {
      const ret_val = { cards: [], quest: playerModule.get_player().quest };

      ret_val.rewards = _test_reward_data.rewards.map((r) => new RewardItem(r));
      const card_rewards = _test_reward_data.rewards.filter((i) => i.type == 'reward_card');

      if (card_rewards) {
        ret_val.cards = card_rewards.map((c) => new Card(c.card));
      }

      return ret_val;
    }

    return transactionsModule.send_tx_wrapper('claim_reward', 'Claim Reward', { type: 'quest', quest_id }, async (tx) => {
      await collectionModule.load_collection();

      // Update current player's quest info
      const quests = await api('/players/quests');

      if (quests && quests.length > 0) {
        playerModule.get_player().quest = new Quest(quests[0]);
      }

      const ret_val = { cards: [], quest: playerModule.get_player().quest };

      if (tx.result.rewards) {
        // New reward system
        ret_val.rewards = tx.result.rewards.map((r) => new RewardItem(r));
        const card_rewards = tx.result.rewards.filter((i) => i.type == 'reward_card');

        if (card_rewards) {
          ret_val.cards = card_rewards.map((c) => new Card(c.card));
        }
      } else {
        ret_val.cards = tx.result.cards.map((c) => new Card(c));
      }

      // Mark reward as revealed
      await api('/players/rewards_revealed', { reward_tx_id: tx.id });

      return ret_val;
    });
  }

  async function start_quest() {
    return transactionsModule.send_tx_wrapper('start_quest', 'Start Quest', { type: 'daily' }, (tx) => {
      const new_quest = new Quest(tx.result);
      playerModule.get_player().quest = new_quest;
      return new_quest;
    });
  }

  async function refresh_quest() {
    return transactionsModule.send_tx_wrapper('refresh_quest', 'New Quest', { type: 'daily' }, (tx) => {
      const new_quest = new Quest(tx.result);
      playerModule.get_player().quest = new_quest;
      return new_quest;
    });
  }

  async function accept_challenge(id) {
    matchModule.set_match({ id, status: 0 });
    return transactionsModule.send_tx_wrapper('accept_challenge', 'Accept Challenge', { id }, (tx) => {
      console.log('accept_challenge tx: ', tx);
    });
  }

  async function decline_challenge(id) {
    return transactionsModule.send_tx_wrapper('decline_challenge', 'Decline Challenge', { id }, (tx) => tx);
  }

  async function open_pack(edition) {
    return transactionsModule.send_tx_wrapper('open_pack', 'Open Pack', { edition }, async (tx) => {
      await collectionModule.load_collection();
      return tx.result.cards.map((c) => new Card(c));
    });
  }

  async function open_multi(edition, qty) {
    return transactionsModule.send_tx_wrapper('open_all', 'Open Multiple Packs', { edition, qty }, async (tx) => {
      await collectionModule.load_collection();
      return tx;
    });
  }

  async function purchase(type, qty, currency, data) {
    if (type.toLowerCase() == 'orb') {
      if (!currency || currency.toUpperCase() != 'DEC') {
        // eslint-disable-next-line
        return new Promise((resolve, reject) => reject({ error: 'Invalid currency specified. Essence Orbs may only be purchased with DEC.' }));
      }

      return transactionsModule.send_tx_wrapper('purchase_orbs', 'Purchase Essence Orbs', { qty }, (tx) => tx);
    }
    if (type.toLowerCase() == 'dice') {
      if (!currency || currency.toUpperCase() != 'DEC') {
        // eslint-disable-next-line
        return new Promise((resolve, reject) => reject({ error: 'Invalid currency specified. ΛZMΛRÉ Dice may only be purchased with DEC.' }));
      }

      return transactionsModule.send_tx_wrapper('purchase_dice', 'Purchase ΛZMΛRÉ Dice', { qty }, (tx) => tx);
    }

    return transactionsModule.send_tx_wrapper('purchase', 'Purchase', { type, qty, currency, data }, (tx) => tx);
  }

  async function withdraw_dec(qty, wallet) {
    const accounts = {
      tron: 'sm-dec-tron',
      ethereum: 'sl-eth',
      hive_engine: 'sl-hive',
      steem_engine: 'sl-steem',
      bsc: 'sl-bsc',
    };

    let player_wallet = null;
    if (['tron', 'ethereum', 'bsc'].some((type) => type == wallet)) {
      player_wallet = await api('/players/wallets', { type: wallet });

      if (!player_wallet) {
        // eslint-disable-next-line
        return new Promise((resolve, reject) => reject({ error: `Please link a ${wallet} wallet before withdrawing.` }));
      }
    } else {
      player_wallet = { address: playerModule.get_player().name };
    }

    return transactionsModule.send_tx_wrapper(
      'token_transfer',
      'Withdraw DEC',
      { type: 'withdraw', to: accounts[wallet] || 'sl-hive', qty, token: 'DEC', memo: player_wallet.address },
      (tx) => tx,
    );
  }

  async function guild_join(guild_id) {
    return transactionsModule.send_tx_wrapper('join_guild', 'Join Guild', { guild_id }, async (tx) => {
      await playerModule.get_player().refresh();
      return tx;
    });
  }

  async function guild_request_join(guild_id) {
    return transactionsModule.send_tx_wrapper('join_guild', 'Request Join Guild', { guild_id }, async (tx) => {
      await playerModule.get_player().refresh();
      return tx;
    });
  }

  async function guild_leave(guild_id) {
    return transactionsModule.send_tx_wrapper('leave_guild', 'Leave Guild', { guild_id }, async (tx) => {
      delete playerModule.get_player().guild;
      return tx;
    });
  }

  async function guild_create(name, motto, description, membership_type, language, banner, decal) {
    const guild_data = {
      name,
      motto,
      description,
      membership_type,
      language,
      banner,
      decal,
    };

    return transactionsModule.send_tx_wrapper('create_guild', 'Create Guild', guild_data, async (tx) => {
      await playerModule.get_player().refresh();
      return tx;
    });
  }

  async function guild_update(guild_id, name, motto, description, membership_type, language, banner, decal) {
    const guild_data = {
      guild_id,
      name,
      motto,
      description,
      membership_type,
      language,
      banner,
      decal,
    };

    return transactionsModule.send_tx_wrapper('edit_guild', 'Update Guild', guild_data, async (tx) => {
      await playerModule.get_player().guild.refresh();
      return tx;
    });
  }

  async function guild_invite(guild_id, recipient) {
    return transactionsModule.send_tx_wrapper('guild_invite', 'Invite Player', { guild_id, player: recipient }, (tx) => tx);
  }

  async function guild_approve_member(guild_id, player) {
    return transactionsModule.send_tx_wrapper('guild_accept', 'Accept Member', { guild_id, player }, (tx) => tx);
  }

  async function guild_decline_member(guild_id, player) {
    return transactionsModule.send_tx_wrapper('guild_decline', 'Decline Member', { guild_id, player }, (tx) => tx);
  }

  async function guild_promote_member(guild_id, player) {
    return transactionsModule.send_tx_wrapper('guild_promote', 'Promote Member', { guild_id, player }, (tx) => tx);
  }

  async function guild_demote_member(guild_id, player) {
    return transactionsModule.send_tx_wrapper('guild_demote', 'Demote Member', { guild_id, player }, (tx) => tx);
  }

  async function guild_kick_member(guild_id, player) {
    return transactionsModule.send_tx_wrapper('guild_remove', 'Kick Member', { guild_id, player }, (tx) => tx);
  }

  async function guild_contribution(guild_id, amount) {
    console.warn('guild_contribution is deprecated. Please use guild_building_contribution ');
    return transactionsModule.send_tx_wrapper('guild_contribution', 'Guild Contribution', { guild_id, amount }, (tx) => tx);
  }

  async function guild_building_contribution(guild_id, building, dec_amount, crowns_amount) {
    const amount = [];
    if (dec_amount > 0) {
      amount.push(`${dec_amount} DEC`);
    }
    if (crowns_amount > 0) {
      amount.push(`${crowns_amount} CROWN`);
    }
    return transactionsModule.send_tx_wrapper('guild_contribution', 'Guild Contribution', { guild_id, building, amount }, (tx) => tx);
  }

  async function league_advance() {
    return transactionsModule.send_tx_wrapper('advance_league', 'Advance League', { notify: true }, async (tx) => {
      await playerModule.get_player().refresh();
      return tx;
    });
  }

  async function set_active_authority(is_active) {
    return transactionsModule.send_tx_wrapper('update_authority', 'Update Authority', { require_active_auth: is_active }, async (tx) => tx);
  }

  return {
    combine_cards,
    combine_all,
    convert_cards,
    burn_cards,
    add_wallet,
    gift_cards,
    send_packs,
    delegate_cards,
    undelegate_cards,
    market_purchase,
    token_transfer,
    sell_cards,
    cancel_sell,
    find_match,
    submit_team,
    team_reveal,
    cancel_match,
    surrender,
    claim_quest_rewards,
    claim_season_rewards,
    start_quest,
    refresh_quest,
    accept_challenge,
    decline_challenge,
    open_pack,
    open_multi,
    purchase,
    withdraw_dec,
    guild_join,
    guild_request_join,
    guild_leave,
    guild_create,
    guild_update,
    guild_invite,
    guild_approve_member,
    guild_decline_member,
    guild_promote_member,
    guild_demote_member,
    guild_kick_member,
    guild_contribution,
    guild_building_contribution,
    league_advance,
    set_active_authority,
  };
})();

export default ops;
