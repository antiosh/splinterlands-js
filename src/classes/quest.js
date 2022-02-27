import ops from '../ops';
import { ec_api } from '../modules/api';
import settingsModule from '../modules/settings';
import playerModule from '../modules/player';

class Quest {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));

    this.created_date = new Date(this.created_date || 0);
    this.details = settingsModule.get_settings().quests.find((q) => q.name == this.name);
  }

  rewards(league_num) {
    return this.details.reward_qty_by_league[league_num];
  }

  get completed() {
    return this.completed_items >= this.total_items;
  }

  get claimed() {
    return !!this.claim_trx_id;
  }

  get next() {
    return Math.max(this.created_date.getTime() + 23 * 60 * 60 * 1000 - Date.now(), 0);
  }

  get can_start() {
    return !this.id || (this.claimed && this.next <= 0);
  }

  get can_refresh() {
    return this.id ? !this.claimed && (!this.refresh_trx_id || this.next <= 0) : false;
  }

  async claim_rewards() {
    const womplay_id = await playerModule.get_player().get_womplay_id();
    if (womplay_id) {
      await ec_api('/womplay/tracking', { womplay_id, event_name: 'completed_daily_quest' });
    }

    return await ops.claim_quest_rewards(this.id);
  }

  async start_quest() {
    return await ops.start_quest();
  }

  async refresh_quest() {
    return await ops.refresh_quest();
  }
}

export default Quest;
