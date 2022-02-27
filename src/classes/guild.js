import utils from '../utils';
import GuildBuilding from './guild_building';
import api from '../modules/api';
import settingsModule from '../modules/settings';

const { get_settings } = settingsModule;

class Guild {
  _init(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    this.data = utils.try_parse(data.data);
    const buildings = utils.try_parse(data.buildings);

    if (buildings) {
      this.buildings = Object.keys(buildings).map((k) => new GuildBuilding(this.id, k, buildings[k]));
    }

    this.crest = this.data ? this.data.crest : {};
  }

  constructor(data) {
    this._init(data);
  }

  static async list(name, membership_type, language) {
    if (!name) {
      name = '';
    }

    if (!membership_type) {
      membership_type = '';
    }

    if (!language) {
      language = '';
    }

    return (await api('/guilds/list', { name, membership_type, language })).map((g) => new Guild(g));
  }

  static async find(id) {
    return new Guild(await api('/guilds/find', { id }));
  }

  get max_members() {
    return get_settings().guilds.guild_hall.member_limit[this.level - 1];
  }

  get_building(type) {
    return this.buildings.find((b) => b.type == type);
  }

  get crest_banner_image() {
    const banners = ['black', 'blue', 'gold', 'green', 'mint', 'orange', 'pink', 'purple', 'red', 'silver', 'teal', 'yellow'];
    const banner = banners.includes(this.crest.banner) ? this.crest.banner : 'black';

    return `https://d36mxiodymuqjm.cloudfront.net/website/guilds/banners/bg_banner_${banner}.png`;
  }

  get crest_decal_image() {
    const decals = ['axe', 'bolt', 'book', 'globe', 'hand', 'helm', 'shield', 'skull', 'staff', 'sword', 'tree', 'wolf'];
    const decal = decals.includes(this.crest.decal) ? this.crest.decal : null;

    return `https://d36mxiodymuqjm.cloudfront.net/website/guilds/decals/img_guild_${decal}.png`;
  }

  async get_members() {
    return await api('/guilds/members', { guild_id: this.id });
  }

  async get_chat() {
    const history = await api('/players/chat_history', { guild_id: this.id });
    // history.forEach((h) => (h.player = new splinterlands.Player(h.player)));
    return history;
  }

  render_crest(size) {
    const banners = ['black', 'blue', 'gold', 'green', 'mint', 'orange', 'pink', 'purple', 'red', 'silver', 'teal', 'yellow'];
    const banner = banners.includes(this.crest.banner) ? this.crest.banner : 'black';

    const decals = ['axe', 'bolt', 'book', 'globe', 'hand', 'helm', 'shield', 'skull', 'staff', 'sword', 'tree', 'wolf'];
    const decal = decals.includes(this.crest.decal) ? this.crest.decal : null;

    size = size || 200;
    const decal_size = Math.round((size / 200) * 140);
    const decal_left = (size - decal_size) / 2 + 1;
    const decal_top = (size - decal_size) / 4;

    const crest_container = document.createElement('div');
    crest_container.setAttribute('class', 'sl-guild-crest');

    if (decal) {
      const rel_container = document.createElement('div');
      rel_container.setAttribute('class', 'sl-rel-pos');

      const decal_img = document.createElement('img');
      decal_img.setAttribute('src', `https://d36mxiodymuqjm.cloudfront.net/website/guilds/decals/img_guild_${decal}.png`);
      decal_img.setAttribute('style', `position: absolute; width: ${decal_size}px; height: ${decal_size}px; left: ${decal_left}; top: ${decal_top};`);
      rel_container.appendChild(decal_img);

      crest_container.appendChild(rel_container);
    }

    const banner_img = document.createElement('img');
    banner_img.setAttribute('src', `https://d36mxiodymuqjm.cloudfront.net/website/guilds/banners/bg_banner_${banner}.png`);
    banner_img.setAttribute('style', `width: ${size}px; height: ${size}px;`);
    crest_container.appendChild(banner_img);

    return crest_container;
  }

  get shop_discount() {
    if (!this.quest_lodge_level) {
      return 0;
    }

    return get_settings().guilds.shop_discount_pct[this.quest_lodge_level - 1];
  }

  async post_announcement(subject, message, is_private) {
    const data = {
      guild_id: this.id,
      subject,
      message,
      is_private,
    };
    return api('/guilds/post_announcement', data);
  }

  async refresh() {
    const data = await Guild.find(this.id);
    this._init(data);
  }

  static async delete_announcement(announcement_id) {
    return api('/guilds/delete_announcement', { id: announcement_id });
  }
}

export default Guild;
