import utils from '../utils';
import BattleCard from './battle_card';
import Player from './player';
import api from '../modules/api';
import settingsModule from '../modules/settings';

const { get_settings } = settingsModule;

class Battle {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    if (typeof this.details === 'string') {
      this.details = utils.try_parse(this.details);
    }

    if (typeof this.settings === 'string') {
      this.settings = utils.try_parse(this.settings);
    }

    if (this.details.team1) {
      this.details.team1.summoner = new BattleCard(Object.assign(this.details.team1.summoner, { team_num: 1 }));
      this.details.team1.monsters = this.details.team1.monsters ? this.details.team1.monsters.map((m) => new BattleCard(Object.assign(m, { team_num: 1 }))) : [];
    }

    if (this.details.team2) {
      this.details.team2.summoner = new BattleCard(Object.assign(this.details.team2.summoner, { team_num: 2 }));
      this.details.team2.monsters = this.details.team2.monsters ? this.details.team2.monsters.map((m) => new BattleCard(Object.assign(m, { team_num: 1 }))) : [];
    }

    this.inactive = this.inactive ? this.inactive.split(',') : '';
    this.ruleset = this.ruleset ? this.ruleset.split('|') : '';
    this.rating_level = this.settings ? this.settings.rating_level : null;
    this.allowed_cards = this.settings ? this.settings.allowed_cards : null;

    if (data.player_1_data) {
      this.player1 = new Player(data.player_1_data);
    }

    if (data.player_2_data) {
      this.player2 = new Player(data.player_2_data);
    }
  }

  get ruleset_images() {
    if (this.ruleset) {
      return this.ruleset.map((r) => utils.asset_url(`website/icons/rulesets/new/img_combat-rule_${r.toLowerCase().replace(/[^a-zA-Z]+/g, '-')}_150.png`));
    }
    return '';
  }

  static async load(id) {
    return new Battle(await api('/battle/result', { id }));
  }

  static async get_tutorial_battle(player_name) {
    const res = await fetch(`${get_settings().asset_url}website/battle/tutorial/tutorial_battle.json`);

    let tutorialBattleData = await res.text();
    tutorialBattleData = JSON.parse(tutorialBattleData.replace(/%\{PLAYER\}/g, player_name));
    tutorialBattleData.details = JSON.parse(tutorialBattleData.details);
    tutorialBattleData.settings = JSON.parse(tutorialBattleData.settings);

    return new Battle(tutorialBattleData);
  }
}

export default Battle;
