export const GAME_DEFAULTS = {
  minPlayers: 2,
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordChoices: 3,
  hintsEnabled: true,
  hintCount: 3,
  maxNameLength: 20,
  maxMessageLength: 200,
  disconnectGraceMs: 60_000,
  roundEndDelaySec: 5
};

export const SCORING = {
  base: 200,
  bonus: 400,
  minGuessScore: 50,
  drawerShare: 0.5
};
