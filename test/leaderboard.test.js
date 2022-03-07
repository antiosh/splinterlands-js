import sinon from 'sinon';
import splinterlands from '../src/splinterlands';
import * as apiModule from '../src/modules/api';
import leaderboardMock from './mocks/leaderboardMock';

test('getLeaderboard', async () => {
  const season = 28;
  const leaderboard = 2;
  sinon
    .stub(apiModule, 'default')
    .withArgs('/players/leaderboard_with_player', {
      season,
      leaderboard,
      page: undefined,
    })
    .returns(leaderboardMock);

  const result = await splinterlands.getLeaderboard(season, leaderboard);

  // testing class properties still there after refactor
  const { player } = result;
  expect(player.avatar_frame).toBe('https://d36mxiodymuqjm.cloudfront.net/website/icons/avatars/avatar-frame_gold.png');
  expect(player.display_name).toBe('antiosh');
  expect(player.is_eligible_to_advance).toBe(false);
});
