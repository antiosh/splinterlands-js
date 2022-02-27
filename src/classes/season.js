import ops from '../ops';
import League from './league';

class Season {
  constructor(data) {
    Object.keys(data).forEach((k) => (this[k] = data[k]));
    this.league = new League(this.max_rating, this.max_league);
  }

  async claim_rewards() {
    return ops.claim_season_rewards(this.season);
  }
}

export default Season;
