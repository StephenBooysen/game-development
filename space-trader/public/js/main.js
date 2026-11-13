// Void Merchant client entry point.

import { start } from './router.js';
import title from './screens/title.js';
import newCommander from './screens/newCommander.js';
import shipAssigned from './screens/shipAssigned.js';
import howto from './screens/howto.js';
import station from './screens/station.js';
import market from './screens/market.js';
import shipyard from './screens/shipyard.js';
import bank from './screens/bank.js';
import commander from './screens/commander.js';
import galaxy from './screens/galaxy.js';
import travel from './screens/travel.js';
import encounter from './screens/encounter.js';
import trader from './screens/trader.js';
import combat from './screens/combat.js';
import victory from './screens/victory.js';
import { gameOver, hallOfFame } from './screens/gameOver.js';

start(document.getElementById('app'), {
  '': title,
  new: newCommander,
  ship: shipAssigned,
  howto,
  halloffame: hallOfFame,
  station,
  market,
  shipyard,
  bank,
  commander,
  galaxy,
  travel,
  encounter,
  trader,
  combat,
  victory,
  gameover: gameOver
});
