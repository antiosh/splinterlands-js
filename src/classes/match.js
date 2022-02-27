import utils from '../utils';
import splinterlandsUtils from '../splinterlands_utils';

class Match {
  constructor(data) {
    this.update(data);
  }

  update(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    if (this.match_date) {
      this.inactive = this.inactive.split(',');
      this.ruleset = this.ruleset.split('|');
      this.settings = utils.try_parse(this.settings);
      this.rating_level = this.settings ? this.settings.rating_level : null;
      this.allowed_cards = this.settings ? this.settings.allowed_cards : null;
    }

    if (this.submit_expiration_date) {
      this.submit_expiration_date = splinterlandsUtils.server_date(this.submit_expiration_date, 20);
    }

    return this;
  }

  get ruleset_images() {
    return this.ruleset.map((r) => splinterlandsUtils.asset_url(`website/icons/rulesets/new/img_combat-rule_${r.toLowerCase().replace(/[^a-zA-Z]+/g, '-')}_150.png`));
  }
}

export default Match;
