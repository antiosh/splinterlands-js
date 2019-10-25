splinterlands.Match = class {
	constructor(data) { this.update(data); }

	update(data) {
		Object.keys(data).forEach(k => this[k] = data[k]);

		if(this.match_date) {
			this.inactive = this.inactive.split(',');
			this.ruleset = this.ruleset.split('|');
			this.settings = splinterlands.utils.try_parse(this.settings);
			this.rating_level = this.settings ? this.settings.rating_level : null;
			this.allowed_cards = this.settings ? this.settings.allowed_cards : null;
		}

		return this;
	}
}