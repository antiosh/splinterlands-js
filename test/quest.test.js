const questData = {
    "id": "871283b22c165df273c5eb64a106142ff57272c8",
    "player": "antiosh",
    "created_date": "2022-02-25T08:46:36.000Z",
    "created_block": 62122641,
    "name": "Defend the Borders",
    "total_items": 5,
    "completed_items": 0,
    "claim_trx_id": null,
    "claim_date": null,
    "reward_qty": 6,
    "refresh_trx_id": null,
    "rewards": null
};

const splinterlandsQuests = [
    {
        "name": "Defend the Borders",
        "active": true,
        "type": "daily",
        "description": "Chaos seems to be erupting all across the Splinterlands and yet Khymeria is stable.  Don't let wretches from other Splinters ruin the sacred and protected homeland.  Form a patrol and keep undesirables out of our home.",
        "objective": "Win 5 ranked battles with the Life Splinter.",
        "objective_short": "Win 5 battles with Life",
        "objective_type": "splinter",
        "item_total": 5,
        "reward_qty": 1,
        "min_rating": 0,
        "match_types": [
            "Ranked"
        ],
        "reward_qty_by_league": [
            1,
            1,
            1,
            1,
            2,
            3,
            4,
            6,
            7,
            8,
            10,
            12,
            14,
            16,
            18,
            20
        ],
        "data": {
            "color": "White",
            "action": "win",
            "splinter": "Life",
            "value": "Life"
        },
        "icon": "icon_life_active.svg"
    }
];

const assert = chai.assert;

describe('Quest', function () {
    splinterlands.get_settings().quests = splinterlandsQuests;
    describe('completed', function () {
        let quest = new splinterlands.Quest(questData);
        it('should return true when completed items is greater than total items', function () {
            quest.completed_items = 5;
            assert.equal(quest.completed, true);
        });

        it('should return false when completed items is greater than total items', function () {
            quest.completed_items = 2;
            assert.equal(quest.completed, false);
        });
    });

    describe('claimed', function () {
        let quest = new splinterlands.Quest(questData);
        it('should return true when there is a claimed transaction id', function () {
            quest.claim_trx_id = '123314';
            assert.equal(quest.claimed, true);
        });

        it('should return false when there is no claimed transaction id', function () {
            quest.claim_trx_id = null;
            assert.equal(quest.claimed, false);
        });
    });

    describe('can_start', function () {
        let quest = new splinterlands.Quest(questData);
        it('should return true when there is a claimed transaction id', function () {
            debugger
            quest.claim_trx_id = '123314';
            assert.equal(quest.claimed, true);
        });
    });
});