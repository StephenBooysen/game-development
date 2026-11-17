// Legendary games: famous master games to replay move by move, with notes on the key moments.
// Moves are standard algebraic notation (SAN), written exactly as the move history writes them.
// Notes are keyed by move label: "16.Qb8+" for a White move, "15...Nxd7" for a Black move.
// Shared by the browser and the Node tests.

export const GAMES = [
  {
    id: 'opera', title: 'The Opera Game', white: 'Paul Morphy', black: 'Duke Karl of Brunswick & Count Isouard',
    event: 'Paris Opera', year: 1858, result: '1-0', ending: 'Checkmate.',
    summary: 'Played in a box at the Paris Opera during a performance. Morphy brings out a new piece with almost every move, opens lines against the uncastled king and finishes with a queen sacrifice. The classic lesson in fast development.',
    moves: '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#',
    notes: {
      '3...Bg4': 'Pins the knight, but Black soon gives this bishop up for it and falls behind in development.',
      '7.Qb3': 'A double attack on f7 and b7. Morphy keeps making threats while bringing pieces out.',
      '10.Nxb5': 'Instead of retreating, Morphy gives up a knight to rip open lines to the black king.',
      '12.O-O-O': 'Castles and puts the rook straight onto the d-file, aimed at the pinned knight.',
      '13.Rxd7': 'Gives up a rook for a knight to keep the attack going.',
      '16.Qb8+': 'The queen sacrifice! Taking it lets the rook deliver mate.',
      '17.Rd8#': 'Checkmate, with Black\'s kingside pieces still at home: this is what happens when you neglect development.',
    },
  },
  {
    id: 'immortal', title: 'The Immortal Game', white: 'Adolf Anderssen', black: 'Lionel Kieseritzky',
    event: 'London', year: 1851, result: '1-0', ending: 'Checkmate.',
    summary: 'A friendly game played during the first international tournament. Anderssen gives away a bishop, both rooks and finally his queen, then mates with his three remaining minor pieces. The high point of the romantic era of chess.',
    moves: '1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7#',
    notes: {
      '2.f4': 'The King\'s Gambit: White offers a pawn to open the f-file and build a big centre.',
      '4...b5': 'Black offers a pawn of his own to pull the bishop away.',
      '11.Rg1': 'Anderssen lets the bishop go: chasing Black\'s queen matters more to him.',
      '17...Qxb2': 'The black queen grabs a pawn and attacks the rook on a1.',
      '18.Bd6': 'Lets both rooks go! The bishop cuts the black king off from f8.',
      '19...Qxa1+': 'Black has won both rooks, but his pieces are far from his own king.',
      '21.Nxg7+': 'The knight drives the king to d8.',
      '22.Qf6+': 'The final sacrifice: the queen. After Nxf6 the bishop mates.',
      '23.Be7#': 'Mate by a bishop and two knights, with White down a queen, two rooks and a bishop.',
    },
  },
  {
    id: 'evergreen', title: 'The Evergreen Game', white: 'Adolf Anderssen', black: 'Jean Dufresne',
    event: 'Berlin', year: 1852, result: '1-0', ending: 'Checkmate.',
    summary: 'A friendly game in Berlin. Anderssen offers the Evans Gambit, builds up calmly, then plays one of the most beautiful combinations in chess. Steinitz called it "the evergreen in Anderssen\'s laurel crown".',
    moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7#',
    notes: {
      '4.b4': 'The Evans Gambit: a pawn for quick development and the centre.',
      '17.Nf6+': 'A knight sacrifice opens the g-file and the long road to the black king.',
      '19.Rad1': 'A quiet move in the middle of a fight. Anderssen lets Black take a knight and threaten mate.',
      '19...Qxf3': 'Black threatens mate on g2, but it is White to move.',
      '20.Rxe7+': 'A rook sacrifice clears the way to d7.',
      '21.Qxd7+': 'The queen sacrifice! The king has to take.',
      '22.Bf5+': 'Double check from the bishop and the rook on d1.',
      '24.Bxe7#': 'Checkmate with the two bishops.',
    },
  },
  {
    id: 'reti-tartakower', title: 'Réti vs Tartakower', white: 'Richard Réti', black: 'Savielly Tartakower',
    event: 'Vienna', year: 1910, result: '1-0', ending: 'Checkmate.',
    summary: 'One of the shortest famous games. In a casual game, Black wins a knight but leaves his king in the centre, and Réti punishes it with a queen sacrifice and mate by a bishop.',
    moves: '1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nf6 5.Qd3 e5 6.dxe5 Qa5+ 7.Bd2 Qxe5 8.O-O-O Nxe4 9.Qd8+ Kxd8 10.Bg5+ Kc7 11.Bd8#',
    notes: {
      '5.Qd3': 'An unusual queen move that sets up the trap.',
      '7...Qxe5': 'Black pins the knight on e4 against the white king.',
      '8.O-O-O': 'White castles anyway, leaving the knight to be taken and putting the rook on the d-file.',
      '8...Nxe4': 'Black wins the knight, but his king is still in the centre.',
      '9.Qd8+': 'The queen sacrifice! The king must take, and the d-file opens.',
      '10.Bg5+': 'Double check from bishop and rook. Kc7 and Ke8 both run into mate.',
      '11.Bd8#': 'Mate, on the very square where the queen was given up.',
    },
  },
  {
    id: 'king-hunt', title: 'The King Hunt', white: 'Edward Lasker', black: 'George Alan Thomas',
    event: 'London', year: 1912, result: '1-0', ending: 'Checkmate.',
    summary: 'The most famous king hunt. After a queen sacrifice, Black\'s king is chased with check after check from h7 all the way down to g1, where White mates by moving his own king.',
    moves: '1.d4 e6 2.Nf3 f5 3.Nc3 Nf6 4.Bg5 Be7 5.Bxf6 Bxf6 6.e4 fxe4 7.Nxe4 b6 8.Ne5 O-O 9.Bd3 Bb7 10.Qh5 Qe7 11.Qxh7+ Kxh7 12.Nxf6+ Kh6 13.Neg4+ Kg5 14.h4+ Kf4 15.g3+ Kf3 16.Be2+ Kg2 17.Rh2+ Kg1 18.Kd2#',
    notes: {
      '10.Qh5': 'The queen joins the knights and the bishop near the black king.',
      '10...Qe7': 'A mistake: it allows a winning combination.',
      '11.Qxh7+': 'The queen sacrifice! Now the knights drag the king out.',
      '12.Nxf6+': 'A double check: the king can only step forward.',
      '14.h4+': 'The pawns join in, and the checks keep coming.',
      '16.Be2+': 'The black king has walked onto White\'s side of the board.',
      '18.Kd2#': 'The king steps aside and uncovers the rook on a1: mate. Castling queenside would also have mated.',
    },
  },
  {
    id: 'gold-coins', title: 'The Gold Coins Game', white: 'Stefan Levitsky', black: 'Frank Marshall',
    event: 'Breslau', year: 1912, result: '0-1', ending: 'Levitsky resigned.',
    summary: 'Marshall\'s last move is a queen sacrifice that White cannot accept or ignore. Legend says the spectators were so delighted that they showered the board with gold coins.',
    moves: '1.d4 e6 2.e4 d5 3.Nc3 c5 4.Nf3 Nc6 5.exd5 exd5 6.Be2 Nf6 7.O-O Be7 8.Bg5 O-O 9.dxc5 Be6 10.Nd4 Bxc5 11.Nxe6 fxe6 12.Bg4 Qd6 13.Bh3 Rae8 14.Qd2 Bb4 15.Bxf6 Rxf6 16.Rad1 Qc5 17.Qe2 Bxc3 18.bxc3 Qxc3 19.Rxd5 Nd4 20.Qh5 Ref8 21.Re5 Rh6 22.Qg5 Rxh3 23.Rc5 Qg3',
    notes: {
      '19...Nd4': 'The knight jumps towards White\'s king, eyeing e2 and f3.',
      '20.Qh5': 'A mistake: the queen leaves the defence of the king.',
      '22...Rxh3': 'Takes the bishop that was guarding the king.',
      '23.Rc5': 'White attacks the black queen, expecting it to retreat.',
      '23...Qg3': 'One of the most famous moves ever. If hxg3, Ne2 is mate. If fxg3, Ne2+ Kh1 Rxf1 is mate. If Qxg3, Ne2+ Kh1 Nxg3+ and Black ends up a piece ahead.',
    },
  },
  {
    id: 'rubinstein', title: 'Rubinstein\'s Immortal', white: 'Georg Rotlewi', black: 'Akiba Rubinstein',
    event: 'Łódź', year: 1907, result: '0-1', ending: 'Rotlewi resigned.',
    summary: 'Rubinstein\'s two bishops point at White\'s king like cannons. He gives up his queen and a rook to clear their path, and mate cannot be stopped.',
    moves: '1.d4 d5 2.Nf3 e6 3.e3 c5 4.c4 Nc6 5.Nc3 Nf6 6.dxc5 Bxc5 7.a3 a6 8.b4 Bd6 9.Bb2 O-O 10.Qd2 Qe7 11.Bd3 dxc4 12.Bxc4 b5 13.Bd3 Rd8 14.Qe2 Bb7 15.O-O Ne5 16.Nxe5 Bxe5 17.f4 Bc7 18.e4 Rac8 19.e5 Bb6+ 20.Kh1 Ng4 21.Be4 Qh4 22.g3 Rxc3 23.gxh4 Rd2 24.Qxd2 Bxe4+ 25.Qg2 Rh3',
    notes: {
      '17.f4': 'Loosens the squares around White\'s own king.',
      '20...Ng4': 'Offers the knight and brings the queen\'s attack closer.',
      '22...Rxc3': 'Black leaves his queen to be taken!',
      '23...Rd2': 'A second rook offer: it pulls the white queen away from e4.',
      '24...Bxe4+': 'Now both bishops rake the board towards the white king.',
      '25...Rh3': 'The last rook joins in, and mate on h2 cannot be stopped.',
    },
  },
  {
    id: 'lasker-bauer', title: 'The Double Bishop Sacrifice', white: 'Emanuel Lasker', black: 'Johann Bauer',
    event: 'Amsterdam', year: 1889, result: '1-0', ending: 'Bauer resigned.',
    summary: 'The first famous double bishop sacrifice. The future world champion gives up both bishops to strip away the pawns around Black\'s king, then wins the material back with interest. The idea is still called the Lasker–Bauer combination.',
    moves: '1.f4 d5 2.e3 Nf6 3.b3 e6 4.Bb2 Be7 5.Bd3 b6 6.Nc3 Bb7 7.Nf3 Nbd7 8.O-O O-O 9.Ne2 c5 10.Ng3 Qc7 11.Ne5 Nxe5 12.Bxe5 Qc6 13.Qe2 a6 14.Nh5 Nxh5 15.Bxh7+ Kxh7 16.Qxh5+ Kg8 17.Bxg7 Kxg7 18.Qg4+ Kh7 19.Rf3 e5 20.Rh3+ Qh6 21.Rxh6+ Kxh6 22.Qd7 Bf6 23.Qxb7 Kg7 24.Rf1 Rab8 25.Qd7 Rfd8 26.Qg4+ Kf8 27.fxe5 Bg7 28.e6 Rb7 29.Qg6 f6 30.Rxf6+ Bxf6 31.Qxf6+ Ke8 32.Qh8+ Ke7 33.Qg7+ Kxe6 34.Qxb7 Rd6 35.Qxa6 d4 36.exd4 cxd4 37.h4 d3 38.Qxd3',
    notes: {
      '14.Nh5': 'The knight offers itself to pull the black knight away from the king.',
      '15.Bxh7+': 'The first bishop sacrifice tears away the h-pawn.',
      '17.Bxg7': 'The second bishop! Now the black king has no pawn cover at all.',
      '19.Rf3': 'The rook swings over towards h3 to join the attack on the bare king.',
      '20...Qh6': 'Blocking the check costs Black his queen.',
      '22.Qd7': 'A fork of both bishops wins back a piece. White is now clearly winning.',
      '38.Qxd3': 'White\'s queen is far stronger than Black\'s rook, and Black resigned.',
    },
  },
  {
    id: 'game-of-the-century', title: 'The Game of the Century', white: 'Donald Byrne', black: 'Bobby Fischer',
    event: 'New York', year: 1956, result: '0-1', ending: 'Checkmate.',
    summary: 'Bobby Fischer was 13 years old. He gives up his queen to start a "windmill" of discovered checks, collects a pile of material, and brings every piece together for mate.',
    moves: '1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h5 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2#',
    notes: {
      '11...Na4': 'A shocking knight offer. If White takes it, ...Nxe4 attacks the queen and the bishop at once.',
      '13...Nxe4': 'Black grabs the e4 pawn, and his pieces gather around the white king, still stuck in the centre.',
      '15...Nxc3': 'Black ignores the threat to his queen and keeps attacking.',
      '17...Be6': 'The queen sacrifice! Fischer lets his queen go to hunt the white king.',
      '18...Bxc4+': 'The windmill begins: knight and bishop take turns giving check and collecting material.',
      '23...axb6': 'Black now has a rook, two bishops and a knight for the queen.',
      '41...Rc2#': 'Every black piece plays its part in the final mate.',
    },
  },
  {
    id: 'fischer-spassky-6', title: 'Fischer vs Spassky, Game 6', white: 'Bobby Fischer', black: 'Boris Spassky',
    event: 'World Championship, Reykjavík', year: 1972, result: '1-0', ending: 'Spassky resigned.',
    summary: 'Fischer almost always opened with 1.e4, so 1.c4 was a surprise. He plays a Queen\'s Gambit of perfect clarity, and when it was over Spassky joined the audience in applauding.',
    moves: '1.c4 e6 2.Nf3 d5 3.d4 Nf6 4.Nc3 Be7 5.Bg5 O-O 6.e3 h6 7.Bh4 b6 8.cxd5 Nxd5 9.Bxe7 Qxe7 10.Nxd5 exd5 11.Rc1 Be6 12.Qa4 c5 13.Qa3 Rc8 14.Bb5 a6 15.dxc5 bxc5 16.O-O Ra7 17.Be2 Nd7 18.Nd4 Qf8 19.Nxe6 fxe6 20.e4 d4 21.f4 Qe7 22.e5 Rb8 23.Bc4 Kh8 24.Qh3 Nf8 25.b3 a5 26.f5 exf5 27.Rxf5 Nh7 28.Rcf1 Qd8 29.Qg3 Re7 30.h4 Rbb7 31.e6 Rbc7 32.Qe5 Qe8 33.a4 Qd8 34.R1f2 Qe8 35.R2f3 Qd8 36.Bd3 Qe8 37.Qe4 Nf6 38.Rxf6 gxf6 39.Rxf6 Kg8 40.Bc4 Kh8 41.Qf4',
    notes: {
      '1.c4': 'A surprise: Fischer had hardly ever opened with anything but 1.e4.',
      '15.dxc5': 'White gives Black "hanging pawns" on c5 and d5 and starts to put pressure on them.',
      '20.e4': 'Breaks up the black centre.',
      '26.f5': 'Opens the f-file for the white rooks.',
      '31.e6': 'The pawn cuts Black\'s position in two.',
      '38.Rxf6': 'A rook for a knight breaks open the last defences around the king.',
      '41.Qf4': 'Spassky resigned: he cannot stop the attack on his king.',
    },
  },
  {
    id: 'karpov-kasparov-16', title: 'Karpov vs Kasparov, Game 16', white: 'Anatoly Karpov', black: 'Garry Kasparov',
    event: 'World Championship, Moscow', year: 1985, result: '0-1', ending: 'Karpov resigned.',
    summary: 'Kasparov gives up a pawn early and plants a knight on d3, deep inside White\'s position. This "octopus" ties White up for the whole game. Kasparov went on to win the match and become world champion at 22.',
    moves: '1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nb5 d6 6.c4 Nf6 7.N1c3 a6 8.Na3 d5 9.cxd5 exd5 10.exd5 Nb4 11.Be2 Bc5 12.O-O O-O 13.Bf3 Bf5 14.Bg5 Re8 15.Qd2 b5 16.Rad1 Nd3 17.Nab1 h6 18.Bh4 b4 19.Na4 Bd6 20.Bg3 Rc8 21.b3 g5 22.Bxd6 Qxd6 23.g3 Nd7 24.Bg2 Qf6 25.a3 a5 26.axb4 axb4 27.Qa2 Bg6 28.d6 g4 29.Qd2 Kg7 30.f3 Qxd6 31.fxg4 Qd4+ 32.Kh1 Nf6 33.Rf4 Ne4 34.Qxd3 Nf2+ 35.Rxf2 Bxd3 36.Rfd2 Qe3 37.Rxd3 Rc1 38.Nb2 Qf2 39.Nd2 Rxd1+ 40.Nxd1 Re1+',
    notes: {
      '8...d5': 'A pawn sacrifice Kasparov had prepared at home, to get his pieces out fast.',
      '16...Nd3': 'The knight lands on d3, where no white pawn can ever drive it away: the "octopus".',
      '17.Nab1': 'The knight goes back to its starting square, a sign of how cramped White is.',
      '33...Ne4': 'The second knight joins in, and the white pieces start to fall apart.',
      '34...Nf2+': 'A fork of king and queen.',
      '40...Re1+': 'Karpov resigned: his king and pieces cannot hold out much longer.',
    },
  },
  {
    id: 'deep-blue-kasparov-6', title: 'Deep Blue vs Kasparov, Game 6', white: 'Deep Blue (IBM)', black: 'Garry Kasparov',
    event: 'Rematch, New York', year: 1997, result: '1-0', ending: 'Kasparov resigned.',
    summary: 'The deciding game of the rematch. Kasparov mixed up a known line and allowed a knight sacrifice on e6. The computer took its chance, and after 19 moves the world champion resigned. It was the first time a computer beat a reigning world champion in a match.',
    moves: '1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Ng5 Ngf6 6.Bd3 e6 7.N1f3 h6 8.Nxe6 Qe7 9.O-O fxe6 10.Bg6+ Kd8 11.Bf4 b5 12.a4 Bb7 13.Re1 Nd5 14.Bg3 Kc8 15.axb5 cxb5 16.Qd3 Bc6 17.Bf5 exf5 18.Rxe7 Bxe7 19.c4',
    notes: {
      '7...h6': 'A known mistake in this line: it allows the knight sacrifice.',
      '8.Nxe6': 'The knight sacrifice. Black\'s king is caught in the centre.',
      '10.Bg6+': 'Black can no longer castle; the king is stuck on d8.',
      '17.Bf5': 'The bishop is offered to win the black queen.',
      '19.c4': 'Kasparov resigned. His king has no shelter and the white pieces are pouring in.',
    },
  },
  {
    id: 'kasparov-topalov', title: 'Kasparov\'s Immortal', white: 'Garry Kasparov', black: 'Veselin Topalov',
    event: 'Wijk aan Zee', year: 1999, result: '1-0', ending: 'Topalov resigned.',
    summary: 'Often called the best game ever played. Kasparov sacrifices a rook on d4, then chases Topalov\'s king from b8 across the whole board to d1.',
    moves: '1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.Nge2 Nbd7 8.Bh6 Bxh6 9.Qxh6 Bb7 10.a3 e5 11.O-O-O Qe7 12.Kb1 a6 13.Nc1 O-O-O 14.Nb3 exd4 15.Rxd4 c5 16.Rd1 Nb6 17.g3 Kb8 18.Na5 Ba8 19.Bh3 d5 20.Qf4+ Ka7 21.Rhe1 d4 22.Nd5 Nbxd5 23.exd5 Qd6 24.Rxd4 cxd4 25.Re7+ Kb6 26.Qxd4+ Kxa5 27.b4+ Ka4 28.Qc3 Qxd5 29.Ra7 Bb7 30.Rxb7 Qc4 31.Qxf6 Kxa3 32.Qxa6+ Kxb4 33.c3+ Kxc3 34.Qa1+ Kd2 35.Qb2+ Kd1 36.Bf1 Rd2 37.Rd7 Rxd7 38.Bxc4 bxc4 39.Qxh8 Rd3 40.Qa8 c3 41.Qa4+ Ke1 42.f4 f5 43.Kc1 Rd2 44.Qa7',
    notes: {
      '22.Nd5': 'A knight offer that opens lines in the centre.',
      '24.Rxd4': 'The rook sacrifice that starts it all.',
      '25.Re7+': 'The other rook goes forward too, driving the king out.',
      '26...Kxa5': 'The black king is pulled up the board.',
      '33...Kxc3': 'The king has walked all the way to White\'s side of the board.',
      '36.Bf1': 'A quiet bishop move with deep ideas: it pulls the black queen away.',
      '37.Rd7': 'Another deflection, to win the queen.',
      '44.Qa7': 'Topalov resigned: White\'s queen and pawns will win.',
    },
  },
];

/** Finds a legendary game by its id, or undefined. */
export function getGame(id) {
  return GAMES.find((game) => game.id === id);
}

/** A game's moves as a list: { san, label, note } for each half-move, in order. */
export function gameMoves(game) {
  return game.moves.replace(/\d+\./g, '').trim().split(/\s+/).map((san, index) => {
    const number = Math.floor(index / 2) + 1;
    const label = index % 2 ? `${number}...${san}` : `${number}.${san}`;
    return { san, label, note: game.notes[label] ?? '' };
  });
}
