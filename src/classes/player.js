import socket from '../socket';
import League from './league';
import Quest from './quest';
import Guild from './guild';
import Season from './season';
import Card from './card';
import api, { ec_api, api_post } from '../modules/api';
import settingsModule from '../modules/settings';
import configModule from '../modules/config';

const { get_settings } = settingsModule;

class Player {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    this.league = new League(data.rating, data.league);
    this.next_tier = !this.league.is_max_league ? new League(null, data.league + 1) : new League(null, data.league);

    this.quest = new Quest(data.quest || {});

    if (!this.name && this.player) {
      this.name = this.player;
    }

    if (data.guild && typeof data.guild === 'object') {
      this.guild = new Guild(data.guild);
    } else if (data.guild_id || (data.guild && typeof data.guild === 'string')) {
      this.guild = new Guild({ id: data.guild_id || data.guild, name: data.guild_name, data: data.guild_data });
    }

    if (this.season_reward) {
      this.season_reward = new Season(this.season_reward);
    }

    this.has_collection_power_changed = true;
    this._player_properties = null;
  }

  async load_balances() {
    this.balances = await api('/players/balances');
    return this.balances;
  }

  async get_balance(token, refresh) {
    if (!this.balances || refresh) {
      await this.load_balances();
    }

    const balance = this.balances.find((b) => b.token == token);
    return balance ? parseFloat(balance.balance) : 0;
  }

  balance(token) {
    const balance = this.balances.find((b) => b.token == token);
    return balance ? parseFloat(balance.balance) : 0;
  }

  async refresh() {
    const data = await api('/players/refresh');
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    this.league = new League(data.rating, data.league);
    this.quest = new Quest(data.quest || {});

    if (data.guild) {
      this.guild = new Guild(data.guild);
    }
  }

  get ecr() {
    return Math.min(
      (Number.isNaN(parseInt(this.capture_rate)) ? 10000 : this.capture_rate) + (get_settings().last_block - this.last_reward_block) * get_settings().dec.ecr_regen_rate,
      10000,
    );
  }

  get profile_image() {
    return Number.isNaN(this.avatar_id)
      ? `${configModule.get_config().api_url}/players/avatar/${this.name}`
      : `https://d36mxiodymuqjm.cloudfront.net/website/icons/avatars/avatar_${this.avatar_id}.png`;
  }

  get avatar_frame() {
    return `https://d36mxiodymuqjm.cloudfront.net/website/icons/avatars/avatar-frame_${this.league.group_name.toLowerCase()}.png`;
  }

  get display_name() {
    return this._display_name || this.name;
  }

  set display_name(val) {
    this._display_name = val;
  }

  get quest_rewards() {
    if (!this.quest) {
      return null;
    }

    return this.quest.rewards(this.league.id);
  }

  render_avatar(size) {
    const avatar = document.createElement('div');

    const frame_img = document.createElement('img');
    frame_img.setAttribute('src', this.avatar_frame);
    frame_img.setAttribute('style', `height: ${size}px;`);
    avatar.appendChild(frame_img);

    const avatar_container = document.createElement('div');
    avatar_container.setAttribute('class', 'sl-rel-pos');

    const avatar_img = document.createElement('img');
    avatar_img.setAttribute('src', this.profile_image);
    avatar_img.setAttribute(
      'style',
      `height: ${(size * 0.667).toFixed(2)}px; width: ${(size * 0.667).toFixed(2)}px; border-radius: ${(size * 0.667).toFixed()}px; position: absolute; left: ${(size / 6).toFixed(
        2,
      )}px; top: -${(size * (5 / 6)).toFixed(2)}px;`,
    );
    avatar_container.appendChild(avatar_img);
    avatar.appendChild(avatar_container);

    return avatar;
  }

  static async get_wallets() {
    return await api('/players/wallets');
  }

  async get_referrals() {
    return await api('/players/referrals');
  }

  async update_avatar(avatar_id) {
    const response = await api('/players/set_avatar', { avatar_id });

    if (response && response.success) {
      this.avatar_id = avatar_id;
    }

    return response;
  }

  async recent_teams() {
    return await api('/players/recent_teams', { player: this.name });
  }

  async last_team() {
    const teams = await this.recent_teams();

    if (!teams || teams.length == 0) {
      return null;
    }

    const team = teams[0];
    team.summoner = new Card(team.summoner);
    team.monsters = team.monsters.map((m) => new Card(m));
    return team;
  }

  static async load(name) {
    // eslint-disable-next-line no-async-promise-executor
    return await new Promise(async (resolve, reject) => {
      const response = await api('/players/details', { name });

      if (response.error) {
        reject(response);
      } else {
        resolve(new Player(response));
      }
    });
  }

  send_chat(message, is_global) {
    socket.send({
      type: 'post_chat_msg',
      guild_id: is_global ? 'global' : this.guild.id,
      message,
    });
  }

  subscribe_global_chat(subscribe) {
    socket.send({
      type: 'subscribe',
      room: 'global',
      subscribe,
    });
  }

  update_rating(new_rating, new_league) {
    this.rating = new_rating;
    this.league = new League(new_rating, new_league);
  }

  async request_keys() {
    if (!this.starter_pack_purchase) {
      return { error: `You must purchase the Summoner's Spellbook before you may request your account keys.` };
    }

    if (this.has_keys) {
      return {
        error: `Account keys have already been requested from this account and may only be requested once. Please go to https://support.splinterlands.com/ or on Discord for help.`,
      };
    }

    return await api('/players/request_keys');
  }

  get points_until_next_league() {
    return Math.max(this.league.max_rating - this.rating, 0);
  }

  get power_until_next_league() {
    return Math.max(this.league.max_power - this.collection_power, 0);
  }

  get power_progress() {
    const progress = +(((this.collection_power - this.league.min_power) / (this.league.max_power - this.league.min_power)) * 100).toFixed(2);

    if (progress < 0) {
      return 0;
    }
    if (progress > 100) {
      return 100;
    }
    return progress;
  }

  get rating_progress() {
    const progress = +(((this.rating - this.league.min_rating) / (this.league.max_rating - this.league.min_rating)) * 100).toFixed(2);

    if (progress < 0) {
      return 0;
    }
    if (progress > 100) {
      return 100;
    }
    return progress;
  }

  get is_eligible_to_advance() {
    return !this.league.is_max_league && this.points_until_next_league === 0 && this.power_until_next_league === 0;
  }

  async check_messages(type) {
    return await api('/players/messages', { type });
  }

  get max_cp_league() {
    let num = 0;

    for (let index = 0; index < get_settings().leagues.length; index++) {
      if (this.collection_power >= get_settings().leagues[index].min_power) {
        num = index;
      } else {
        break;
      }
    }

    return num;
  }

  get max_cp_league_name() {
    return get_settings().leagues[this.max_cp_league].name;
  }

  get need_to_set_username() {
    return this.starter_pack_purchase && this.use_proxy;
  }

  get pending_season_rewards() {
    const max_league = this.season_max_league || 0;

    return max_league > 0 ? get_settings().season.reward_packs[max_league] : '0';
  }

  async get_player_properties(do_refresh) {
    if (this._player_properties && !do_refresh) {
      return this._player_properties;
    }
    this._player_properties = (await api(`/player_properties`)).values;
    return this._player_properties;
  }

  async get_player_property(property) {
    return await api(`/player_properties/${property}`);
  }

  async set_player_property(property, value) {
    if (property == 'mobile_tutorial_progress' && value == 'complete') {
      const womplay_id = await this.get_womplay_id();
      if (womplay_id) {
        await ec_api('/womplay/tracking', { womplay_id, event_name: 'completed_tutorial' });
      }
    }
    return await api_post(`/player_properties/${property}`, { value });
  }

  async external_cards(blockchain) {
    const res = await ec_api('/players/external_cards', { player: this.name, blockchain });
    res.cards = res.cards.map((c) => new Card(c));
    return res;
  }

  async dec_balances() {
    return await ec_api('/players/dec_balances');
  }

  async get_inventory() {
    return await api('/players/inventory');
  }

  async get_womplay_id() {
    const properties = await this.get_player_properties();
    return properties.womplay_id ? properties.womplay_id.value : null;
  }
}

export default Player;
