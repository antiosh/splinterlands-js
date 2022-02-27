import hive from '@hiveio/hive-js';
import ecc from 'eosjs-ecc';
import md5 from 'blueimp-md5';
import Web3 from 'web3';

import splinterlands from './splinterlands';
import ops from './ops';
import socket from './socket';
import splinterlandsUtils from './splinterlands_utils';
import utils from './utils';

import bsc from './blockchain/bsc';
import eos from './blockchain/eos';
import ethereum from './blockchain/ethereum';
import tron from './blockchain/tron';

import BattleCard from './classes/battle_card';
import Battle from './classes/battle';
import CardDetails from './classes/card_details';
import Card from './classes/card';
import GuildBuilding from './classes/guild_building';
import Guild from './classes/guild';
import League from './classes/league';
import MarketCardGrouped from './classes/market_card_grouped';
import MarketCard from './classes/market_card';
import Market from './classes/market';
import Match from './classes/match';
import PlayerSettings from './classes/player_settings';
import Player from './classes/player';
import Potion from './classes/potion';
import Purchase from './classes/purchase';
import Quest from './classes/quest';
import RewardItem from './classes/reward_item';
import Season from './classes/season';
import Store from './classes/store';
import Transaction from './classes/transaction';

import mobileApp from './modules/mobile_app';

// libraries
window.hive = hive;
window.steem = window.hive;
window.eosjs_ecc = ecc;
window.md5 = md5;
window.Web3 = Web3;

// main
window.splinterlands = splinterlands;
window.splinterlands.socket = socket;
window.splinterlands.ops = ops;
window.splinterlands.utils = {
  ...splinterlandsUtils,
  ...utils,
};

// blockchain
window.splinterlands.bsc = bsc;
window.splinterlands.eos = eos;
window.splinterlands.ethereum = ethereum;
window.splinterlands.tron = tron;

// classes
window.splinterlands.BattleCard = BattleCard;
window.splinterlands.Battle = Battle;
window.splinterlands.CardDetails = CardDetails;
window.splinterlands.Card = Card;
window.splinterlands.GuildBuilding = GuildBuilding;
window.splinterlands.Guild = Guild;
window.splinterlands.League = League;
window.splinterlands.MarketCardGrouped = MarketCardGrouped;
window.splinterlands.MarketCard = MarketCard;
window.splinterlands.Market = Market;
window.splinterlands.Match = Match;
window.splinterlands.PlayerSettings = PlayerSettings;
window.splinterlands.Player = Player;
window.splinterlands.Potion = Potion;
window.splinterlands.Purchase = Purchase;
window.splinterlands.Quest = Quest;
window.splinterlands.RewardItem = RewardItem;
window.splinterlands.Season = Season;
window.splinterlands.Store = Store;
window.splinterlands.Transaction = Transaction;

// mobile
window.startWrappedApp = mobileApp.startWrappedApp;
window.showLoadingAnimation = mobileApp.showLoadingAnimation;

// backwards compatability
window.splinterlands.utils.account_exists = window.splinterlands.account_exists;
window.splinterlands.utils.get_monster_level = window.splinterlands.get_monster_level;
window.splinterlands.utils.get_summoner_level = window.splinterlands.get_summoner_level;
window.splinterlands.utils.validate_acct_name = window.splinterlands.validate_acct_name;
window.splinterlands.utils.get_starter_card = window.splinterlands.Card.get_starter_card;
