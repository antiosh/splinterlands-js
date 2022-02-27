import splinterlandsUtils from '../splinterlands_utils';
import playerModule from '../modules/player';
import settingsModule from '../modules/settings';

class Potion {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    if (!data.subtype) {
      this.subtype = this.id;
    }

    this.base_price_per_charge = this.price_per_charge;
    this.price_per_charge = splinterlandsUtils.guild_discounted_cost(this.price_per_charge);
  }

  get charges_remaining() {
    return playerModule.get_player().balance(this.id.toUpperCase());
  }

  get image_url() {
    return `https://d36mxiodymuqjm.cloudfront.net/website/ui_elements/shop/potions/potion_${this.id}.png`;
  }

  static get_potion(type) {
    if (!Potion._potions || Potion._potions.length == 0) {
      Potion._potions = settingsModule.get_settings().potions.map((p) => new Potion(p));
    }

    return Potion._potions.find((p) => p.id == type);
  }
}

export default Potion;
