import Potion from '../classes/potion';
import settingsModule from './settings';

const potions = (function () {
  let _potions = [];

  async function get_potions() {
    if (_potions.length == 0) {
      const settings = settingsModule.get_settings();
      _potions = settings.potions.map((p) => new Potion(p));
    }

    return _potions;
  }

  async function get_active(type) {
    const allPotions = await get_potions();
    return allPotions.find((p) => p.id == type);
  }

  return {
    get_potions,
    get_active,
  };
})();

export default potions;
